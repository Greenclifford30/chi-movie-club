import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EventAdmin from "@/app/clubs/[clubId]/admin/admin-client";
import { cancelMovieNight, completeMovieNight, getMovieNight, getVoteResults, discoverMovies, listClubInvites, listMovieNights, confirmShowtime, approveBulkShowtimeCandidates, approveShowtimeCandidate, MovieClubApiError } from "@/lib/movie-club-api";
import type { ActiveMovieNightResponse, MovieNightStatus } from "@/lib/movie-club-types";

const navigation = vi.hoisted(() => ({ params: { clubId: "club", movieNightId: "night" } as { clubId: string; movieNightId?: string }, push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useParams: () => navigation.params, useRouter: () => navigation }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/movie-club/app-shell", () => ({ AppShell: ({ children, movieNightNavigation }: { children: React.ReactNode; movieNightNavigation?: React.ReactNode }) => <>{movieNightNavigation}{children}</> }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ token: "token" }) }));
vi.mock("@/lib/movie-club-api", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/movie-club-api")>(),
  getMovieNight: vi.fn(), completeMovieNight: vi.fn(), cancelMovieNight: vi.fn(),
  openVoting: vi.fn(), closeVoting: vi.fn(), confirmShowtime: vi.fn(), approveBulkShowtimeCandidates: vi.fn(), approveShowtimeCandidate: vi.fn(),
  listMovieNights: vi.fn().mockResolvedValue({ movieNights: [] }),
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

async function findAction(label: string) {
  const summary = await screen.findByText("Event actions", { selector: "summary" });
  if (!summary.closest("details")?.open) fireEvent.click(summary);
  return screen.findByRole("button", { name: label });
}

beforeEach(() => {
  navigation.params = { clubId: "club", movieNightId: "night" };
  vi.mocked(getMovieNight).mockReset().mockResolvedValue(night());
  vi.mocked(getVoteResults).mockReset().mockResolvedValue({ standings: [], voteCount: 0 });
  vi.mocked(listClubInvites).mockReset().mockResolvedValue({ invites: [] });
  vi.mocked(listMovieNights).mockReset().mockResolvedValue({ movieNights: [] });
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); });

describe("event administration lifecycle", () => {
  it.each(["2000-01-01T18:00:00Z", "2099-01-01T18:00:00Z", undefined])("can end confirmed nights with showtime %s from any tab", async startsAtUtc => {
    vi.mocked(getMovieNight).mockResolvedValue(night("confirmed", startsAtUtc));
    vi.mocked(completeMovieNight).mockResolvedValue({ movieNight: night("completed").movieNight });
    render(<EventAdmin />);
    const end = await findAction("End event");
    expect(end).toBeEnabled();
    fireEvent.click(screen.getByRole("tab", { name: /People/ }));
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
    const cancel = await findAction("Cancel movie night");
    fireEvent.click(screen.getByRole("tab", { name: /Showtimes/ }));
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
    fireEvent.click(await findAction(label));
    expect(completeMovieNight).not.toHaveBeenCalled();
    expect(cancelMovieNight).not.toHaveBeenCalled();
  });

  it.each(["End event", "Cancel movie night"])("locks both actions while %s is pending", async label => {
    vi.mocked(completeMovieNight).mockReturnValue(new Promise(() => {}));
    vi.mocked(cancelMovieNight).mockReturnValue(new Promise(() => {}));
    render(<EventAdmin />);
    const action = await findAction(label);
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
    fireEvent.click(await findAction(label));
    const region = screen.getByRole("region", { name: "Event actions" });
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
    fireEvent.click(await findAction("End event"));
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
    expect(await findAction("End event")).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Results unavailable");
  });

  it("refreshes a cancellation conflict without automatically retrying", async () => {
    const fresh = night("voting"); fresh.movieNight.version = 5;
    vi.mocked(getMovieNight).mockResolvedValueOnce(night("voting")).mockResolvedValue(fresh);
    vi.mocked(cancelMovieNight).mockRejectedValueOnce(new MovieClubApiError("Changed", 409)).mockResolvedValue({ movieNight: night("cancelled").movieNight });
    render(<EventAdmin />);
    fireEvent.click(await findAction("Cancel movie night"));
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
    fireEvent.click(await findAction("End event"));
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
    fireEvent.click(await findAction("End event"));
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


function withShowtimes(status: MovieNightStatus = "planning") {
  const fixture = night(status);
  Object.assign(fixture.movieNight, { timezone: "America/Chicago", dateWindowStart: "2099-01-01", dateWindowEnd: "2099-01-01", zipCode: "60613", radiusMiles: 10 });
  fixture.showtimes = [
    { movieNightId: "night", showtimeId: "one", theaterName: "Music Box", startsAtUtc: "2099-01-02T01:00:00Z", status: "approved" },
    { movieNightId: "night", showtimeId: "two", theaterName: "River East", startsAtUtc: "2099-01-02T02:00:00Z", status: "approved" },
  ];
  return fixture;
}

async function openTab(name: RegExp) {
  const tab = await screen.findByRole("tab", { name });
  fireEvent.click(tab);
  return screen.getByRole("tabpanel", { name });
}

describe("admin workspace clarity and accessibility", () => {
  it("keeps event actions collapsed and hides absent update metadata", async () => {
    render(<EventAdmin />);
    const summary = await screen.findByText("Event actions", { selector: "summary" });
    expect(summary.closest("details")).not.toHaveAttribute("open");
    expect(screen.getByRole("button", { name: "Cancel movie night" })).not.toBeVisible();
    expect(screen.queryByText("No active movie night yet")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Club schedule" })).toHaveLength(1);
  });

  it.each(["confirmed", "completed", "cancelled"] as const)("never offers voting setup for a %s night", async status => {
    vi.mocked(getMovieNight).mockResolvedValue(withShowtimes(status));
    render(<EventAdmin />);
    const panel = await openTab(/Voting & plan/);
    expect(within(panel).queryByRole("button", { name: "Open voting" })).not.toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: "Close voting early" })).not.toBeInTheDocument();
    expect(within(panel).queryByText(/Voting is not open yet/)).not.toBeInTheDocument();
    expect(within(panel).queryByText(/Approve at least two/)).not.toBeInTheDocument();
  });

  it("shows the full deadline in the event timezone and prioritizes open voting over live results", async () => {
    const fixture = withShowtimes("voting");
    fixture.movieNight.votingClosesAt = "2099-01-01T23:30:00Z";
    vi.mocked(getMovieNight).mockResolvedValue(fixture);
    vi.mocked(getVoteResults).mockResolvedValue({ voteCount: 3, standings: [{ showtimeId: "one", showtime: fixture.showtimes[0], points: 8, firstChoiceVotes: 2, rankedVotes: 3 }] });
    render(<EventAdmin />);
    const panel = await openTab(/Voting & plan/);
    expect(within(panel).getByText(/Jan 1, 2099, 5:30 PM.*America\/Chicago/)).toBeInTheDocument();
    expect(screen.getByText(/wait for voting to close before confirming/)).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /^Confirm / })).not.toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Close voting early" })).toBeEnabled();
    expect(within(panel).getAllByText(/Music Box/)).toHaveLength(1);
  });

  it("shows confirmation only after voting closes and includes the selected plan in the prompt", async () => {
    const fixture = withShowtimes("voting");
    fixture.movieNight.votingClosedAt = "2020-01-01T00:00:00Z";
    vi.mocked(getMovieNight).mockResolvedValue(fixture);
    vi.mocked(getVoteResults).mockResolvedValue({ voteCount: 3, standings: [{ showtimeId: "one", showtime: fixture.showtimes[0], points: 8, firstChoiceVotes: 2, rankedVotes: 3 }] });
    vi.mocked(confirmShowtime).mockResolvedValue({ movieNight: { ...fixture.movieNight, status: "confirmed" } });
    render(<EventAdmin />);
    const panel = await openTab(/Voting & plan/);
    fireEvent.click(within(panel).getByRole("button", { name: /^Confirm Music Box/ }));
    await waitFor(() => expect(confirmShowtime).toHaveBeenCalled());
    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/Arrival[\s\S]*Music Box[\s\S]*Jan 1[\s\S]*7:00 PM[\s\S]*America\/Chicago/));
    expect(within(panel).queryByRole("button", { name: "Open voting" })).not.toBeInTheDocument();
  });

  it("requires a deliberate plan-change flow and retains the reason after failure", async () => {
    const fixture = withShowtimes("confirmed");
    vi.mocked(getMovieNight).mockResolvedValue(fixture);
    vi.mocked(confirmShowtime).mockRejectedValue(new Error("Could not update. Try again."));
    render(<EventAdmin />);
    const panel = await openTab(/Voting & plan/);
    expect(within(panel).queryByLabelText(/Reason for changing/)).not.toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Change confirmed plan" }));
    fireEvent.change(within(panel).getByLabelText(/Reason for changing/), { target: { value: "Earlier works better" } });
    fireEvent.click(within(panel).getByRole("button", { name: /^Change to Music Box/ }));
    expect(await within(panel).findByRole("alert")).toHaveTextContent("Could not update. Try again.");
    expect(within(panel).getByLabelText(/Reason for changing/)).toHaveValue("Earlier works better");
    expect(confirmShowtime).toHaveBeenCalledWith("token", "night", "one", expect.objectContaining({ changeReason: "Earlier works better", expectedVersion: 4 }));
  });

  it("labels planning controls and makes locked values read-only", async () => {
    render(<EventAdmin />);
    const panel = await openTab(/Setup/);
    expect(within(panel).getByLabelText("Movie title")).toBeInTheDocument();
    expect(within(panel).getByLabelText("Window start")).toBeDisabled();
    expect(within(panel).getByLabelText("Window end")).toBeDisabled();
    expect(within(panel).getByLabelText("Timezone")).toBeDisabled();
    expect(within(panel).getAllByLabelText("Target date")).toHaveLength(2);
    expect(within(panel).getByRole("button", { name: "Now Playing" })).toHaveAttribute("aria-pressed", "true");
  });

  it("exposes selected showtimes, filters approval status, and bulk approves visible selections", async () => {
    const fixture = withShowtimes();
    fixture.showtimes[0].status = "imported";
    fixture.showtimes[1].status = "rejected";
    vi.mocked(getMovieNight).mockResolvedValue(fixture);
    vi.mocked(approveBulkShowtimeCandidates).mockResolvedValue({ showtimes: fixture.showtimes });
    render(<EventAdmin />);
    const panel = await openTab(/Showtimes/);
    fireEvent.change(within(panel).getByLabelText("Status"), { target: { value: "imported" } });
    expect(within(panel).queryByRole("button", { name: /^Select River East/ })).not.toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Select all visible" }));
    expect(within(panel).getByRole("button", { name: /^Select Music Box/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(panel).getByRole("button", { name: "Approve selected" }));
    await waitFor(() => expect(approveBulkShowtimeCandidates).toHaveBeenCalledWith("token", "night", ["one"]));
    expect(await within(panel).findByRole("status")).toHaveTextContent("1 showtime approved");
  });

  it.each(["unavailable", "rejected", "success"])("reports clipboard %s truthfully and retains a manual fallback", async outcome => {
    const writeText = vi.fn().mockImplementation(() => outcome === "rejected" ? Promise.reject(new Error("Denied")) : Promise.resolve());
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: outcome === "unavailable" ? undefined : { writeText } });
    vi.mocked(listClubInvites).mockResolvedValue({ invites: [{ clubId: "club", inviteId: "invite", role: "friend", status: "pending", expiresAt: "2099-01-01", inviteUrl: "https://example.test/invite" }] });
    try {
      render(<EventAdmin />);
      const panel = await openTab(/People/);
      expect(within(panel).getByLabelText("Email addresses")).toBeInTheDocument();
      fireEvent.click(within(panel).getByRole("button", { name: /Copy invite link/ }));
      if (outcome === "success") {
        expect(await within(panel).findByRole("status")).toHaveTextContent("Share link copied.");
        expect(writeText).toHaveBeenCalledWith("https://example.test/invite");
        expect(within(panel).queryByLabelText("Invite link to copy")).not.toBeInTheDocument();
      } else {
        expect(await within(panel).findByRole("alert")).toHaveTextContent("Automatic copying is unavailable");
        expect(within(panel).getByLabelText("Invite link to copy")).toHaveValue("https://example.test/invite");
        expect(within(panel).queryByText("Share link copied.")).not.toBeInTheDocument();
      }
    } finally {
      if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
      else Reflect.deleteProperty(navigator, "clipboard");
    }
  });
});


describe("showtime review recovery", () => {
  it.each(["completed", "cancelled"] as const)("keeps showtimes review-only after a night is %s", async status => {
    vi.mocked(getMovieNight).mockResolvedValue(withShowtimes(status));
    render(<EventAdmin />);
    const panel = await openTab(/Showtimes/);
    expect(within(panel).getByRole("button", { name: "Import showtimes" })).toBeDisabled();
    expect(within(panel).getByRole("button", { name: "Select all visible" })).toBeDisabled();
    expect(within(panel).getAllByRole("button", { name: /^Reject / }).every(button => button.hasAttribute("disabled"))).toBe(true);
    expect(within(panel).getByLabelText("Status")).toBeEnabled();
  });

  it("shows approval errors beside the affected showtime without losing the filters", async () => {
    const fixture = withShowtimes(); fixture.showtimes[0].status = "imported";
    vi.mocked(getMovieNight).mockResolvedValue(fixture);
    vi.mocked(approveShowtimeCandidate).mockRejectedValue(new Error("Approval failed. Try again."));
    render(<EventAdmin />);
    const panel = await openTab(/Showtimes/);
    fireEvent.change(within(panel).getByLabelText("Status"), { target: { value: "imported" } });
    const approve = within(panel).getByRole("button", { name: /^Approve Music Box/ });
    fireEvent.click(approve);
    const alert = await within(panel).findByRole("alert");
    expect(alert).toHaveTextContent("Approval failed. Try again.");
    expect(approve.closest(".rounded-lg")).toContainElement(alert);
    expect(within(panel).getByLabelText("Status")).toHaveValue("imported");
  });
});


describe("release-aware planning dates", () => {
  it("fills missing dates from the film release date", async () => {
    const fixture = night("planning");
    fixture.movieNight.targetDate = undefined;
    fixture.movieNight.movie.releaseDate = "2099-12-18";
    vi.mocked(getMovieNight).mockResolvedValue(fixture);
    render(<EventAdmin />);
    const panel = await openTab(/Setup/);
    expect(within(panel).getAllByLabelText("Target date").every(input => (input as HTMLInputElement).value === "2099-12-18")).toBe(true);
    expect(within(panel).getByLabelText("Window start")).toHaveValue("2099-12-18");
    expect(within(panel).getByLabelText("Window end")).toHaveValue("2099-12-18");
  });

  it("preserves existing saved dates", async () => {
    const fixture = withShowtimes();
    fixture.movieNight.movie.releaseDate = "2098-12-18";
    vi.mocked(getMovieNight).mockResolvedValue(fixture);
    render(<EventAdmin />);
    const panel = await openTab(/Setup/);
    expect(within(panel).getByLabelText("Window start")).toHaveValue("2099-01-01");
    expect(within(panel).getByLabelText("Window end")).toHaveValue("2099-01-01");
  });

  it("updates defaults when switching films and retains a later custom window", async () => {
    navigation.params.movieNightId = undefined;
    vi.mocked(discoverMovies).mockResolvedValue({ results: [
      { externalProvider: "tmdb", externalMovieId: "future", title: "Upcoming film", status: "coming_soon", releaseDate: "2099-12-18" },
      { externalProvider: "tmdb", externalMovieId: "released", title: "Released film", status: "now_playing", releaseDate: "2016-11-11" },
    ] });
    render(<EventAdmin />);
    const panel = await openTab(/Setup/);
    fireEvent.click(await within(panel).findByRole("button", { name: /Upcoming film/ }));
    expect(within(panel).getByLabelText("Window start")).toHaveValue("2099-12-18");
    fireEvent.click(within(panel).getByRole("button", { name: /Released film/ }));
    const today = new Date();
    const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    expect(within(panel).getByLabelText("Window start")).toHaveValue(day);
    fireEvent.change(within(panel).getByLabelText("Window end"), { target: { value: "2099-12-25" } });
    fireEvent.click(within(panel).getByRole("button", { name: /Upcoming film/ }));
    expect(within(panel).getByLabelText("Window start")).toHaveValue("2099-12-18");
    expect(within(panel).getByLabelText("Window end")).toHaveValue("2099-12-25");
    expect(within(panel).getAllByLabelText("Target date").every(input => (input as HTMLInputElement).value === "2099-12-18")).toBe(true);
  });
});
