import "server-only";

import type { MovieNight, Showtime } from "@/lib/movie-club-types";

const FALLBACK_RUNTIME_MINUTES = 120;
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
  const { movieNight, showtime } = input;
  const title = movieNight.movie.title?.trim();
  if (!title) throw new Error("Movie title is missing.");

  const start = new Date(showtime.startsAtUtc);
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(showtime.startsAtUtc) || Number.isNaN(start.getTime())) {
    throw new Error("Confirmed showtime timestamp is invalid.");
  }

  const runtime = movieNight.movie.runtime;
  const hasRuntime = typeof runtime === "number" && Number.isFinite(runtime) && runtime > 0;
  const duration = hasRuntime ? runtime : FALLBACK_RUNTIME_MINUTES;
  const end = new Date(start.getTime() + duration * 60_000);
  const format = showtime.screenFormat?.trim();
  const location = [showtime.theaterName, showtime.theaterAddress || showtime.theaterLocation]
    .filter(Boolean)
    .join(", ");
  const description = [
    "Confirmed through Movie Club.",
    !hasRuntime ? "End time estimated using a 120-minute runtime because movie runtime metadata was unavailable." : "",
    `View Movie Night: ${input.url}`,
  ].filter(Boolean).join("\n");
  const stampSource = movieNight.updatedAt || movieNight.confirmedAt;
  const stamp = stampSource && !Number.isNaN(new Date(stampSource).getTime())
    ? new Date(stampSource)
    : input.now || new Date();
  const summary = format ? `${title} — ${format}` : title;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "PRODID:-//Movie Club//Confirmed Movie Night//EN",
    "BEGIN:VEVENT",
    `UID:${escapeText(`movie-night-${movieNight.movieNightId}@movieclub`)}`,
    `DTSTAMP:${utcTimestamp(stamp.toISOString(), "DTSTAMP")}`,
    `DTSTART:${utcTimestamp(showtime.startsAtUtc, "DTSTART")}`,
    `DTEND:${utcTimestamp(end.toISOString(), "DTEND")}`,
    `SEQUENCE:${typeof movieNight.calendarSequence === "number" && Number.isInteger(movieNight.calendarSequence) && movieNight.calendarSequence >= 0 ? movieNight.calendarSequence : 0}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    `SUMMARY:${escapeText(summary)}`,
    `LOCATION:${escapeText(location)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `URL:${escapeText(input.url)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return { content: lines.map(foldLine).join("\r\n") + "\r\n", filename: safeFilename(title) };
}
