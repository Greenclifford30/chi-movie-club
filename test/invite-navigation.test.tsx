import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InvitePage from "@/app/invites/[token]/page";
import { getInvite, MovieClubApiError } from "@/lib/movie-club-api";

const auth = vi.hoisted(() => ({ email: "member@example.test", token: "token", isAuthenticated: false, isLoading: false, signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ useParams: () => ({ token: "invite/token" }), useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => auth }));
vi.mock("@/lib/movie-club-api", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/movie-club-api")>(), getInvite: vi.fn() }));

beforeEach(() => { auth.isAuthenticated = false; });
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("invite navigation", () => {
  it.each([true, false])("provides an exit for unavailable invites when authenticated=%s", async signedIn => {
    auth.isAuthenticated = signedIn;
    vi.mocked(getInvite).mockRejectedValue(new MovieClubApiError("Expired", 410));
    render(<InvitePage />);
    await screen.findByRole("heading", { name: "Invite unavailable" });
    expect(screen.getByRole("link", { name: signedIn ? "Back to clubs" : "Back to sign in" })).toHaveAttribute("href", signedIn ? "/clubs" : "/sign-in");
  });

  it("provides an exit while an invite is loading", () => {
    vi.mocked(getInvite).mockReturnValue(new Promise(() => {}));
    render(<InvitePage />);
    expect(screen.getByRole("heading", { name: "Loading invite" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/sign-in");
  });

  it("keeps the encoded invite destination through sign-in and sign-up", async () => {
    vi.mocked(getInvite).mockResolvedValue({ invite: { clubId: "club", clubName: "Friday Films", inviteId: "invite", role: "friend", status: "pending", expiresAt: "2099-01-01T00:00:00Z" } });
    render(<InvitePage />);
    await screen.findByRole("heading", { name: "Join Friday Films" });
    const redirect = encodeURIComponent("/invites/invite%2Ftoken");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", `/sign-in?redirect=${redirect}`);
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", `/sign-up?redirect=${redirect}`);
  });
});
