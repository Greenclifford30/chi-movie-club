import "server-only";

import { createMovieNightCalendarEvent } from "@/lib/calendar/movie-night-calendar-event";
import type { MovieNight, Showtime } from "@/lib/movie-club-types";

const encoder = new TextEncoder();

export type MovieNightCalendarInput = {
  movieNight: Pick<MovieNight, "movieNightId" | "clubId" | "movie" | "calendarSequence" | "updatedAt" | "confirmedAt">;
  showtime: Pick<Showtime, "theaterName" | "theaterLocation" | "theaterAddress" | "startsAtUtc" | "screenFormat">;
  url: string;
  now?: Date;
};

export type MovieNightCalendar = {
  content: string;
  filename: string;
};

function escapeText(value: unknown) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function foldLine(line: string) {
  const bytes = encoder.encode(line);
  if (bytes.length <= 75) return line;

  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    const limit = chunks.length ? 74 : 75;
    if (current && currentBytes + size > limit) {
      chunks.push(current);
      current = "";
      currentBytes = 0;
    }
    current += character;
    currentBytes += size;
  }
  if (current) chunks.push(current);
  return chunks.map((chunk, index) => (index ? ` ${chunk}` : chunk)).join("\r\n");
}

function utcTimestamp(value: string, label: string) {
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) {
    throw new Error(`${label} must include an explicit timezone offset.`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} is invalid.`);
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function safeFilename(title: string) {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${slug || "movie-night"}.ics`;
}

export function createMovieNightCalendar(input: MovieNightCalendarInput): MovieNightCalendar {
  const { movieNight } = input;
  const title = movieNight.movie.title?.trim();
  if (!title) throw new Error("Movie title is missing.");
  const event = createMovieNightCalendarEvent(input);
  const stampSource = movieNight.updatedAt || movieNight.confirmedAt;
  const stamp = stampSource && !Number.isNaN(new Date(stampSource).getTime())
    ? new Date(stampSource)
    : input.now || new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "PRODID:-//Movie Club//Confirmed Movie Night//EN",
    "BEGIN:VEVENT",
    `UID:${escapeText(`movie-night-${movieNight.movieNightId}@movieclub`)}`,
    `DTSTAMP:${utcTimestamp(stamp.toISOString(), "DTSTAMP")}`,
    `DTSTART:${utcTimestamp(event.start.toISOString(), "DTSTART")}`,
    `DTEND:${utcTimestamp(event.end.toISOString(), "DTEND")}`,
    `SEQUENCE:${typeof movieNight.calendarSequence === "number" && Number.isInteger(movieNight.calendarSequence) && movieNight.calendarSequence >= 0 ? movieNight.calendarSequence : 0}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    `SUMMARY:${escapeText(event.summary)}`,
    `LOCATION:${escapeText(event.location)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    `URL:${escapeText(event.url)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return { content: lines.map(foldLine).join("\r\n") + "\r\n", filename: safeFilename(title) };
}
