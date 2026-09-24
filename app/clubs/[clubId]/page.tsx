"use client";

import { CalendarDays, CheckCircle2, Film, Loader2, Ticket, Users, Vote } from "lucide-react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ActiveNightStateBanner } from "@/components/movie-club/active-night-state-banner";
import { AddToCalendarButton } from "@/components/movie-club/add-to-calendar-button";
import { AppShell } from "@/components/movie-club/app-shell";
import { ConfirmedPlanCard } from "@/components/movie-club/confirmed-plan-card";
import { EmptyState } from "@/components/movie-club/empty-state";
import { PageSkeleton } from "@/components/movie-club/page-skeleton";
import { RankedChoicePicker } from "@/components/movie-club/ranked-choice-picker";
import { ShowtimeCard } from "@/components/movie-club/showtime-card";
import { StatusAlert } from "@/components/movie-club/status-alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { formatDate, posterUrl, showtimeDateTime } from "@/lib/movie-club-format";
import { getActiveMovieNight, submitVote, updateRsvp } from "@/lib/movie-club-api";
import type { ActiveMovieNightResponse, RsvpStatus, Showtime, TicketStatus } from "@/lib/movie-club-types";

export default function ActiveClubPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const router = useRouter();
  const { token, identityProvider } = useAuth();
  const [data, setData] = useState<ActiveMovieNightResponse | null>(null);
  const [rankings, setRankings] = useState<string[]>(["", "", ""]);
  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus>("going");
  const [ticketStatus, setTicketStatus] = useState<TicketStatus>("not_purchased");
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!token) {
        return;
      }
      setIsLoading(true);
      setIsRedirecting(false);
      setError(null);
      try {
        const active = await getActiveMovieNight(token, clubId);
        if (active.movieNight.status === "completed") {
          setIsRedirecting(true);
          router.replace(`/clubs/${clubId}/history`);
          return;
        }
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
  }, [clubId, router, token]);

  const groupedShowtimes = useMemo(() => {
    return (data?.showtimes || []).reduce<Record<string, Showtime[]>>((acc, showtime) => {
      acc[showtime.theaterName] = acc[showtime.theaterName] || [];
      acc[showtime.theaterName].push(showtime);
      return acc;
    }, {});
  }, [data?.showtimes]);

  const movieNight = data?.movieNight;
  const movie = movieNight?.movie;
  const confirmedShowtime =
    movieNight?.confirmedShowtime ||
    data?.showtimes.find((showtime) => showtime.showtimeId === movieNight?.confirmedShowtimeId);
  const isConfirmed = movieNight?.status === "confirmed";
  const isVoting = Boolean(
    movieNight?.status === "voting" &&
    !movieNight.votingClosedAt &&
    (!movieNight.votingClosesAt || Date.parse(movieNight.votingClosesAt) > Date.now())
  );
  const hasSavedVote = Boolean(data?.currentUserVote?.rankings?.length);
  const hasShowtimes = Boolean(data?.showtimes.length);
  const imageUrl = movie ? posterUrl(movie) : "";

  function updateRanking(rankIndex: number, showtimeId: string) {
    setMessage(null);
    setRankings((current) => {
      const next = [...current];
      next[rankIndex] = showtimeId === "none" ? "" : showtimeId;
      return next;
    });
  }

  function addShowtimeToBallot(showtimeId: string) {
    setMessage(null);
    const nextRankIndex = rankings.findIndex((ranking) => !ranking);
    if (rankings.includes(showtimeId)) {
      return;
    }
    if (nextRankIndex === -1) {
      setMessage("Your ballot already has three choices. Use the ranking panel to edit it.");
      return;
    }
    setRankings((current) => {
      if (current.includes(showtimeId)) {
        return current;
      }
      const rankIndex = current.findIndex((ranking) => !ranking);
      if (rankIndex === -1) return current;
      const next = [...current];
      next[rankIndex] = showtimeId;
      return next;
    });
    setMessage(`Added as your ${["first", "second", "third"][nextRankIndex]} choice.`);
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
      <div className={`mc-page ${isVoting || isConfirmed ? "pb-28 sm:pb-28 md:pb-6" : ""}`}>
        {isLoading || isRedirecting ? (
          <PageSkeleton variant="movie" label={isRedirecting ? "Opening club history" : "Loading the active movie night"} />
        ) : error && !data ? (
          <EmptyState
            title="Movie night could not load"
            description={error}
            action={{ label: "Back to clubs", href: "/clubs" }}
          />
        ) : !data || !movieNight || !movie ? (
          <EmptyState
            title="No active movie night"
            description="An admin can create the next movie night from the admin page. Members can check history while setup is pending."
            action={{ label: "View club history", href: `/clubs/${clubId}/history` }}
          />
        ) : (
          <>
            <ActiveNightStateBanner
              status={movieNight.status}
              showtimeCount={data.showtimes.length}
              hasVote={hasSavedVote}
              confirmed={Boolean(isConfirmed && confirmedShowtime)}
              votingOpen={isVoting}
              votingClosesAt={movieNight.votingClosesAt}
              historyHref={`/clubs/${clubId}/history`}
            />
            {error ? <StatusAlert tone="danger" className="mb-4">{error}</StatusAlert> : null}
            {message ? <StatusAlert tone="success" className="mb-4">{message}</StatusAlert> : null}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="contents">
                <div id="details" className={`${isConfirmed ? "order-3" : "order-1"} scroll-mt-20 overflow-hidden rounded-xl border border-white/10 bg-[#141b29] lg:order-none lg:col-span-8`}>
                  <div className="grid grid-cols-1 md:grid-cols-[260px_1fr]">
                    <div className="relative h-64 bg-slate-950 sm:h-80 md:h-auto md:min-h-[390px]">
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
                        <span className="rounded-sm bg-violet-400/15 px-2 py-1 text-xs font-medium text-violet-100">{movieNight.status}</span>
                        <span className="rounded-sm bg-white/10 px-2 py-1 text-xs font-medium text-slate-200">{movie.releaseYear || "Release year TBD"}</span>
                      </div>
                      <h1 className="text-balance text-4xl font-semibold leading-tight tracking-[-.045em] text-white sm:text-5xl">{movie.title}</h1>
                      <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-300">
                        {movie.runtime ? <span className="rounded border border-white/10 bg-white/5 px-2 py-1">{movie.runtime} min</span> : null}
                        {movie.genres?.filter((genre): genre is string => typeof genre === "string").slice(0, 3).map((genre) => <span key={genre} className="rounded border border-white/10 bg-white/5 px-2 py-1">{genre}</span>)}
                        {movie.rating ? <span className="rounded border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-amber-100">★ {movie.rating.toFixed(1)}</span> : null}
                      </div>
                      <p className="mt-4 max-w-2xl text-pretty leading-7 text-slate-300">{movie.overview || "Movie details will appear here once the admin saves a full movie snapshot."}</p>
                      <div className="mt-7 grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-3">
                        <Stat icon={<CalendarDays className="size-5 text-amber-300" />} label="Target" value={formatDate(movieNight.targetDate)} />
                        <Stat icon={<Ticket className="size-5 text-cyan-300" />} label="Options" value={`${data.showtimes.length} showtimes`} />
                        <Stat icon={<Users className="size-5 text-violet-300" />} label="Mode" value={movieNight.movieSelectionMode || "admin_selected"} />
                      </div>
                    </div>
                  </div>
                </div>

                {isConfirmed && confirmedShowtime ? (
                  <div className="order-1 lg:order-none lg:col-span-8">
                    <ConfirmedPlanCard showtime={confirmedShowtime} secondaryAction={token ? <AddToCalendarButton movieNight={movieNight} showtime={confirmedShowtime} status={movieNight.status} token={token} identityProvider={identityProvider} /> : null} />
                  </div>
                ) : null}

                <section id="showtimes" className={`${isConfirmed ? "order-4" : "order-3"} scroll-mt-20 space-y-4 lg:order-none lg:col-span-8`}>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-2xl font-semibold text-white">Candidate showtimes</h2>
                    <span className="text-sm text-slate-400">{Object.keys(groupedShowtimes).length} theaters</span>
                  </div>
                  {hasShowtimes ? (
                    Object.entries(groupedShowtimes).map(([theater, slots]) => (
                      <Card key={theater} className="border-white/10 bg-slate-900/70 py-5">
                        <CardHeader>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <h3 className="font-semibold text-white">{theater}</h3>
                              <p className="mt-1 text-sm text-slate-400">{slots[0]?.theaterLocation || "Chicago area theater"}</p>
                            </div>
                            <span className="rounded bg-white/5 px-2 py-1 text-xs text-slate-300">{slots.length} slots</span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-3 md:grid-cols-2">
                            {slots.map((slot) => (
                              <ShowtimeCard
                                key={slot.showtimeId}
                                theaterName={slot.theaterName}
                                theaterLocation={slot.theaterLocation}
                                dateTime={showtimeDateTime(slot)}
                                screenFormat={slot.screenFormat}
                                ticketURI={slot.ticketURI}
                                selected={confirmedShowtime?.showtimeId === slot.showtimeId || rankings.includes(slot.showtimeId)}
                                rank={rankings.indexOf(slot.showtimeId) + 1 || undefined}
                                compact
                                onSelect={isVoting ? () => addShowtimeToBallot(slot.showtimeId) : undefined}
                              />
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <EmptyState
                      title="No showtimes yet"
                      description="The admin still needs to import candidate showtimes. Once options are available, this page will switch to ranked voting."
                      action={{ label: "Check history", href: `/clubs/${clubId}/history` }}
                    />
                  )}
                </section>
              </div>

              <aside className="order-2 space-y-6 lg:order-none lg:col-span-4 lg:col-start-9 lg:row-span-3 lg:row-start-1">
                {isConfirmed ? (
                  <Card id="rsvp" className="sticky top-24 border-white/10 bg-[#171f2c] py-6">
                    <CardHeader>
                      <h2 className="font-semibold text-white">RSVP and tickets</h2>
                      <p className="text-sm text-slate-400">One update records both your attendance and ticket status.</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Segmented label="RSVP" value={rsvpStatus} onChange={(value) => setRsvpStatus(value as RsvpStatus)} options={[["going", "Going"], ["maybe", "Maybe"], ["not_going", "Not going"]]} />
                      <Segmented label="Ticket" value={ticketStatus} onChange={(value) => setTicketStatus(value as TicketStatus)} options={[["not_purchased", "Not purchased"], ["purchased", "Purchased"]]} />
                      <Button onClick={saveRsvp} disabled={isSaving} className="hidden w-full bg-violet-400 text-slate-950 hover:bg-violet-300 md:flex">
                        {isSaving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                        Update RSVP
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <Card id="vote" className="sticky top-24 border-white/10 bg-[#171f2c] py-6">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="rounded-md bg-violet-400/15 p-2 text-violet-200">
                          <Vote className="size-5" />
                        </div>
                        <div>
                          <h2 className="font-semibold text-white">{hasSavedVote ? "Edit your vote" : "Rank your top showtimes"}</h2>
                          <p className="text-sm text-slate-400">
                            {isVoting && hasShowtimes ? "Pick up to 3. No duplicates." : movieNight?.status === "voting" ? "Voting is closed while the admin confirms the final plan." : "Voting opens after showtimes are added."}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {hasShowtimes ? (
                        <RankedChoicePicker
                          showtimes={data.showtimes}
                          rankings={rankings}
                          disabled={!isVoting}
                          isSaving={isSaving}
                          hasSavedVote={hasSavedVote}
                          hideMobileSave
                          onChange={updateRanking}
                          onSave={saveVote}
                        />
                      ) : (
                        <EmptyState
                          title="Ballot not ready"
                          description="There are no candidate showtimes to rank yet. The next action belongs to the club admin."
                          className="bg-white/5"
                        />
                      )}
                    </CardContent>
                  </Card>
                )}
              </aside>
            </div>
            {isVoting && hasShowtimes ? (
              <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 border-t border-white/10 bg-slate-950/95 p-3 backdrop-blur-xl md:hidden">
                <Button className="mx-auto flex w-full max-w-lg bg-violet-400 text-slate-950 hover:bg-violet-300" disabled={!rankings.some(Boolean) || isSaving} onClick={saveVote}>
                  {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Vote className="size-4" />}
                  {hasSavedVote ? "Update ranked vote" : "Save ranked vote"}
                </Button>
              </div>
            ) : isConfirmed ? (
              <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 border-t border-white/10 bg-slate-950/95 p-3 backdrop-blur-xl md:hidden">
                <Button onClick={saveRsvp} disabled={isSaving} className="mx-auto flex w-full max-w-lg bg-violet-400 text-slate-950 hover:bg-violet-300">
                  {isSaving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  Update RSVP
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="border-l border-white/10 pl-4">
      <div className="mb-2">{icon}</div>
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
      <div role="group" aria-label={label} className="grid gap-2">
        {options.map(([optionValue, optionLabel]) => (
          <button
            key={optionValue}
            type="button"
            onClick={() => onChange(optionValue)}
            aria-pressed={value === optionValue}
            className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm transition focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
              value === optionValue
                ? "border-violet-300/50 bg-violet-300/10 text-violet-100"
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
