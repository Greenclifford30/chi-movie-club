import type { MovieNight, Showtime } from "@/lib/movie-club-types";

const FALLBACK_RUNTIME_MINUTES = 120;

export type MovieNightCalendarEventInput = {
  movieNight: Pick<MovieNight, "movieNightId" | "clubId" | "movie">;
  showtime: Pick<Showtime, "theaterName" | "theaterLocation" | "theaterAddress" | "startsAtUtc" | "screenFormat">;
  url: string;
};

export type MovieNightCalendarEvent = {
  summary: string;
  start: Date;
  end: Date;
  location: string;
  description: string;
  url: string;
};

function calendarTimestamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function createMovieNightCalendarEvent(input: MovieNightCalendarEventInput): MovieNightCalendarEvent {
  const title = input.movieNight.movie.title?.trim();
  if (!title) throw new Error("Movie title is missing.");

  const startsAtUtc = input.showtime.startsAtUtc;
  const start = new Date(startsAtUtc);
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(startsAtUtc) || Number.isNaN(start.getTime())) {
    throw new Error("Confirmed showtime timestamp is invalid.");
  }

  const runtime = input.movieNight.movie.runtime;
  const hasRuntime = typeof runtime === "number" && Number.isFinite(runtime) && runtime > 0;
  const end = new Date(start.getTime() + (hasRuntime ? runtime : FALLBACK_RUNTIME_MINUTES) * 60_000);
  const format = input.showtime.screenFormat?.trim();

  return {
    summary: format ? `${title} — ${format}` : title,
    start,
    end,
    location: [input.showtime.theaterName, input.showtime.theaterAddress || input.showtime.theaterLocation]
      .filter(Boolean)
      .join(", "),
    description: [
      "Confirmed through Movie Club.",
      !hasRuntime ? "End time estimated using a 120-minute runtime because movie runtime metadata was unavailable." : "",
      `View Movie Night: ${input.url}`,
    ].filter(Boolean).join("\n"),
    url: input.url,
  };
}

export function createGoogleCalendarUrl(input: MovieNightCalendarEventInput) {
  const event = createMovieNightCalendarEvent(input);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.summary,
    dates: `${calendarTimestamp(event.start)}/${calendarTimestamp(event.end)}`,
    details: event.description,
    location: event.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
