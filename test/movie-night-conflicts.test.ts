import { describe, expect, it } from "vitest";
import { movieNightConflicts } from "@/lib/movie-night-conflicts";
import type { MovieNight, Showtime } from "@/lib/movie-club-types";

const showtime: Showtime = { movieNightId: "one", showtimeId: "s1", theaterName: "Cinema", startsAtUtc: "2099-01-01T18:00:00Z" };
const night: MovieNight = { movieNightId: "one", clubId: "club", status: "confirmed", movie: { provider: "tmdb", externalId: "1", title: "One", runtime: 120 } };
const other: MovieNight = { ...night, movieNightId: "two", confirmedShowtime: { ...showtime, movieNightId: "two", startsAtUtc: "2099-01-01T19:00:00Z" } };

describe("confirmed outing conflicts", () => {
  it("compares UTC instants and treats adjacent known endings as nonoverlapping", () => {
    expect(movieNightConflicts(night, showtime, [other])[0].uncertain).toBe(false);
    expect(movieNightConflicts(night, showtime, [{ ...other, confirmedShowtime: { ...other.confirmedShowtime!, startsAtUtc: "2099-01-01T14:00:00-06:00" } }])).toEqual([]);
  });
  it("labels unknown end times without inventing a runtime", () => {
    expect(movieNightConflicts({ ...night, movie: { ...night.movie, runtime: null } }, showtime, [other])[0].uncertain).toBe(true);
  });
  it("excludes the current event, terminal nights, and unconfirmed plans", () => {
    expect(movieNightConflicts(night, showtime, [{ ...night, confirmedShowtime: showtime }, { ...other, status: "cancelled" }, { ...other, status: "planning" }])).toEqual([]);
  });
});
