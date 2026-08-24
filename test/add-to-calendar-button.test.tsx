import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AddToCalendarButton } from "@/components/movie-club/add-to-calendar-button";
import { downloadMovieNightCalendar } from "@/lib/movie-club-api";

vi.mock("@/lib/movie-club-api", () => ({ downloadMovieNightCalendar: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const movieNight = {
  clubId: "club-1",
  movieNightId: "mn-1",
  status: "confirmed" as const,
  movie: { provider: "tmdb", externalId: "1", title: "Dune", runtime: 150 },
};
const showtime = {
  movieNightId: "mn-1",
  showtimeId: "show-1",
  theaterName: "Music Box",
  theaterAddress: "3733 N Southport Ave, Chicago",
  startsAtUtc: "2026-07-19T01:30:00Z",
  screenFormat: "IMAX",
};

describe("AddToCalendarButton", () => {
  it("renders only for confirmed movie nights", () => {
    const { rerender } = render(<AddToCalendarButton movieNight={movieNight} showtime={showtime} status="planning" token="token" identityProvider="cognito" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(<AddToCalendarButton movieNight={movieNight} showtime={showtime} status="confirmed" token="token" identityProvider="cognito" />);
    expect(screen.getByRole("button", { name: /add this confirmed movie night/i })).toBeInTheDocument();
  });

  it("opens a prefilled Google Calendar event for Google users", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<AddToCalendarButton movieNight={movieNight} showtime={showtime} status="confirmed" token="token" identityProvider="google" />);

    fireEvent.click(screen.getByRole("button", { name: /google calendar/i }));

    expect(open).toHaveBeenCalledOnce();
    const url = new URL(String(open.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("text")).toBe("Dune — IMAX");
    expect(url.searchParams.get("dates")).toBe("20260719T013000Z/20260719T040000Z");
    expect(url.searchParams.get("location")).toBe("Music Box, 3733 N Southport Ave, Chicago");
    expect(downloadMovieNightCalendar).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it("downloads an ICS event for non-Google users", async () => {
    vi.mocked(downloadMovieNightCalendar).mockResolvedValue({ blob: new Blob(["calendar"]), filename: "dune.ics" });
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:calendar");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    render(<AddToCalendarButton movieNight={movieNight} showtime={showtime} status="confirmed" token="token" identityProvider="cognito" />);

    fireEvent.click(screen.getByRole("button", { name: /your calendar/i }));

    await waitFor(() => expect(downloadMovieNightCalendar).toHaveBeenCalledWith("token", "mn-1"));
    expect(click).toHaveBeenCalledOnce();
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    click.mockRestore();
  });
});
