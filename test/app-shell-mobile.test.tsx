import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/movie-club/app-shell";

const navigation = vi.hoisted(() => ({
  pathname: "/clubs/club-1/history",
  params: { clubId: "club-1" },
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => navigation.params,
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    email: "member@example.com",
    isAuthenticated: true,
    isLoading: false,
    signOut: vi.fn(),
  }),
}));

afterEach(cleanup);

describe("AppShell mobile navigation", () => {
  it("exposes all contextual club destinations and marks the current page", () => {
    render(<AppShell><p>History content</p></AppShell>);

    const nav = screen.getByRole("navigation", { name: "Club navigation" });
    expect(nav).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Clubs" })).toHaveAttribute("href", "/clubs");
    expect(within(nav).getByRole("link", { name: "Active" })).toHaveAttribute("href", "/clubs/club-1");
    expect(within(nav).getByRole("link", { name: "History" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Admin" })).toHaveAttribute("href", "/clubs/club-1/admin");
  });
});
