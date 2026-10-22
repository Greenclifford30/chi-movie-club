import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ClubSuggestionsPage from "@/app/clubs/[clubId]/suggestions/page";
import * as api from "@/lib/movie-club-api";
import type { MovieProposal } from "@/lib/movie-club-types";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useParams: () => ({ clubId: "club" }), useRouter: () => ({ push }) }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/movie-club/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ token: "token" }) }));
vi.mock("@/lib/movie-club-api", async importOriginal => {
  const actual = await importOriginal<typeof api>();
  return { ...actual, listClubs: vi.fn(), listMovieProposals: vi.fn(), updateMovieProposal: vi.fn(), scheduleMovieProposal: vi.fn(), createMovieProposal: vi.fn(), searchMovies: vi.fn() };
});
const proposal: MovieProposal = { clubId: "club", proposalId: "p1", proposedByUserId: "author", proposerName: "Member", viewerCanWithdraw: true, movie: { provider: "tmdb", externalId: "1", title: "Heat" }, status: "open", endorsementCount: 2, viewerHasEndorsed: false, reason: "Original", version: 3 };

beforeEach(() => {
  vi.mocked(api.listClubs).mockResolvedValue({ clubs: [{ clubId: "club", name: "Club", role: "admin" }], isPlatformAdmin: false });
  vi.mocked(api.listMovieProposals).mockResolvedValue({ proposals: [proposal] });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("film proposal controls", () => {
  it("shows an empty search state only after a completed search", async () => {
    vi.mocked(api.searchMovies).mockResolvedValue({ results: [] });
    render(<ClubSuggestionsPage />);
    await screen.findByText("Heat");
    fireEvent.change(screen.getByLabelText("Search movie titles"), { target: { value: "Missing film" } });
    expect(screen.queryByText("No films found. Try another title.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Search movies" }));
    expect(await screen.findByText("No films found. Try another title.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search movie titles"), { target: { value: "Another film" } });
    expect(screen.queryByText("No films found. Try another title.")).not.toBeInTheDocument();
  });
  it("describes the selected status when the filtered list is empty", async () => {
    vi.mocked(api.listMovieProposals).mockResolvedValue({ proposals: [] });
    render(<ClubSuggestionsPage />);
    await screen.findByText("No film suggestions yet");
    fireEvent.change(screen.getByRole("combobox", { name: "Suggestion status" }), { target: { value: "scheduled" } });
    expect(await screen.findByRole("heading", { name: "No scheduled suggestions" })).toBeInTheDocument();
    expect(screen.queryByText("Start the list with a film you would like to watch together.")).not.toBeInTheDocument();
  });
  it("shows the full release date when a release year is also present", async () => {
    vi.mocked(api.listMovieProposals).mockResolvedValue({ proposals: [{ ...proposal, movie: { ...proposal.movie, releaseDate: "2026-12-18", releaseYear: "2026" } }] });
    render(<ClubSuggestionsPage />);
    const date = await screen.findByText("Dec 18, 2026");
    expect(date).toHaveAttribute("datetime", "2026-12-18");
    expect(screen.getByText(/Suggested by Member/)).toBeInTheDocument();
  });
  it("edits an author's reason with its version", async () => {
    vi.mocked(api.updateMovieProposal).mockResolvedValue({ proposal: { ...proposal, reason: "Updated", version: 4 } });
    render(<ClubSuggestionsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit reason" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Suggestion reason" }), { target: { value: "Updated" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.updateMovieProposal).toHaveBeenCalledWith("token", "club", "p1", { reason: "Updated", version: 3 }));
  });
  it("requires a dismissal reason and refreshes after a stale version", async () => {
    vi.mocked(api.updateMovieProposal).mockRejectedValue(new api.MovieClubApiError("Reload this suggestion", 409));
    render(<ClubSuggestionsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Dismiss" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Dismissal reason" }), { target: { value: "Outside club scope" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Reload this suggestion")).toBeInTheDocument();
    expect(api.updateMovieProposal).toHaveBeenCalledWith("token", "club", "p1", { status: "dismissed", moderationReason: "Outside club scope", version: 3 });
    await waitFor(() => expect(api.listMovieProposals).toHaveBeenCalledTimes(2));
  });
  it("retains the scheduling key and payload after an uncertain failure", async () => {
    vi.mocked(api.scheduleMovieProposal).mockRejectedValueOnce(new Error("Network interrupted")).mockResolvedValueOnce({ proposal: { ...proposal, status: "scheduled" }, movieNight: { clubId: "club", movieNightId: "night", status: "planning", movie: proposal.movie } });
    render(<ClubSuggestionsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Schedule movie night" }));
    fireEvent.change(screen.getByLabelText("Target date"), { target: { value: "2099-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Create linked movie night" }));
    expect(await screen.findByText("Network interrupted")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create linked movie night" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/clubs/club/movie-nights/night/admin"));
    const calls = vi.mocked(api.scheduleMovieProposal).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][3]).toEqual(calls[1][3]);
    expect(calls[0][3]).toMatchObject({ version: 3, targetDate: "2099-01-01", idempotencyKey: expect.any(String) });
  });
  it("paginates and retains attribution and event links for scheduled suggestions", async () => {
    vi.mocked(api.listMovieProposals).mockImplementation(async (_token, _club, status, options) => status === "scheduled" ? { proposals: [{ ...proposal, status: "scheduled", movieNightId: "scheduled-night" }] } : options?.cursor ? { proposals: [{ ...proposal, proposalId: "p2", movie: { ...proposal.movie, title: "Thief" } }] } : { proposals: [proposal], nextCursor: "next" });
    render(<ClubSuggestionsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Load more suggestions" }));
    expect(await screen.findByText("Thief")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Suggestion status" }), { target: { value: "scheduled" } });
    expect(await screen.findByRole("link", { name: "View scheduled movie night" })).toHaveAttribute("href", "/clubs/club/movie-nights/scheduled-night");
    expect(screen.getByText(/Suggested by Member/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Schedule movie night" })).not.toBeInTheDocument();
  });
  it("points duplicate proposals at the existing suggestion", async () => {
    vi.mocked(api.searchMovies).mockResolvedValue({ results: [proposal.movie] });
    vi.mocked(api.createMovieProposal).mockRejectedValue(new api.MovieClubApiError("Already suggested", 409, undefined, "p2"));
    vi.mocked(api.listMovieProposals).mockImplementation(async (_token, _club, status, options) => status === "scheduled" ? { proposals: [] } : options?.cursor ? { proposals: [{ ...proposal, proposalId: "p2", movie: { ...proposal.movie, title: "Thief" } }] } : { proposals: [proposal], nextCursor: "next" });
    render(<ClubSuggestionsPage />);
    await screen.findByText("Heat");
    fireEvent.change(screen.getByRole("combobox", { name: "Suggestion status" }), { target: { value: "scheduled" } });
    await waitFor(() => expect(api.listMovieProposals).toHaveBeenLastCalledWith("token", "club", "scheduled"));
    fireEvent.change(screen.getByLabelText("Search movie titles"), { target: { value: "Heat" } });
    fireEvent.click(screen.getByRole("button", { name: "Search movies" }));
    await screen.findByRole("button", { name: /Heat.*Release date TBD/ });
    fireEvent.click(screen.getByRole("button", { name: /Heat.*Release date TBD/ }));
    fireEvent.click(screen.getByRole("button", { name: "Suggest film" }));
    expect(await screen.findByRole("link", { name: "View the existing suggestion" })).toHaveAttribute("href", "#proposal-p2");
    expect(await screen.findByText("Thief")).toBeInTheDocument();
  });
});


describe("release-aware suggestion scheduling", () => {
  it("prefills and submits the movie release date instead of today", async () => {
    vi.mocked(api.listMovieProposals).mockResolvedValue({ proposals: [{ ...proposal, movie: { ...proposal.movie, releaseDate: "2099-12-18" } }] });
    vi.mocked(api.scheduleMovieProposal).mockResolvedValue({ proposal, movieNight: { clubId: "club", movieNightId: "night", status: "planning", movie: proposal.movie } });
    render(<ClubSuggestionsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Schedule movie night" }));
    for (const label of ["Target date", "Window start", "Window end"]) expect(screen.getByLabelText(label)).toHaveValue("2099-12-18");
    fireEvent.click(screen.getByRole("button", { name: "Create linked movie night" }));
    await waitFor(() => expect(api.scheduleMovieProposal).toHaveBeenCalledWith("token", "club", "p1", expect.objectContaining({ targetDate: "2099-12-18", dateWindowStart: "2099-12-18", dateWindowEnd: "2099-12-18" })));
  });

  it("preserves custom scheduling dates when closing and reopening the form", async () => {
    vi.mocked(api.listMovieProposals).mockResolvedValue({ proposals: [{ ...proposal, movie: { ...proposal.movie, releaseDate: "2099-12-18" } }] });
    render(<ClubSuggestionsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Schedule movie night" }));
    fireEvent.change(screen.getByLabelText("Target date"), { target: { value: "2099-12-22" } });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Schedule movie night" }));
    expect(screen.getByLabelText("Target date")).toHaveValue("2099-12-22");
    expect(screen.getByLabelText("Window start")).toHaveValue("2099-12-22");
    expect(screen.getByLabelText("Window end")).toHaveValue("2099-12-22");
  });
});
