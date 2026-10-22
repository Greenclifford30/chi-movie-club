import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell, ProtectedPage } from "@/components/movie-club/app-shell";

const navigation = vi.hoisted(() => ({
  pathname: "/clubs/club-1/history",
  params: { clubId: "club-1" } as { clubId?: string; movieNightId?: string },
  replace: vi.fn(),
}));
const auth = vi.hoisted(() => ({ isAuthenticated: true, isLoading: false }));
const api = vi.hoisted(() => ({
  listClubs: vi.fn(),
  listNotifications: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => navigation.params,
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
}));
vi.mock("@/lib/movie-club-api", () => api);
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    email: "member@example.com",
    token: "token",
    ...auth,
    signOut: vi.fn(),
  }),
}));

beforeEach(() => {
  navigation.pathname = "/clubs/club-1/history";
  navigation.params = { clubId: "club-1" };
  auth.isAuthenticated = true;
  auth.isLoading = false;
  api.listClubs.mockResolvedValue({ clubs: [{ clubId: "club-1", name: "Friday Night Films", role: "admin" }] });
  api.listNotifications.mockResolvedValue({ notifications: [] });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); window.history.replaceState(null, "", "/"); });

describe("AppShell navigation", () => {
  it("shows the current club, contextual destinations, and the active page for admins", async () => {
    api.listClubs.mockResolvedValue({ clubs: [{ clubId: "club-1", name: "Friday Night Films", role: "admin" }] });
    api.listNotifications.mockResolvedValue({ notifications: [] });
    render(<AppShell><p>History content</p></AppShell>);

    const nav = screen.getByRole("navigation", { name: "Club navigation" });
    expect(within(nav).getByRole("link", { name: "Agenda" })).toHaveAttribute("href", "/my-movie-nights");
    expect(within(nav).getByRole("link", { name: "Clubs" })).toHaveAttribute("href", "/clubs");
    expect(within(nav).getByRole("link", { name: "Schedule" })).toHaveAttribute("href", "/clubs/club-1");
    expect(within(nav).getByRole("link", { name: "History" })).toHaveAttribute("aria-current", "page");
    expect(await within(nav).findByRole("link", { name: "Manage" })).toHaveAttribute("href", "/clubs/club-1/admin");
    await waitFor(() => expect(screen.getByRole("link", { name: /Friday Night Films/ })).toBeInTheDocument());
  });

  it.each([
    ["/clubs/club-1/movie-nights/night", "Schedule", "night"],
    ["/clubs/club-1/movie-nights/night/admin", "Manage", "night"],
    ["/clubs/club-1/movie-nights/new", "Manage", undefined],
  ])("marks only the parent destination active at %s", async (path, label, movieNightId) => {
    navigation.pathname = path;
    navigation.params.movieNightId = movieNightId;
    render(<AppShell><p>Night content</p></AppShell>);
    const mobile = screen.getByRole("navigation", { name: "Club navigation" });
    await waitFor(() => expect(within(mobile).getByRole("link", { name: label })).toHaveAttribute("aria-current", "page"));
    for (const name of ["Club navigation", "Club pages"]) {
      expect(within(screen.getByRole("navigation", { name })).getAllByRole("link").filter(link => link.getAttribute("aria-current") === "page")).toHaveLength(1);
    }
    expect(within(screen.getByRole("navigation", { name: "Movie night navigation" })).getByRole("link", { name: "Club schedule" })).toHaveAttribute("href", "/clubs/club-1");
    if (path.endsWith("/admin")) expect(screen.getByRole("link", { name: "View movie night" })).toHaveAttribute("href", "/clubs/club-1/movie-nights/night");
  });

  it("keeps global navigation available without a club", () => {
    navigation.params = {};
    navigation.pathname = "/settings";
    render(<AppShell><p>Settings</p></AppShell>);
    const nav = screen.getByRole("navigation", { name: "Club navigation" });
    expect(within(nav).getByRole("link", { name: "Clubs" })).toHaveAttribute("href", "/clubs");
    expect(within(nav).getByRole("link", { name: "Agenda" })).toHaveAttribute("href", "/my-movie-nights");
  });

  it("encodes club and night identifiers in persistent return links", () => {
    navigation.params = { clubId: "club/a", movieNightId: "night/b" };
    navigation.pathname = "/clubs/club%2Fa/movie-nights/night%2Fb/admin";
    render(<AppShell>Night</AppShell>);
    const nav = screen.getByRole("navigation", { name: "Movie night navigation" });
    expect(within(nav).getByRole("link", { name: "Club schedule" })).toHaveAttribute("href", "/clubs/club%2Fa");
    expect(within(nav).getByRole("link", { name: "View movie night" })).toHaveAttribute("href", "/clubs/club%2Fa/movie-nights/night%2Fb");
  });

  it("preserves a protected destination through sign-in, including query and fragment", () => {
    auth.isAuthenticated = false;
    navigation.pathname = "/clubs/club-1/movie-nights/night";
    window.history.replaceState(null, "", `${navigation.pathname}?from=agenda#showtimes`);
    render(<ProtectedPage>Private content</ProtectedPage>);
    expect(navigation.replace).toHaveBeenCalledWith(`/sign-in?redirect=${encodeURIComponent(`${navigation.pathname}?from=agenda#showtimes`)}`);
    expect(screen.queryByText("Private content")).not.toBeInTheDocument();
  });

  it("waits for authentication initialization before redirecting", () => {
    auth.isAuthenticated = false;
    auth.isLoading = true;
    render(<ProtectedPage>Private content</ProtectedPage>);
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("keeps notifications within a dismissible panel", async () => {
    render(<AppShell>Content</AppShell>);
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(await screen.findByRole("region", { name: "Recent activity" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Recent activity" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notifications" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    fireEvent.pointerDown(screen.getByText("Content"));
    expect(screen.queryByRole("region", { name: "Recent activity" })).not.toBeInTheDocument();
  });

  it("hides club management for guests", async () => {
    api.listClubs.mockResolvedValue({ clubs: [{ clubId: "club-1", name: "Friday Night Films", role: "guest" }] });
    api.listNotifications.mockResolvedValue({ notifications: [] });
    render(<AppShell><p>History content</p></AppShell>);
    await waitFor(() => expect(screen.getByRole("link", { name: /Friday Night Films/ })).toBeInTheDocument());
    expect(within(screen.getByRole("navigation", { name: "Club navigation" })).queryByRole("link", { name: "Manage" })).toBeNull();
  });
});
