"use client";

import { CalendarDays, Film, Loader2, MapPin } from "lucide-react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/movie-club/app-shell";
import { useAuth } from "@/lib/auth-context";
import { listHistory } from "@/lib/movie-club-api";
import { formatDate, posterUrl } from "@/lib/movie-club-format";
import type { HistoryMovieNight } from "@/lib/movie-club-types";

export default function ClubHistoryPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const { token } = useAuth();
  const [movieNights, setMovieNights] = useState<HistoryMovieNight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!token) {
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const result = await listHistory(token, clubId);
        setMovieNights(result.movieNights);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load history.");
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [clubId, token]);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <section className="mb-8 border-b border-white/10 pb-6">
          <p className="mb-2 flex items-center gap-2 text-sm text-cyan-300">
            <CalendarDays className="size-4" />
            Club history
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Past movie nights</h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            Completed and confirmed events stay attached to the club for later reference.
          </p>
        </section>

        {isLoading ? (
          <section className="grid min-h-[360px] place-items-center rounded-lg border border-white/10 bg-slate-900/70">
            <div className="flex flex-col items-center gap-3 text-slate-300">
              <Loader2 className="size-8 animate-spin text-cyan-300" />
              <p>Loading history...</p>
            </div>
          </section>
        ) : error ? (
          <section className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-6 text-rose-100">{error}</section>
        ) : movieNights.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {movieNights.map((night) => {
              const image = posterUrl(night.movie);
              return (
                <article key={night.movieNightId} className="overflow-hidden rounded-lg border border-white/10 bg-slate-900/80 shadow-2xl shadow-black/20">
                  <div className="relative h-56 bg-slate-950 sm:h-72">
                    {image ? (
                      <Image src={image} alt={night.movie.title} fill sizes="360px" className="object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-slate-500">
                        <Film className="size-16" />
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="rounded bg-cyan-400/10 px-2 py-1 text-xs font-medium text-cyan-100">{night.status}</span>
                      <span className="text-xs text-slate-500">{formatDate(night.targetDate)}</span>
                    </div>
                    <h2 className="text-xl font-semibold text-white">{night.movie.title}</h2>
                    <p className="mt-3 flex items-center gap-2 text-sm text-slate-400">
                      <MapPin className="size-4" />
                      {night.confirmedShowtime?.theaterName || "Theater TBD"}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <section className="rounded-lg border border-white/10 bg-slate-900/70 p-6">
            <p className="font-semibold text-white">No history yet</p>
            <p className="mt-2 text-sm text-slate-400">Confirmed or completed movie nights will appear here.</p>
          </section>
        )}
      </div>
    </AppShell>
  );
}
