import { format, parseISO } from "date-fns";
import type { Showtime } from "@/lib/movie-club-types";

export function formatDate(value?: string, pattern = "EEE, MMM d") {
  if (!value) {
    return "Date TBD";
  }

  try {
    return format(parseISO(value), pattern);
  } catch {
    return value;
  }
}

export function formatTime(value?: string) {
  if (!value) {
    return "Time TBD";
  }

  try {
    return format(parseISO(value), "h:mm a");
  } catch {
    return value;
  }
}

export function showtimeDateTime(showtime: Showtime) {
  return showtime.localDateTime || showtime.startsAtUtc;
}

export function showtimeLabel(showtime: Showtime) {
  const value = showtimeDateTime(showtime);
  return [
    showtime.theaterName,
    formatDate(value),
    formatTime(value),
    showtime.screenFormat || "Standard",
  ].join(" / ");
}

export function posterUrl(movie: { posterUrl?: string; posterPath?: string }) {
  if (movie.posterUrl) {
    return movie.posterUrl;
  }
  if (movie.posterPath) {
    return movie.posterPath.startsWith("http")
      ? movie.posterPath
      : `https://image.tmdb.org/t/p/w500${movie.posterPath}`;
  }
  return "";
}
