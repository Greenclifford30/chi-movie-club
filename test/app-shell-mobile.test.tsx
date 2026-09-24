import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/movie-club/app-shell";

const navigation = vi.hoisted(() => ({
  pathname: "/clubs/club-1/history",
  params: { clubId: "club-1" },
  replace: vi.fn(),
}));
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
    isAuthenticated: true,
    isLoading: false,
    signOut: vi.fn(),
  }),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("AppShell navigation", () => {
  it("shows the current club, contextual destinations, and the active page for admins", async () => {
    api.listClubs.mockResolvedValue({ clubs: [{ clubId: "club-1", name: "Friday Night Films", role: "admin" }] });
    api.listNotifications.mockResolvedValue({ notifications: [] });
    render(<AppShell><p>History content</p></AppShell>);

    const nav = screen.getByRole("navigation", { name: "Club navigation" });
    expect(within(nav).getByRole("link", { name: "Clubs" })).toHaveAttribute("href", "/clubs");
    expect(within(nav).getByRole("link", { name: "Active" })).toHaveAttribute("href", "/clubs/club-1");
    expect(within(nav).getByRole("link", { name: "History" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Manage" })).toHaveAttribute("href", "/clubs/club-1/admin");
    await waitFor(() => expect(screen.getByRole("link", { name: /Friday Night Films/ })).toBeInTheDocument());
  });

  it("hides club management for guests", async () => {
    api.listClubs.mockResolvedValue({ clubs: [{ clubId: "club-1", name: "Friday Night Films", role: "guest" }] });
    api.listNotifications.mockResolvedValue({ notifications: [] });
    render(<AppShell><p>History content</p></AppShell>);
    await waitFor(() => expect(screen.getByRole("link", { name: /Friday Night Films/ })).toBeInTheDocument());
    expect(within(screen.getByRole("navigation", { name: "Club navigation" })).queryByRole("link", { name: "Manage" })).toBeNull();
  });
});
