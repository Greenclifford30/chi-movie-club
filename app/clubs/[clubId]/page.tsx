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
      <div className={`mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 ${isVoting || isConfirmed ? "pb-28 sm:pb-28 md:pb-6" : ""}`}>
        {isLoading || isRedirecting ? (
          <section className="grid min-h-[520px] place-items-center rounded-lg border border-white/10 bg-slate-900/70">
            <div className="flex flex-col items-center gap-3 text-slate-300">
              <Loader2 className="size-8 animate-spin text-cyan-300" />
              <p>{isRedirecting ? "Opening club history..." : "Loading the active movie night..."}</p>
            </div>
          </section>
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
              votingClosesAt={movieNight.votingClosesAt}
              historyHref={`/clubs/${clubId}/history`}
            />
            {error ? <StatusAlert tone="danger" className="mb-4">{error}</StatusAlert> : null}
            {message ? <StatusAlert tone="success" className="mb-4">{message}</StatusAlert> : null}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="contents">
                <div id="details" className={`${isConfirmed ? "order-3" : "order-1"} scroll-mt-20 overflow-hidden rounded-lg border border-white/10 bg-slate-900/80 shadow-2xl shadow-black/30 lg:order-none lg:col-span-8`}>
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
                        <span className="rounded bg-violet-400/15 px-2 py-1 text-xs font-medium text-violet-100">{movieNight.status}</span>
                        <span className="rounded bg-cyan-400/10 px-2 py-1 text-xs font-medium text-cyan-100">{movie.releaseYear || "Release year TBD"}</span>
                      </div>
                      <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">{movie.title}</h1>
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
                                compact
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
                  <Card id="rsvp" className="sticky top-24 border-green-400/20 bg-slate-900/90 py-6 shadow-2xl shadow-black/20">
                    <CardHeader>
                      <h2 className="font-semibold text-white">RSVP and tickets</h2>
                      <p className="text-sm text-slate-400">One update records both your attendance and ticket status.</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Segmented label="RSVP" value={rsvpStatus} onChange={(value) => setRsvpStatus(value as RsvpStatus)} options={[["going", "Going"], ["maybe", "Maybe"], ["not_going", "Not going"]]} />
                      <Segmented label="Ticket" value={ticketStatus} onChange={(value) => setTicketStatus(value as TicketStatus)} options={[["not_purchased", "Not purchased"], ["purchased", "Purchased"]]} />
                      <Button onClick={saveRsvp} disabled={isSaving} className="hidden w-full bg-violet-500 text-white hover:bg-violet-600 md:flex">
                        {isSaving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                        Update RSVP
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <Card id="vote" className="sticky top-24 border-violet-400/20 bg-slate-900/90 py-6 shadow-2xl shadow-violet-950/20">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-violet-400/20 p-2 text-violet-200">
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
                <Button className="mx-auto flex w-full max-w-lg bg-violet-500 text-white hover:bg-violet-600" disabled={!rankings.some(Boolean) || isSaving} onClick={saveVote}>
                  {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Vote className="size-4" />}
                  {hasSavedVote ? "Update ranked vote" : "Save ranked vote"}
                </Button>
              </div>
            ) : isConfirmed ? (
              <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 border-t border-white/10 bg-slate-950/95 p-3 backdrop-blur-xl md:hidden">
                <Button onClick={saveRsvp} disabled={isSaving} className="mx-auto flex w-full max-w-lg bg-violet-500 text-white hover:bg-violet-600">
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
            className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm transition ${
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
