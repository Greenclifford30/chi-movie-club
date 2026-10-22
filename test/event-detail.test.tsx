import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EventDetail from "@/components/movie-club/event-detail";
import { getMovieNight, submitVote, updateRsvp } from "@/lib/movie-club-api";
import type { ActiveMovieNightResponse } from "@/lib/movie-club-types";

vi.mock("next/navigation", () => ({ useParams: () => ({ clubId: "club", movieNightId: "night" }) }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/movie-club/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/movie-club/add-to-calendar-button", () => ({ AddToCalendarButton: () => <button>Add to calendar</button> }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ token: "token", identityProvider: "cognito" }) }));
vi.mock("@/lib/movie-club-api", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/movie-club-api")>(), getMovieNight: vi.fn(), submitVote: vi.fn(), updateRsvp: vi.fn() }));

const showtimes = [
  { movieNightId: "night", showtimeId: "one", theaterName: "Music Box Theatre", startsAtUtc: "2099-01-02T01:00:00Z", ticketURI: "https://tickets.example/one" },
  { movieNightId: "night", showtimeId: "two", theaterName: "River East", startsAtUtc: "2099-01-03T01:00:00Z" },
];
const voting: ActiveMovieNightResponse = {
  movieNight: {
    movieNightId: "night", clubId: "club", status: "voting", movieSelectionMode: "admin_selected", targetDate: "2099-01-02",
    votingClosesAt: "2099-01-01T18:00:00Z",
    movie: { provider: "tmdb", externalId: "1", title: "Arrival", releaseYear: "2016", runtime: 116, genres: ["Science fiction"], rating: 7.9, overview: "A linguist works to understand visitors from another world." },
  },
  showtimes, currentUserRole: "friend", currentUserVote: null, currentUserRsvp: null,
};

beforeEach(() => vi.mocked(getMovieNight).mockResolvedValue(voting));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("Movie Night participation", () => {
  it("adds unique showtimes to the ballot and saves rankings without a duplicate recap", async () => {
    vi.mocked(submitVote).mockResolvedValue({ vote: { movieNightId: "night", rankings: ["one", "two"] } });
    render(<EventDetail />);
    const first = await screen.findByRole("button", { name: /Add Music Box Theatre/ });
    fireEvent.click(first);
    expect(first).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(first);
    fireEvent.click(screen.getByRole("button", { name: /Add River East/ }));
    const ballot = screen.getAllByRole("combobox");
    expect(ballot[0]).toHaveTextContent("Music Box Theatre");
    expect(ballot[1]).toHaveTextContent("River East");
    expect(ballot[2]).toHaveTextContent("No selection");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Save ranked vote" })[0]);
    await waitFor(() => expect(submitVote).toHaveBeenCalledWith("token", "night", ["one", "two"]));
    expect(await screen.findByText("Your ranked vote is saved")).toBeInTheDocument();
    expect(screen.queryByText("admin_selected")).not.toBeInTheDocument();
    expect(screen.getByText(/Target date:/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Movie night status" })).toHaveTextContent("Voting closes");
  });

  it("provides an expandable synopsis and movie metadata without a placeholder poster", async () => {
    render(<EventDetail />);
    const summary = await screen.findByText("About the movie");
    const disclosure = summary.closest("details")!;
    expect(disclosure).not.toHaveAttribute("open");
    expect(disclosure).toHaveTextContent(voting.movieNight.movie.overview!);
    fireEvent.click(summary);
    expect(disclosure).toHaveAttribute("open");
    expect(screen.getByText("No poster available")).toBeInTheDocument();
    expect(screen.getByText("2016")).toBeInTheDocument();
    expect(screen.getByText("116 min")).toBeInTheDocument();
    expect(screen.getByText("Science fiction")).toBeInTheDocument();
    expect(screen.getByText("★ 7.9")).toBeInTheDocument();
  });

  it("keeps the final plan before RSVP and collapses old showtimes", async () => {
    vi.mocked(getMovieNight).mockResolvedValue({ ...voting, movieNight: { ...voting.movieNight, status: "confirmed", confirmedShowtime: showtimes[0] } });
    vi.mocked(updateRsvp).mockResolvedValue({ rsvp: { movieNightId: "night", status: "maybe", ticketStatus: "purchased", rsvpPlanRevision: 1, ticketPlanRevision: 1 } });
    render(<EventDetail />);
    const plan = await screen.findByRole("region", { name: "Final movie night plan" });
    const participation = screen.getByRole("complementary", { name: "Your participation" });
    expect(plan.compareDocumentPosition(participation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(plan).getByRole("link", { name: "Buy tickets" })).toHaveAttribute("href", showtimes[0].ticketURI);
    expect(within(plan).getByRole("button", { name: "Add to calendar" })).toBeInTheDocument();
    const disclosure = screen.getByText("Previous showtime options", { selector: "summary" }).closest("details")!;
    expect(disclosure).not.toHaveAttribute("open");
    fireEvent.click(within(disclosure).getByText("Previous showtime options"));
    expect(disclosure).toHaveAttribute("open");
    expect(screen.queryByText(/Target date:/)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Maybe" }));
    fireEvent.click(screen.getByRole("button", { name: "Purchased" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Update RSVP" })[0]);
    await waitFor(() => expect(updateRsvp).toHaveBeenCalledWith("token", "night", "maybe", "purchased", 1));
  });

  it.each(["completed", "cancelled"] as const)("closes participation and omits empty previous options for %s nights", async status => {
    vi.mocked(getMovieNight).mockResolvedValue({ ...voting, showtimes: [], movieNight: { ...voting.movieNight, status, confirmedShowtime: showtimes[0] } });
    render(<EventDetail />);
    expect(await screen.findByText("Participation closed")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Final movie night plan" })).toBeInTheDocument();
    expect(screen.queryByText("Previous showtime options")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update RSVP" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Buy tickets" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ranked vote/ })).not.toBeInTheDocument();
  });

  it("preserves a read-only saved ballot when voting closes", async () => {
    vi.mocked(getMovieNight).mockResolvedValue({ ...voting, currentUserVote: { movieNightId: "night", rankings: ["two"] }, movieNight: { ...voting.movieNight, votingClosedAt: "2098-12-31T18:00:00Z" } });
    render(<EventDetail />);
    expect(await screen.findByText("Voting is closed")).toBeInTheDocument();
    const ballot = screen.getAllByRole("combobox");
    expect(ballot[0]).toHaveTextContent("River East");
    ballot.forEach(choice => expect(choice).toBeDisabled());
    screen.getAllByRole("button", { name: "Update ranked vote" }).forEach(button => expect(button).toBeDisabled());
    expect(screen.queryByRole("button", { name: /Add .* to your ballot/ })).not.toBeInTheDocument();
  });

  it("keeps setup useful with no showtimes or optional movie fields", async () => {
    vi.mocked(getMovieNight).mockResolvedValue({ ...voting, showtimes: [], movieNight: { ...voting.movieNight, status: "planning", targetDate: undefined, movie: { provider: "tmdb", externalId: "1", title: "Arrival" } } });
    render(<EventDetail />);
    expect(await screen.findByText("No showtimes yet")).toBeInTheDocument();
    expect(screen.getByText("Movie night is in setup")).toBeInTheDocument();
    expect(screen.queryByText("About the movie")).not.toBeInTheDocument();
    expect(screen.queryByText(/Target date:/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ranked vote/ })).not.toBeInTheDocument();
  });

  it("reports a load failure with a way back", async () => {
    vi.mocked(getMovieNight).mockRejectedValue(new Error("Movie night unavailable."));
    render(<EventDetail />);
    expect(await screen.findByText("Movie night could not load")).toBeInTheDocument();
    expect(screen.getByText("Movie night unavailable.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to clubs" })).toHaveAttribute("href", "/clubs");
  });
});
