import { describe, expect, it } from "vitest";
import { createGoogleCalendarUrl } from "@/lib/calendar/movie-night-calendar-event";

const base = {
  movieNight: {
    movieNightId: "mn-1",
    clubId: "club-1",
    movie: { provider: "tmdb", externalId: "1", title: "Dune, Part Three", runtime: 150 },
  },
  showtime: {
    theaterName: "Music Box",
    theaterAddress: "3733 N Southport Ave, Chicago",
    startsAtUtc: "2026-07-19T01:30:00Z",
    screenFormat: "IMAX",
  },
  url: "https://movieclub.example/clubs/club-1",
};

describe("createGoogleCalendarUrl", () => {
  it("builds a prefilled event using the same UTC details as the ICS calendar", () => {
    const url = new URL(createGoogleCalendarUrl(base));
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("Dune, Part Three — IMAX");
    expect(url.searchParams.get("dates")).toBe("20260719T013000Z/20260719T040000Z");
    expect(url.searchParams.get("details")).toContain("https://movieclub.example/clubs/club-1");
    expect(url.searchParams.get("location")).toBe("Music Box, 3733 N Southport Ave, Chicago");
  });

  it("uses a 120-minute fallback when runtime metadata is missing", () => {
    const url = new URL(createGoogleCalendarUrl({
      ...base,
      movieNight: { ...base.movieNight, movie: { ...base.movieNight.movie, runtime: null } },
    }));
    expect(url.searchParams.get("dates")).toBe("20260719T013000Z/20260719T033000Z");
    expect(url.searchParams.get("details")).toContain("estimated using a 120-minute runtime");
  });
});
