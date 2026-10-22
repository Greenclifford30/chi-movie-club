import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MovieNightList } from "@/components/movie-club/movie-night-list";
import { listClubs, listMovieNights, listMyMovieNights } from "@/lib/movie-club-api";
import type { MovieNightSummary } from "@/lib/movie-club-types";

vi.mock("@/components/movie-club/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ token: "token" }) }));
vi.mock("@/lib/movie-club-api", () => ({ listClubs: vi.fn(), listMovieNights: vi.fn(), listMyMovieNights: vi.fn() }));
const night: MovieNightSummary = { clubId: "one", movieNightId: "a", status: "confirmed", movie: { title: "Heat", provider: "tmdb", externalId: "1" }, currentUserVote: null, currentUserRsvp: null, confirmedShowtime: { movieNightId: "a", showtimeId: "s", theaterName: "Cinema", startsAtUtc: "2020-01-01T18:00:00Z" } };
beforeEach(() => {
  vi.mocked(listClubs).mockResolvedValue({ clubs: [{ clubId: "one", name: "Club one", role: "friend" }, { clubId: "two", name: "Club two", role: "guest" }], isPlatformAdmin: false });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("movie night schedule and agenda", () => {
  it("keeps past confirmed nights visible, paginates and links to the right event", async () => {
    vi.mocked(listClubs).mockResolvedValue({ clubs: [{ clubId: "one", name: "Club one", role: "admin" }], isPlatformAdmin: false });
    vi.mocked(listMovieNights).mockResolvedValueOnce({ movieNights: [night], nextCursor: "next" }).mockResolvedValueOnce({ movieNights: [{ ...night, movieNightId: "b", movie: { ...night.movie, title: "Thief" }, status: "planning", confirmedShowtime: undefined }] });
    render(<MovieNightList clubId="one" />);
    expect(await screen.findByText("Awaiting completion")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Heat" })).toHaveAttribute("href", "/clubs/one/movie-nights/a");
    expect(await screen.findByRole("link", { name: "Create a movie night" })).toHaveAttribute("href", "/clubs/one/movie-nights/new");
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Thief")).toBeInTheDocument();
    expect(listMovieNights).toHaveBeenLastCalledWith("token", "one", { cursor: "next" });
    expect(screen.getByText("Heat")).toBeInTheDocument();
  });
  it("loads the agenda through its aggregate endpoint and supports recent outings", async () => {
    vi.mocked(listMyMovieNights).mockResolvedValue({ movieNights: [{ ...night, clubName: "Club one", nextActions: ["review_tickets"] }] });
    render(<MovieNightList />);
    expect(await screen.findByText("Club one")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review your tickets" })).toHaveAttribute("href", "/clubs/one/movie-nights/a");
    fireEvent.click(screen.getByRole("button", { name: "Recent" }));
    await waitFor(() => expect(listMyMovieNights).toHaveBeenLastCalledWith("token", { scope: "recent" }));
    expect(listClubs).not.toHaveBeenCalled();
  });
});


describe("schedule clarity and recovery", () => {
  it("formats confirmed dates in the event timezone and shows the theater", async () => {
    vi.mocked(listMovieNights).mockResolvedValue({ movieNights: [{ ...night, timezone: "America/Chicago", confirmedShowtime: { ...night.confirmedShowtime!, startsAtUtc: "2099-01-02T01:00:00Z", screenFormat: "IMAX" } }] });
    render(<MovieNightList clubId="one" />);
    const outing = await screen.findByRole("article", { name: "Heat" });
    expect(within(outing).getByText("Thu, Jan 1, 2099 at 7:00 PM CST")).toHaveAttribute("datetime", "2099-01-02T01:00:00Z");
    expect(within(outing).getByText("Cinema · IMAX")).toBeInTheDocument();
    expect(within(outing).getByText("Confirmed")).toBeInTheDocument();
    expect(screen.queryByText(/America\/Chicago/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Manage Heat/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create a movie night" })).not.toBeInTheDocument();
  });

  it("uses a friendly target date without implying a time is confirmed", async () => {
    vi.mocked(listMovieNights).mockResolvedValue({ movieNights: [{ ...night, status: "planning", confirmedShowtime: undefined, targetDate: "2099-01-01" }] });
    render(<MovieNightList clubId="one" />);
    expect(await screen.findByText("Target date: Thu, Jan 1, 2099")).toBeInTheDocument();
    expect(screen.getByText("Planning")).toBeInTheDocument();
    expect(screen.queryByText("Cinema")).not.toBeInTheDocument();
  });

  it("shows current RSVP and ticket status without carrying over old ballot information", async () => {
    vi.mocked(listMovieNights).mockResolvedValue({ movieNights: [{ ...night, currentUserVote: { movieNightId: "a", rankings: ["s"] }, currentUserRsvp: { movieNightId: "a", status: "going", ticketStatus: "purchased" }, nextActions: ["review_tickets"] }] });
    render(<MovieNightList clubId="one" />);
    expect(await screen.findByText("Going · Ticket purchased")).toBeInTheDocument();
    expect(screen.queryByText("Your vote is saved")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review your tickets" })).toHaveAttribute("href", "/clubs/one/movie-nights/a");
  });

  it("keeps stale RSVP and ticket warnings distinct and does not label old tickets as current", async () => {
    vi.mocked(listMovieNights).mockResolvedValue({ movieNights: [{ ...night, planRevision: 2, currentUserRsvp: { movieNightId: "a", status: "going", ticketStatus: "purchased", rsvpPlanRevision: 1, ticketPlanRevision: 1 }, conflicts: [{ movieNightId: "other", uncertain: true }], nextActions: ["acknowledge_plan"] }] });
    render(<MovieNightList clubId="one" />);
    expect(await screen.findByText("RSVP needs reconfirmation.")).toBeInTheDocument();
    expect(screen.getByText("Tickets need review for the changed plan.")).toBeInTheDocument();
    expect(screen.getByText("May overlap another movie night.")).toBeInTheDocument();
    expect(screen.queryByText(/Ticket purchased/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review changed plan" })).toHaveAttribute("href", "/clubs/one/movie-nights/a");
  });

  it("shows saved ballots during voting and suppresses stale voting actions when voting closes", async () => {
    vi.mocked(listMovieNights).mockResolvedValue({ movieNights: [{ ...night, status: "voting", confirmedShowtime: undefined, votingClosedAt: "2020-01-01T00:00:00Z", currentUserVote: { movieNightId: "a", rankings: ["s"] }, nextActions: ["edit_vote"] }] });
    render(<MovieNightList clubId="one" />);
    expect(await screen.findByText("Voting closed")).toBeInTheDocument();
    expect(screen.getByText("Your vote is saved")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit your ballot" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View movie night" })).toHaveAttribute("href", "/clubs/one/movie-nights/a");
  });

  it.each(["completed", "cancelled"] as const)("offers details rather than stale participation actions for %s nights", async status => {
    vi.mocked(listMovieNights).mockResolvedValue({ movieNights: [{ ...night, status, nextActions: ["vote"] }] });
    render(<MovieNightList clubId="one" />);
    expect(await screen.findByRole("article", { name: "Heat" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Vote on showtimes" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View movie night" })).toBeInTheDocument();
  });

  it("gives members a useful empty state without admin controls", async () => {
    vi.mocked(listMovieNights).mockResolvedValue({ movieNights: [] });
    render(<MovieNightList clubId="one" />);
    expect(await screen.findByText("No movie nights planned")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View club history" })).toHaveAttribute("href", "/clubs/one/history");
    expect(screen.queryByRole("link", { name: "Create a movie night" })).not.toBeInTheDocument();
  });

  it("provides a single creation action for admins on an empty schedule", async () => {
    vi.mocked(listClubs).mockResolvedValue({ clubs: [{ clubId: "one", name: "Club one", role: "admin" }], isPlatformAdmin: false });
    vi.mocked(listMovieNights).mockResolvedValue({ movieNights: [] });
    render(<MovieNightList clubId="one" />);
    expect(await screen.findByText("No movie nights planned")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Create a movie night" })).toHaveLength(1);
  });

  it("retries an initial failure without showing a misleading empty state", async () => {
    vi.mocked(listMovieNights).mockRejectedValueOnce(new Error("Schedule unavailable.")).mockResolvedValueOnce({ movieNights: [night] });
    render(<MovieNightList clubId="one" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Schedule unavailable.");
    expect(screen.queryByText("No movie nights planned")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("article", { name: "Heat" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("preserves loaded nights on pagination errors and deduplicates the retry", async () => {
    vi.mocked(listMovieNights)
      .mockResolvedValueOnce({ movieNights: [night], nextCursor: "page-two" })
      .mockRejectedValueOnce(new Error("More nights unavailable."))
      .mockResolvedValueOnce({ movieNights: [night, { ...night, movieNightId: "b", movie: { ...night.movie, title: "Thief" } }] });
    render(<MovieNightList clubId="one" />);
    await screen.findByRole("article", { name: "Heat" });
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("More nights unavailable.");
    expect(screen.getByRole("article", { name: "Heat" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByRole("article", { name: "Thief" })).toBeInTheDocument();
    expect(screen.getAllByRole("article", { name: "Heat" })).toHaveLength(1);
    expect(listMovieNights).toHaveBeenLastCalledWith("token", "one", { cursor: "page-two" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("ignores a previous club’s pending pagination response after changing clubs", async () => {
    let resolveMore!: (result: { movieNights: MovieNightSummary[] }) => void;
    const pending = new Promise<{ movieNights: MovieNightSummary[] }>(resolve => { resolveMore = resolve; });
    vi.mocked(listMovieNights)
      .mockResolvedValueOnce({ movieNights: [night], nextCursor: "next" })
      .mockReturnValueOnce(pending)
      .mockResolvedValueOnce({ movieNights: [{ ...night, clubId: "two", movieNightId: "b", movie: { ...night.movie, title: "Thief" } }] });
    const { rerender } = render(<MovieNightList clubId="one" />);
    await screen.findByRole("article", { name: "Heat" });
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    rerender(<MovieNightList clubId="two" />);
    await screen.findByRole("article", { name: "Thief" });
    resolveMore({ movieNights: [{ ...night, movieNightId: "late" }] });
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(1));
    expect(screen.queryByRole("article", { name: "Heat" })).not.toBeInTheDocument();
  });
});
