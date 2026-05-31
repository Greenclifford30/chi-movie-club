"use client";

import { CalendarDays, CheckCircle2, Clock, Film, Loader2, MapPin, Ticket, Users, Vote } from "lucide-react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/movie-club/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { formatDate, formatTime, posterUrl, showtimeDateTime, showtimeLabel } from "@/lib/movie-club-format";
import { getActiveMovieNight, submitVote, updateRsvp } from "@/lib/movie-club-api";
import type { ActiveMovieNightResponse, RsvpStatus, Showtime, TicketStatus } from "@/lib/movie-club-types";

const rankLabels = [
  { label: "First choice", points: "3 pts" },
  { label: "Second choice", points: "2 pts" },
  { label: "Third choice", points: "1 pt" },
];

export default function ActiveClubPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const { token } = useAuth();
  const [data, setData] = useState<ActiveMovieNightResponse | null>(null);
  const [rankings, setRankings] = useState<string[]>(["", "", ""]);
  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus>("going");
  const [ticketStatus, setTicketStatus] = useState<TicketStatus>("not_purchased");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!token) {
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const active = await getActiveMovieNight(token, clubId);
        setData(active);
        setRankings([
          active.currentUserVote?.rankings?.[0] || "",
          active.currentUserVote?.rankings?.[1] || "",
          active.currentUserVote?.rankings?.[2] || "",
        ]);
        if (active.currentUserRsvp) {
          setRsvpStatus(active.currentUserRsvp.status);
          setTicketStatus(active.currentUserRsvp.ticketStatus);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load the active movie night.");
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [clubId, token]);

  const groupedShowtimes = useMemo(() => {
    return (data?.showtimes || []).reduce<Record<string, Showtime[]>>((acc, showtime) => {
      acc[showtime.theaterName] = acc[showtime.theaterName] || [];
      acc[showtime.theaterName].push(showtime);
      return acc;
    }, {});
  }, [data?.showtimes]);

  const selectedCount = rankings.filter(Boolean).length;
  const movieNight = data?.movieNight;
  const movie = movieNight?.movie;
  const selectedShowtimes = rankings
    .map((ranking) => data?.showtimes.find((showtime) => showtime.showtimeId === ranking))
    .filter(Boolean) as Showtime[];
  const confirmedShowtime =
    movieNight?.confirmedShowtime ||
    data?.showtimes.find((showtime) => showtime.showtimeId === movieNight?.confirmedShowtimeId);
  const isConfirmed = movieNight?.status === "confirmed" || movieNight?.status === "completed";
  const isVoting = movieNight?.status === "voting";
  const imageUrl = movie ? posterUrl(movie) : "";

  function updateRanking(rankIndex: number, showtimeId: string) {
    setMessage(null);
    setRankings((current) => {
      const next = [...current];
      next[rankIndex] = showtimeId === "none" ? "" : showtimeId;
      return next;
    });
  }

  async function saveVote() {
    if (!token || !movieNight) {
      return;
    }

    const nextRankings = rankings.filter(Boolean);
    if (new Set(nextRankings).size !== nextRankings.length) {
      setError("A showtime can only appear once on your ballot.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await submitVote(token, movieNight.movieNightId, nextRankings);
      setData((current) => (current ? { ...current, currentUserVote: result.vote } : current));
      setMessage("Vote saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save vote.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveRsvp() {
    if (!token || !movieNight) {
      return;
    }
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await updateRsvp(token, movieNight.movieNightId, rsvpStatus, ticketStatus);
      setData((current) => (current ? { ...current, currentUserRsvp: result.rsvp } : current));
      setMessage("RSVP updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update RSVP.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {isLoading ? (
          <section className="grid min-h-[520px] place-items-center rounded-lg border border-white/10 bg-slate-900/70">
            <div className="flex flex-col items-center gap-3 text-slate-300">
              <Loader2 className="size-8 animate-spin text-cyan-300" />
              <p>Loading the active movie night...</p>
            </div>
          </section>
        ) : error && !data ? (
          <EmptyState title="Movie night could not load" description={error} />
        ) : !data || !movieNight || !movie ? (
          <EmptyState title="No active movie night" description="An admin can create the next movie night from the admin page." />
        ) : (
          <>
            <StatusBanner status={movieNight.status} />
            {error ? <Alert tone="rose">{error}</Alert> : null}
            {message ? <Alert tone="green">{message}</Alert> : null}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <section className="lg:col-span-8">
                <div className="overflow-hidden rounded-lg border border-white/10 bg-slate-900/80 shadow-2xl shadow-black/30">
                  <div className="grid grid-cols-1 md:grid-cols-[260px_1fr]">
                    <div className="relative min-h-[390px] bg-slate-950">
                      {imageUrl ? (
                        <Image src={imageUrl} alt={movie.title} fill className="object-cover" sizes="260px" />
                      ) : (
                        <div className="grid h-full place-items-center text-slate-500">
                          <Film className="size-16" />
                        </div>
                      )}
                    </div>
                    <div className="p-6 md:p-8">
                      <div className="mb-4 flex flex-wrap items-center gap-2">
                        <span className="rounded bg-violet-400/15 px-2 py-1 text-xs font-medium text-violet-100">{movieNight.status}</span>
                        <span className="rounded bg-cyan-400/10 px-2 py-1 text-xs font-medium text-cyan-100">{movie.releaseYear || "Release year TBD"}</span>
                      </div>
                      <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">{movie.title}</h1>
                      <p className="mt-4 max-w-2xl text-slate-300">{movie.overview || "Movie details will appear here once the admin saves a full movie snapshot."}</p>
                      <div className="mt-6 grid gap-3 sm:grid-cols-3">
                        <Stat icon={<CalendarDays className="size-5 text-amber-300" />} label="Target" value={formatDate(movieNight.targetDate)} />
                        <Stat icon={<Ticket className="size-5 text-cyan-300" />} label="Options" value={`${data.showtimes.length} showtimes`} />
                        <Stat icon={<Users className="size-5 text-violet-300" />} label="Mode" value={movieNight.movieSelectionMode || "admin_selected"} />
                      </div>
                    </div>
                  </div>
                </div>

                {isConfirmed && confirmedShowtime ? (
                  <section className="mt-6 rounded-lg border border-green-400/25 bg-green-500/10 p-5">
                    <p className="mb-2 flex items-center gap-2 font-semibold text-green-100">
                      <CheckCircle2 className="size-5" />
                      Movie night confirmed
                    </p>
                    <h2 className="text-2xl font-semibold text-white">{confirmedShowtime.theaterName}</h2>
                    <p className="mt-2 text-slate-300">
                      {formatDate(showtimeDateTime(confirmedShowtime), "EEEE, MMMM d")} at {formatTime(showtimeDateTime(confirmedShowtime))} / {confirmedShowtime.screenFormat || "Standard"}
                    </p>
                  </section>
                ) : null}

                <section className="mt-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-2xl font-semibold text-white">Candidate showtimes</h2>
                    <span className="text-sm text-slate-400">{Object.keys(groupedShowtimes).length} theaters</span>
                  </div>
                  {Object.entries(groupedShowtimes).map(([theater, slots]) => (
                    <Card key={theater} className="border-white/10 bg-slate-900/70 py-5">
                      <CardHeader>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h3 className="font-semibold text-white">{theater}</h3>
                            <p className="mt-1 flex items-center gap-2 text-sm text-slate-400">
                              <MapPin className="size-4" />
                              {slots[0]?.theaterLocation || "Chicago area theater"}
                            </p>
                          </div>
                          <span className="rounded bg-white/5 px-2 py-1 text-xs text-slate-300">{slots.length} slots</span>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-3 md:grid-cols-2">
                          {slots.map((slot) => {
                            const dateTime = showtimeDateTime(slot);
                            return (
                              <div key={slot.showtimeId} className="rounded-lg border border-white/10 bg-white/5 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="font-semibold text-white">{formatDate(dateTime)}</p>
                                    <p className="mt-1 flex items-center gap-2 text-sm text-slate-300">
                                      <Clock className="size-4 text-amber-300" />
                                      {formatTime(dateTime)}
                                    </p>
                                  </div>
                                  <span className="rounded bg-cyan-400/10 px-2 py-1 text-xs font-medium text-cyan-100">{slot.screenFormat || "Standard"}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </section>
              </section>

              <aside className="space-y-6 lg:col-span-4">
                {isConfirmed ? (
                  <Card className="sticky top-24 border-green-400/20 bg-slate-900/90 py-6 shadow-2xl shadow-black/20">
                    <CardHeader>
                      <h2 className="font-semibold text-white">RSVP and tickets</h2>
                      <p className="text-sm text-slate-400">Update your attendance and ticket status.</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Segmented label="RSVP" value={rsvpStatus} onChange={(value) => setRsvpStatus(value as RsvpStatus)} options={[["going", "Going"], ["maybe", "Maybe"], ["not_going", "Not going"]]} />
                      <Segmented label="Ticket" value={ticketStatus} onChange={(value) => setTicketStatus(value as TicketStatus)} options={[["not_purchased", "Not purchased"], ["purchased", "Purchased"]]} />
                      <Button onClick={saveRsvp} disabled={isSaving} className="w-full bg-violet-500 text-white hover:bg-violet-600">
                        {isSaving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                        Update RSVP
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="sticky top-24 border-violet-400/20 bg-slate-900/90 py-6 shadow-2xl shadow-violet-950/20">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-violet-400/20 p-2 text-violet-200">
                          <Vote className="size-5" />
                        </div>
                        <div>
                          <h2 className="font-semibold text-white">Rank your top showtimes</h2>
                          <p className="text-sm text-slate-400">{isVoting ? "Pick up to 3. No duplicates." : "Voting opens after showtimes are added."}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {rankLabels.map((rank, index) => {
                        const unavailable = rankings.filter((value, valueIndex) => value && valueIndex !== index);
                        return (
                          <div key={rank.label} className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <label className="text-sm font-medium text-slate-200">{rank.label}</label>
                              <span className="text-xs text-slate-500">{rank.points}</span>
                            </div>
                            <Select value={rankings[index] || "none"} onValueChange={(value) => updateRanking(index, value)} disabled={!isVoting}>
                              <SelectTrigger className="w-full border-white/10 bg-white/5 text-slate-100">
                                <SelectValue placeholder="Choose a showtime" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No selection</SelectItem>
                                {data.showtimes.map((showtime) => (
                                  <SelectItem key={showtime.showtimeId} value={showtime.showtimeId} disabled={unavailable.includes(showtime.showtimeId)}>
                                    {showtimeLabel(showtime)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                      {selectedShowtimes.length ? (
                        <ol className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                          {selectedShowtimes.map((showtime, index) => (
                            <li key={showtime.showtimeId} className="flex gap-2 py-1">
                              <span className="text-cyan-300">{index + 1}.</span>
                              <span>{showtimeLabel(showtime)}</span>
                            </li>
                          ))}
                        </ol>
                      ) : null}
                      <Button className="w-full bg-violet-500 text-white hover:bg-violet-600" disabled={!isVoting || !selectedCount || isSaving} onClick={saveVote}>
                        {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Vote className="size-4" />}
                        Save ranked vote
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </aside>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function StatusBanner({ status }: { status: string }) {
  const copy: Record<string, string> = {
    planning: "Admin is setting up this movie night.",
    voting: "Voting is open. Rank your top 3 showtimes.",
    confirmed: "Movie night confirmed. RSVP and mark your ticket status.",
    completed: "This movie night is complete.",
    cancelled: "This movie night was cancelled.",
  };

  return (
    <section className="mb-6 rounded-lg border border-violet-400/30 bg-violet-500/10 p-4 shadow-2xl shadow-violet-950/20">
      <p className="font-semibold text-violet-100">{copy[status] || "Movie night status is updating."}</p>
    </section>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <section className="rounded-lg border border-white/10 bg-slate-900/70 p-6">
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm text-slate-300">{description}</p>
    </section>
  );
}

function Alert({ children, tone }: { children: React.ReactNode; tone: "rose" | "green" }) {
  const classes =
    tone === "rose"
      ? "mb-4 border-rose-400/30 bg-rose-500/10 text-rose-100"
      : "mb-4 border-green-400/30 bg-green-500/10 text-green-100";
  return <div className={`rounded-lg border p-3 text-sm ${classes}`}>{children}</div>;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="mb-3">{icon}</div>
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-white">{value}</p>
    </div>
  );
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-slate-200">{label}</p>
      <div className="grid gap-2">
        {options.map(([optionValue, optionLabel]) => (
          <button
            key={optionValue}
            type="button"
            onClick={() => onChange(optionValue)}
            className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
              value === optionValue
                ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100"
                : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            {optionLabel}
          </button>
        ))}
      </div>
    </div>
  );
}
