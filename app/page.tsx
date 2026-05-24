'use client';

import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Film,
  Loader2,
  MapPin,
  Sparkles,
  Ticket,
  Users,
  Vote,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeToggle } from "@/components/theme-toggle";

interface MovieOption {
  movieId: number;
  movieTitle: string;
  showDate: string;
  theaters: {
    name: string;
    formats: {
      type: string;
      slots: {
        date: string;
        time: string;
      }[];
    }[];
  }[];
}

interface ShowtimeSlot {
  id: string;
  theater: string;
  time: string;
  format: string;
  date: string;
}

const rankLabels = [
  { label: "First choice", points: "3 pts" },
  { label: "Second choice", points: "2 pts" },
  { label: "Third choice", points: "1 pt" },
];

function formatDate(date: string, pattern = "EEE, MMM d") {
  try {
    return format(parseISO(date), pattern);
  } catch {
    return date;
  }
}

function showtimeLabel(showtime: ShowtimeSlot) {
  return `${showtime.theater} · ${formatDate(showtime.date)} · ${showtime.time} · ${showtime.format}`;
}

export default function HomePage() {
  const [movieOptions, setMovieOptions] = useState<MovieOption[]>([]);
  const [posterPath, setPosterPath] = useState<string | null>(null);
  const [showtimes, setShowtimes] = useState<ShowtimeSlot[]>([]);
  const [rankings, setRankings] = useState<string[]>(["", "", ""]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voteSaved, setVoteSaved] = useState(false);

  useEffect(() => {
    const TMDB_ACCESS_TOKEN = process.env.NEXT_PUBLIC_TMDB_API_KEY;

    async function loadMovieNight() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/showtimes");

        if (!response.ok) {
          throw new Error("Showtime service is not configured yet.");
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error(data?.error || "No movie night is available right now.");
        }

        setMovieOptions(data);

        const parsed: ShowtimeSlot[] = [];
        data.forEach((option: MovieOption) => {
          option.theaters.forEach((theater) => {
            theater.formats.forEach((screenFormat) => {
              screenFormat.slots.forEach((slot, index) => {
                parsed.push({
                  id: `${theater.name}-${slot.date}-${slot.time}-${screenFormat.type}-${index}`,
                  theater: theater.name,
                  time: slot.time,
                  format: screenFormat.type,
                  date: slot.date,
                });
              });
            });
          });
        });
        setShowtimes(parsed);

        if (data.length > 0 && data[0].movieTitle && TMDB_ACCESS_TOKEN) {
          const tmdbResponse = await fetch(
            `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(data[0].movieTitle)}`,
            {
              headers: {
                Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
                Accept: "application/json",
              },
            }
          );
          const tmdbData = await tmdbResponse.json();
          setPosterPath(tmdbData.results?.[0]?.poster_path ?? null);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load movie night.");
        setMovieOptions([]);
        setShowtimes([]);
      } finally {
        setIsLoading(false);
      }
    }

    loadMovieNight();
  }, []);

  const movieTitle = movieOptions[0]?.movieTitle ?? "This Week's Movie";
  const uniqueDates = useMemo(
    () => [...new Set(showtimes.map((showtime) => showtime.date))].sort(),
    [showtimes]
  );
  const groupedShowtimes = useMemo(() => {
    return showtimes.reduce<Record<string, ShowtimeSlot[]>>((acc, showtime) => {
      acc[showtime.theater] = acc[showtime.theater] || [];
      acc[showtime.theater].push(showtime);
      return acc;
    }, {});
  }, [showtimes]);

  const selectedShowtimes = rankings
    .map((ranking) => showtimes.find((showtime) => showtime.id === ranking))
    .filter(Boolean) as ShowtimeSlot[];

  const updateRanking = (rankIndex: number, showtimeId: string) => {
    setVoteSaved(false);
    setRankings((current) => {
      const next = [...current];
      next[rankIndex] = showtimeId === "none" ? "" : showtimeId;
      return next;
    });
  };

  const selectedCount = rankings.filter(Boolean).length;

  return (
    <main className="min-h-screen text-slate-50">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#111827]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-white">
              <Film className="size-5" />
              <span>Movie Club</span>
            </Link>
            <nav className="hidden items-center gap-4 text-sm md:flex">
              <Link href="/" className="border-b border-white pb-1 font-medium text-white">
                Active Night
              </Link>
              <span className="text-slate-400">History</span>
              <Link href="/admin" className="text-slate-400 transition hover:text-white">
                Admin
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="hidden border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 md:inline-flex">
              The Cinephiles
              <ChevronDown className="size-4" />
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="mb-6 rounded-lg border border-violet-400/30 bg-violet-500/10 p-4 shadow-2xl shadow-violet-950/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-violet-400/20 p-2 text-violet-200">
                <Vote className="size-5" />
              </div>
              <div>
                <p className="font-semibold text-violet-100">Voting is open. Rank your top 3 showtimes.</p>
                <p className="mt-1 text-sm text-slate-300">Your selections stay local for this prototype and can be changed before confirmation.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Users className="size-4 text-cyan-300" />
              <span>8 members invited</span>
            </div>
          </div>
        </section>

        {isLoading ? (
          <section className="grid min-h-[520px] place-items-center rounded-lg border border-white/10 bg-slate-900/70">
            <div className="flex flex-col items-center gap-3 text-slate-300">
              <Loader2 className="size-8 animate-spin text-cyan-300" />
              <p>Loading the active movie night...</p>
            </div>
          </section>
        ) : error ? (
          <section className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-6">
            <p className="font-semibold text-rose-100">Movie night could not load</p>
            <p className="mt-2 text-sm text-slate-300">{error}</p>
          </section>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <section className="lg:col-span-8">
              <div className="overflow-hidden rounded-lg border border-white/10 bg-slate-900/80 shadow-2xl shadow-black/30">
                <div className="grid grid-cols-1 md:grid-cols-[260px_1fr]">
                  <div className="relative min-h-[390px] bg-slate-950">
                    {posterPath ? (
                      <Image
                        src={`https://image.tmdb.org/t/p/w500${posterPath}`}
                        alt={movieTitle}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 260px"
                        priority
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-slate-950 text-slate-500">
                        <Film className="size-16" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                  </div>
                  <div className="relative p-6 md:p-8">
                    <div className="mb-5 flex flex-wrap gap-2">
                      <span className="rounded border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-xs font-medium text-cyan-200">Active Session</span>
                      <span className="rounded border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-xs font-medium text-amber-200">Chicago area</span>
                    </div>
                    <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-white md:text-5xl">{movieTitle}</h1>
                    <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                      Compare theater times, formats, and date options with the group. Pick up to three favorites and the host can confirm the winning plan.
                    </p>
                    <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                        <CalendarDays className="mb-3 size-5 text-amber-300" />
                        <p className="text-xs text-slate-400">Date range</p>
                        <p className="mt-1 font-medium text-white">
                          {uniqueDates.length > 0 ? `${formatDate(uniqueDates[0])} - ${formatDate(uniqueDates[uniqueDates.length - 1])}` : "TBA"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                        <Ticket className="mb-3 size-5 text-cyan-300" />
                        <p className="text-xs text-slate-400">Candidates</p>
                        <p className="mt-1 font-medium text-white">{showtimes.length} showtimes</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                        <Sparkles className="mb-3 size-5 text-violet-300" />
                        <p className="text-xs text-slate-400">Format mix</p>
                        <p className="mt-1 font-medium text-white">{new Set(showtimes.map((item) => item.format)).size || 0} formats</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <section className="mt-6 space-y-4">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold text-white">Candidate showtimes</h2>
                    <p className="mt-1 text-sm text-slate-400">Theater and format options currently available for voting.</p>
                  </div>
                </div>

                {Object.keys(groupedShowtimes).length === 0 ? (
                  <Card className="border-white/10 bg-slate-900/70">
                    <CardContent>
                      <p className="text-slate-300">No showtimes are attached to this movie night yet.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {Object.entries(groupedShowtimes).map(([theater, theaterShowtimes]) => (
                      <Card key={theater} className="border-white/10 bg-slate-900/80 py-5 shadow-xl shadow-black/20">
                        <CardHeader className="px-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="font-semibold text-white">{theater}</h3>
                              <p className="mt-1 flex items-center gap-1 text-sm text-slate-400">
                                <MapPin className="size-3.5" />
                                Chicago area
                              </p>
                            </div>
                            <span className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300">
                              {theaterShowtimes.length} slots
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 gap-2 px-5 sm:grid-cols-2">
                          {theaterShowtimes.slice(0, 6).map((showtime) => (
                            <div key={showtime.id} className="rounded border border-white/10 bg-slate-950/50 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-mono text-sm text-white">{showtime.time}</span>
                                <span className="rounded bg-amber-400/10 px-2 py-0.5 text-xs font-medium text-amber-200">{showtime.format}</span>
                              </div>
                              <p className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                                <Clock className="size-3" />
                                {formatDate(showtime.date, "EEEE, MMM d")}
                              </p>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            </section>

            <aside className="lg:col-span-4">
              <Card className="sticky top-24 border-violet-300/20 bg-slate-900/90 py-6 shadow-2xl shadow-violet-950/20">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-white p-2 text-slate-950">
                      <Vote className="size-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-white">Rank your showtimes</h2>
                      <p className="text-sm text-slate-400">Pick up to 3. No duplicate selections.</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {rankLabels.map((rank, index) => {
                    const unavailable = rankings.filter((id, rankingIndex) => id && rankingIndex !== index);

                    return (
                      <div key={rank.label} className="rounded-lg border border-white/10 bg-white/5 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="grid size-8 place-items-center rounded-full bg-white text-sm font-semibold text-slate-950">{index + 1}</span>
                            <div>
                              <p className="font-medium text-white">{rank.label}</p>
                              <p className="text-xs text-slate-400">{rank.points}</p>
                            </div>
                          </div>
                        </div>
                        <Select value={rankings[index] || "none"} onValueChange={(value) => updateRanking(index, value)}>
                          <SelectTrigger className="border-white/10 bg-slate-950/60 text-left text-slate-100">
                            <SelectValue placeholder="Choose a showtime" />
                          </SelectTrigger>
                          <SelectContent className="border-white/10 bg-slate-950 text-slate-100">
                            <SelectItem value="none">No selection</SelectItem>
                            {showtimes.map((showtime) => (
                              <SelectItem key={showtime.id} value={showtime.id} disabled={unavailable.includes(showtime.id)}>
                                {showtimeLabel(showtime)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}

                  {selectedShowtimes.length > 0 && (
                    <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4">
                      <p className="mb-2 text-sm font-medium text-cyan-100">Current ballot</p>
                      <ol className="space-y-2 text-sm text-slate-300">
                        {selectedShowtimes.map((showtime, index) => (
                          <li key={showtime.id}>
                            {index + 1}. {showtimeLabel(showtime)}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {voteSaved && (
                    <div className="flex items-center gap-2 rounded-lg border border-green-400/30 bg-green-400/10 p-3 text-sm text-green-200">
                      <CheckCircle2 className="size-4" />
                      Vote saved for this session.
                    </div>
                  )}

                  <Button
                    className="h-11 w-full rounded-lg bg-white font-semibold text-slate-950 hover:bg-slate-200"
                    disabled={selectedCount === 0}
                    onClick={() => setVoteSaved(true)}
                  >
                    Save rankings
                  </Button>
                  <p className="text-center text-xs text-slate-500">{selectedCount}/3 choices selected</p>
                </CardContent>
              </Card>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
