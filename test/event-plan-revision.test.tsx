import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EventDetail from "@/components/movie-club/event-detail";
import { acknowledgeMovieNightPlan, getMovieNight, updateRsvp } from "@/lib/movie-club-api";
import type { ActiveMovieNightResponse } from "@/lib/movie-club-types";

const { params, router } = vi.hoisted(() => ({ params: { clubId: "club", movieNightId: "night" }, router: { replace: vi.fn() } }));
vi.mock("next/navigation", () => ({ useParams: () => params, useRouter: () => router }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/movie-club/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/movie-club/add-to-calendar-button", () => ({ AddToCalendarButton: () => <span>Calendar action</span> }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ token: "token", identityProvider: "cognito" }) }));
vi.mock("@/lib/movie-club-api", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/movie-club-api")>(), getMovieNight: vi.fn(), updateRsvp: vi.fn(), acknowledgeMovieNightPlan: vi.fn() }));
const plan: ActiveMovieNightResponse = {
  movieNight: { movieNightId: "night", clubId: "club", status: "confirmed", version: 4, planRevision: 2,
    movie: { provider: "tmdb", externalId: "1", title: "Heat" },
    previousPlan: { movieNightId: "night", showtimeId: "old", theaterName: "Old cinema", startsAtUtc: "2099-01-01T18:00:00Z" },
    confirmedShowtime: { movieNightId: "night", showtimeId: "new", theaterName: "New cinema", startsAtUtc: "2099-01-02T18:00:00Z" } },
  showtimes: [], currentUserVote: null, currentUserRole: "friend",
  currentUserRsvp: { movieNightId: "night", status: "going", ticketStatus: "purchased", rsvpPlanRevision: 1, ticketPlanRevision: 1 },
};
beforeEach(() => vi.mocked(getMovieNight).mockResolvedValue(plan));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("plan change responses", () => {
  it("keeps acknowledgement separate from RSVP and ticket review", async () => {
    vi.mocked(acknowledgeMovieNightPlan).mockResolvedValue({ acknowledgedPlanRevision: 2 });
    render(<EventDetail />);
    expect(await screen.findByText(/Your previous RSVP needs reconfirmation/)).toBeInTheDocument();
    expect(screen.getByText(/Ticket status needs review/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "I’ve seen the changed plan" }));
    await waitFor(() => expect(acknowledgeMovieNightPlan).toHaveBeenCalledWith("token", "night", 2));
    expect(await screen.findByText(/Plan acknowledged/)).toBeInTheDocument();
    expect(screen.getByText(/Your previous RSVP needs reconfirmation/)).toBeInTheDocument();
    expect(screen.getByText(/Ticket status needs review/)).toBeInTheDocument();
    expect(updateRsvp).not.toHaveBeenCalled();
  });
  it("submits the current plan revision and clears warnings only after a fresh response", async () => {
    vi.mocked(updateRsvp).mockResolvedValue({ rsvp: { ...plan.currentUserRsvp!, ticketStatus: "not_purchased", rsvpPlanRevision: 2, ticketPlanRevision: 2 } });
    render(<EventDetail />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Update RSVP" }))[0]);
    await waitFor(() => expect(updateRsvp).toHaveBeenCalledWith("token", "night", "going", "not_purchased", 2));
    await waitFor(() => expect(screen.queryByText(/Your previous RSVP needs reconfirmation/)).not.toBeInTheDocument());
    expect(screen.queryByText(/Ticket status needs review/)).not.toBeInTheDocument();
  });
  it("keeps cancelled details readable and closes participation controls", async () => {
    vi.mocked(getMovieNight).mockResolvedValue({ ...plan, movieNight: { ...plan.movieNight, status: "cancelled", planRevision: 3 } });
    render(<EventDetail />);
    expect(await screen.findByText("This movie night was cancelled. Voting and RSVP are closed.")).toBeInTheDocument();
    expect(screen.getByText("Participation closed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update RSVP" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save.*vote/i })).not.toBeInTheDocument();
    expect(screen.getByText("Calendar action")).toBeInTheDocument();
  });
});
