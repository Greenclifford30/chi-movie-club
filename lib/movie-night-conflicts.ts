import type { MovieNight, Showtime } from "@/lib/movie-club-types";

export function movieNightConflicts(night: MovieNight, showtime: Showtime, others: MovieNight[]) {
  const start = Date.parse(showtime.startsAtUtc);
  if (!Number.isFinite(start)) return [];
  return others.flatMap(other => {
    if (other.movieNightId === night.movieNightId || other.status !== "confirmed" || !other.confirmedShowtime) return [];
    const otherStart = Date.parse(other.confirmedShowtime.startsAtUtc);
    if (!Number.isFinite(otherStart)) return [];
    const earlier = start <= otherStart ? night : other;
    const earlierStart = Math.min(start, otherStart);
    const laterStart = Math.max(start, otherStart);
    const runtime = earlier.movie.runtime;
    const known = typeof runtime === "number" && Number.isFinite(runtime) && runtime > 0;
    if (known && earlierStart + runtime * 60000 <= laterStart) return [];
    return [{ movieNight: other, uncertain: !known && start !== otherStart }];
  });
}
