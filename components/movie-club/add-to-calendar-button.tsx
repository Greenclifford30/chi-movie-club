"use client";

import { CalendarPlus, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createGoogleCalendarUrl } from "@/lib/calendar/movie-night-calendar-event";
import { downloadMovieNightCalendar, MovieClubApiError } from "@/lib/movie-club-api";
import type { MovieNight, MovieNightStatus, Showtime } from "@/lib/movie-club-types";

type AddToCalendarButtonProps = {
  movieNight: MovieNight;
  showtime: Showtime;
  status: MovieNightStatus;
  token: string;
  identityProvider: "google" | "cognito" | null;
};

export function AddToCalendarButton({ movieNight, showtime, status, token, identityProvider }: AddToCalendarButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (status !== "confirmed" && status !== "cancelled") return null;
  async function handleDownload() {
    if (identityProvider === "google" && status !== "cancelled" && (movieNight.planRevision ?? 1) <= 1) {
      setError(null);
      try {
        const url = createGoogleCalendarUrl({
          movieNight,
          showtime,
          url: `${window.location.origin}/clubs/${encodeURIComponent(movieNight.clubId)}/movie-nights/${encodeURIComponent(movieNight.movieNightId)}`,
        });
        window.open(url, "_blank", "noopener,noreferrer");
      } catch {
        setError("Unable to open Google Calendar for this Movie Night.");
      }
      return;
    }
    setLoading(true); setError(null);
    try {
      const { blob, filename } = await downloadMovieNightCalendar(token, movieNight.movieNightId);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a"); anchor.href = objectUrl; anchor.download = filename; anchor.click(); URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      setError(downloadError instanceof MovieClubApiError ? downloadError.message : "Unable to download the calendar file.");
    } finally { setLoading(false); }
  }
  return <div className="flex w-full flex-col items-stretch gap-1 md:w-auto md:items-end">
    <Button type="button" onClick={handleDownload} disabled={loading} variant="outline" aria-label={status === "cancelled" ? "Download cancelled Movie Night calendar entry" : (movieNight.planRevision ?? 1) > 1 ? "Download updated Movie Night calendar entry" : identityProvider === "google" ? "Add this confirmed Movie Night to Google Calendar" : "Add this confirmed Movie Night to your calendar"} className="min-h-11 w-full border-green-300/30 bg-white/5 text-green-50 hover:bg-green-400/10 md:w-auto">
      {loading ? <Loader2 className="size-4 animate-spin" /> : <CalendarPlus className="size-4" />} {status === "cancelled" ? "Download cancelled calendar entry" : (movieNight.planRevision ?? 1) > 1 ? "Download updated calendar entry" : identityProvider === "google" ? "Add to Google Calendar" : "Add to calendar"}
    </Button>
    <p className="max-w-sm text-xs text-slate-400">Calendar imports do not update automatically. Update or remove your previous entry when the plan changes.</p>
    {error ? <p role="alert" className="text-xs text-rose-200">{error}</p> : null}
  </div>;
}
