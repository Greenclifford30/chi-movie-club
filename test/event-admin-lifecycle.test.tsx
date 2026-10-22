import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EventAdmin from "@/app/clubs/[clubId]/admin/admin-client";
import { cancelMovieNight, completeMovieNight, getMovieNight, getVoteResults, MovieClubApiError } from "@/lib/movie-club-api";
import type { ActiveMovieNightResponse, MovieNightStatus } from "@/lib/movie-club-types";

const navigation = vi.hoisted(() => ({ params: { clubId: "club", movieNightId: "night" } as { clubId: string; movieNightId?: string }, push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useParams: () => navigation.params, useRouter: () => navigation }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/movie-club/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ token: "token" }) }));
vi.mock("@/lib/movie-club-api", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/movie-club-api")>(),
  getMovieNight: vi.fn(), completeMovieNight: vi.fn(), cancelMovieNight: vi.fn(),
  getVoteResults: vi.fn().mockResolvedValue({ standings: [], voteCount: 0 }),
  listClubInvites: vi.fn().mockResolvedValue({ invites: [] }),
  listClubMembers: vi.fn().mockResolvedValue({ members: [] }),
  discoverMovies: vi.fn().mockResolvedValue({ results: [] }),
  getAttendance: vi.fn().mockResolvedValue(null),
  getUserPlanningPreferences: vi.fn().mockResolvedValue({ preferences: {} }),
}));

function night(status: MovieNightStatus = "confirmed", startsAtUtc?: string): ActiveMovieNightResponse {
  return {
    movieNight: {
      clubId: "club", movieNightId: "night", version: 4, status,
      movie: { provider: "tmdb", externalId: "1", title: "Arrival" },
      targetDate: "2099-01-01",
      ...(startsAtUtc ? { confirmedShowtime: { movieNightId: "night", showtimeId: "show", theaterName: "Music Box", startsAtUtc } } : {}),
    },
    currentUserRole: "admin", showtimes: [], currentUserVote: null, currentUserRsvp: null,
  };
}

beforeEach(() => {
  navigation.params = { clubId: "club", movieNightId: "night" };
  vi.mocked(getMovieNight).mockResolvedValue(night());
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); });

describe("event administration lifecycle", () => {
  it.each(["2000-01-01T18:00:00Z", "2099-01-01T18:00:00Z", undefined])("can end confirmed nights with showtime %s from any tab", async startsAtUtc => {
    vi.mocked(getMovieNight).mockResolvedValue(night("confirmed", startsAtUtc));
    vi.mocked(completeMovieNight).mockResolvedValue({ movieNight: night("completed").movieNight });
    render(<EventAdmin />);
    const end = await screen.findByRole("button", { name: "End event" });
    expect(end).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /People/ }));
    expect(end).toBeVisible();
    fireEvent.click(end);
    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/history.*voting and RSVP will close/));
    await waitFor(() => expect(completeMovieNight).toHaveBeenCalledWith("token", "night", { expectedVersion: 4, idempotencyKey: expect.any(String) }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/clubs/club/history"));
    expect(screen.queryByRole("button", { name: "End event" })).not.toBeInTheDocument();
  });

  it.each(["planning", "voting", "confirmed"] as const)("offers cancellation for %s nights outside the tabs", async status => {
    const original = night(status);
    vi.mocked(getMovieNight).mockResolvedValueOnce(original).mockResolvedValue(night("cancelled"));
    vi.mocked(cancelMovieNight).mockResolvedValue({ movieNight: night("cancelled").movieNight });
    render(<EventAdmin />);
    const cancel = await screen.findByRole("button", { name: "Cancel movie night" });
    fireEvent.click(screen.getByRole("button", { name: /Showtimes/ }));
    expect(cancel).toBeVisible();
    if (status !== "confirmed") expect(screen.queryByRole("button", { name: "End event" })).not.toBeInTheDocument();
    fireEvent.click(cancel);
    await waitFor(() => expect(cancelMovieNight).toHaveBeenCalledWith("token", "night", { expectedVersion: 4, idempotencyKey: expect.any(String) }));
    expect(await screen.findByText("Movie night cancelled and members notified.")).toBeInTheDocument();
    expect(getMovieNight).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "Cancel movie night" })).not.toBeInTheDocument();
  });

  it.each(["completed", "cancelled"] as const)("omits lifecycle actions for %s nights", async status => {
    vi.mocked(getMovieNight).mockResolvedValue(night(status));
    render(<EventAdmin />);
    await screen.findByRole("heading", { name: "Manage movie night" });
    expect(screen.queryByRole("button", { name: "End event" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel movie night" })).not.toBeInTheDocument();
  });

  it.each(["End event", "Cancel movie night"])("does nothing when confirmation of %s is dismissed", async label => {
    vi.mocked(window.confirm).mockReturnValue(false);
    render(<EventAdmin />);
    fireEvent.click(await screen.findByRole("button", { name: label }));
    expect(completeMovieNight).not.toHaveBeenCalled();
    expect(cancelMovieNight).not.toHaveBeenCalled();
  });

  it.each(["End event", "Cancel movie night"])("locks both actions while %s is pending", async label => {
    vi.mocked(completeMovieNight).mockReturnValue(new Promise(() => {}));
    vi.mocked(cancelMovieNight).mockReturnValue(new Promise(() => {}));
    render(<EventAdmin />);
    const action = await screen.findByRole("button", { name: label });
    fireEvent.click(action);
    fireEvent.click(action);
    expect(screen.getByRole("button", { name: "End event" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel movie night" })).toBeDisabled();
    expect(vi.mocked(completeMovieNight).mock.calls.length + vi.mocked(cancelMovieNight).mock.calls.length).toBe(1);
  });

  it.each(["End event", "Cancel movie night"])("shows a local failure and reuses the retry key for %s", async label => {
    const api = label === "End event" ? vi.mocked(completeMovieNight) : vi.mocked(cancelMovieNight);
    api.mockRejectedValue(new Error("Connection lost. Try again."));
    render(<EventAdmin />);
    fireEvent.click(await screen.findByRole("button", { name: label }));
    const region = screen.getByRole("region", { name: "End event" });
    expect(await within(region).findByRole("alert")).toHaveTextContent("Connection lost. Try again.");
    fireEvent.click(screen.getByRole("button", { name: label }));
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
    expect(api.mock.calls[0]).toEqual(api.mock.calls[1]);
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("refreshes a version conflict and requires another deliberate completion attempt", async () => {
    const fresh = night(); fresh.movieNight.version = 5;
    vi.mocked(getMovieNight).mockResolvedValueOnce(night()).mockResolvedValue(fresh);
    vi.mocked(completeMovieNight).mockRejectedValueOnce(new MovieClubApiError("Changed", 409)).mockResolvedValue({ movieNight: night("completed").movieNight });
    render(<EventAdmin />);
    fireEvent.click(await screen.findByRole("button", { name: "End event" }));
    expect(await screen.findByText(/details have been refreshed/)).toBeInTheDocument();
    expect(completeMovieNight).toHaveBeenCalledTimes(1);
    expect(navigation.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "End event" }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/clubs/club/history"));
    expect(vi.mocked(completeMovieNight).mock.calls[1][2]).toMatchObject({ expectedVersion: 5 });
    expect(vi.mocked(completeMovieNight).mock.calls[0][2]?.idempotencyKey).not.toBe(vi.mocked(completeMovieNight).mock.calls[1][2]?.idempotencyKey);
  });

  it("retains event controls when optional vote results fail to load", async () => {
    const fixture = night("confirmed", "2099-01-01T18:00:00Z");
    fixture.showtimes = [fixture.movieNight.confirmedShowtime!];
    vi.mocked(getMovieNight).mockResolvedValue(fixture);
    vi.mocked(getVoteResults).mockRejectedValueOnce(new Error("Results unavailable"));
    render(<EventAdmin />);
    expect(await screen.findByRole("button", { name: "End event" })).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Results unavailable");
  });

  it("refreshes a cancellation conflict without automatically retrying", async () => {
    const fresh = night("voting"); fresh.movieNight.version = 5;
    vi.mocked(getMovieNight).mockResolvedValueOnce(night("voting")).mockResolvedValue(fresh);
    vi.mocked(cancelMovieNight).mockRejectedValueOnce(new MovieClubApiError("Changed", 409)).mockResolvedValue({ movieNight: night("cancelled").movieNight });
    render(<EventAdmin />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel movie night" }));
    expect(await screen.findByText(/details have been refreshed/)).toBeInTheDocument();
    expect(cancelMovieNight).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancel movie night" }));
    await waitFor(() => expect(cancelMovieNight).toHaveBeenCalledTimes(2));
    expect(vi.mocked(cancelMovieNight).mock.calls[1][2]).toMatchObject({ expectedVersion: 5 });
  });

  it("reports a failed conflict refresh without claiming the details are current", async () => {
    vi.mocked(getMovieNight).mockResolvedValueOnce(night()).mockRejectedValue(new MovieClubApiError("Unavailable", 503));
    vi.mocked(completeMovieNight).mockRejectedValue(new MovieClubApiError("Changed", 409));
    render(<EventAdmin />);
    fireEvent.click(await screen.findByRole("button", { name: "End event" }));
    expect(await screen.findByText(/changed and could not be refreshed/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Club schedule" })).toBeInTheDocument();
    expect(completeMovieNight).toHaveBeenCalledTimes(1);
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("encodes return destinations and the completion history route", async () => {
    navigation.params = { clubId: "club/a", movieNightId: "night/b" };
    const fixture = night(); fixture.movieNight.clubId = "club/a"; fixture.movieNight.movieNightId = "night/b";
    vi.mocked(getMovieNight).mockResolvedValue(fixture);
    vi.mocked(completeMovieNight).mockResolvedValue({ movieNight: { ...fixture.movieNight, status: "completed" } });
    render(<EventAdmin />);
    fireEvent.click(await screen.findByRole("button", { name: "End event" }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/clubs/club%2Fa/history"));
    expect(screen.getByRole("link", { name: "View movie night" })).toHaveAttribute("href", "/clubs/club%2Fa/movie-nights/night%2Fb");
  });

  it("keeps return links during loading and after a load failure", async () => {
    let reject!: (error: Error) => void;
    vi.mocked(getMovieNight).mockReturnValue(new Promise((_, rejectRequest) => { reject = rejectRequest; }));
    render(<EventAdmin />);
    expect(screen.getByRole("link", { name: "Club schedule" })).toHaveAttribute("href", "/clubs/club");
    expect(screen.getByRole("link", { name: "View movie night" })).toHaveAttribute("href", "/clubs/club/movie-nights/night");
    reject(new MovieClubApiError("Night unavailable", 503));
    expect(await screen.findByText("Night unavailable")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Club schedule" })).toBeInTheDocument();
  });

  it("provides a schedule exit when creating a night", async () => {
    navigation.params.movieNightId = undefined;
    render(<EventAdmin />);
    await screen.findByRole("heading", { name: "Manage movie night" });
    expect(screen.getByRole("link", { name: "Club schedule" })).toHaveAttribute("href", "/clubs/club");
    expect(screen.queryByRole("link", { name: "View movie night" })).not.toBeInTheDocument();
  });
});
