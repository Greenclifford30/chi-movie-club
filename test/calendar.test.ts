import { describe, expect, it } from "vitest";
import { createMovieNightCalendar } from "@/lib/calendar/create-movie-night-calendar";

const base = {
  movieNight: { movieNightId: "mn-1", clubId: "club-1", calendarSequence: 3, confirmedAt: "2026-07-18T00:00:00Z", movie: { provider: "tmdb", externalId: "1", title: "Dune, Part; Three", runtime: 150 } },
  showtime: { theaterName: "Music Box", theaterAddress: "3733 N Southport Ave, Chicago", startsAtUtc: "2026-07-19T01:30:00Z", screenFormat: "IMAX" },
  url: "https://movieclub.example/clubs/club-1",
};

describe("createMovieNightCalendar", () => {
  it("creates stable escaped UTC content", () => {
    const result = createMovieNightCalendar(base);
    expect(result.filename).toBe("dune-part-three.ics");
    expect(result.content).toContain("UID:movie-night-mn-1@movieclub");
    expect(result.content).toContain("SEQUENCE:3");
    expect(result.content).toContain("DTSTART:20260719T013000Z");
    expect(result.content).toContain("DTEND:20260719T040000Z");
    expect(result.content).toContain("SUMMARY:Dune\\, Part\\; Three — IMAX");
    expect(result.content.split("\r\n").every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
  });
  it("omits missing format and documents the runtime fallback", () => {
    const result = createMovieNightCalendar({ ...base, movieNight: { ...base.movieNight, movie: { ...base.movieNight.movie, runtime: null } }, showtime: { ...base.showtime, screenFormat: "" }, now: new Date("2026-07-18T00:00:00Z") });
    expect(result.content).toContain("SUMMARY:Dune\\, Part\\; Three\r\n");
    expect(result.content.replace(/\r\n ?/g, "")).toContain("estimated using a 120-minute runtime");
    expect(result.content).toContain("DTEND:20260719T033000Z");
  });
  it("folds long multibyte content without exceeding 75 UTF-8 octets", () => {
    const result = createMovieNightCalendar({ ...base, movieNight: { ...base.movieNight, movie: { ...base.movieNight.movie, title: "影".repeat(80) } } });
    const physicalLines = result.content.split("\r\n").filter(Boolean);
    expect(physicalLines.some((line) => line.startsWith(" "))).toBe(true);
    expect(physicalLines.every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
  });
});
