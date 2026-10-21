import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MovieNightList } from "@/components/movie-club/movie-night-list";
import { listClubs, listMovieNights, listMyMovieNights } from "@/lib/movie-club-api";
import type { MovieNightSummary } from "@/lib/movie-club-types";

vi.mock("@/components/movie-club/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ token: "token" }) }));
vi.mock("@/lib/movie-club-api", () => ({ listClubs: vi.fn(), listMovieNights: vi.fn(), listMyMovieNights: vi.fn() }));
const night: MovieNightSummary = { clubId: "one", movieNightId: "a", status: "confirmed", movie: { title: "Heat", provider: "tmdb", externalId: "1" }, currentUserVote: null, currentUserRsvp: null, confirmedShowtime: { movieNightId: "a", showtimeId: "s", theaterName: "Cinema", startsAtUtc: "2020-01-01T18:00:00Z" } };
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
