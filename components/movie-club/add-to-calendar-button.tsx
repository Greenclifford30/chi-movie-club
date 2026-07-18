"use client";

import { CalendarPlus, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { downloadMovieNightCalendar, MovieClubApiError } from "@/lib/movie-club-api";
import type { MovieNightStatus } from "@/lib/movie-club-types";

export function AddToCalendarButton({ movieNightId, status, token }: { movieNightId: string; status: MovieNightStatus; token: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (status !== "confirmed") return null;
  async function handleDownload() {
    setLoading(true); setError(null);
    try {
      const { blob, filename } = await downloadMovieNightCalendar(token, movieNightId);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a"); anchor.href = objectUrl; anchor.download = filename; anchor.click(); URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      setError(downloadError instanceof MovieClubApiError ? downloadError.message : "Unable to download the calendar file.");
    } finally { setLoading(false); }
  }
  return <div className="flex flex-col items-end gap-1">
    <Button type="button" onClick={handleDownload} disabled={loading} variant="outline" aria-label="Add this confirmed Movie Night to your calendar" className="min-h-11 border-green-300/30 bg-white/5 text-green-50 hover:bg-green-400/10">
      {loading ? <Loader2 className="size-4 animate-spin" /> : <CalendarPlus className="size-4" />} Add to calendar
    </Button>
    {error ? <p role="alert" className="text-xs text-rose-200">{error}</p> : null}
  </div>;
}
