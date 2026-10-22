"use client";

import { CalendarDays, CheckCircle2, ChevronDown, Film, Loader2, Vote } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
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
import { formatDate, formatTime, posterUrl, showtimeDateTime } from "@/lib/movie-club-format";
import { getMovieNight, submitVote, updateRsvp, acknowledgeMovieNightPlan, MovieClubApiError } from "@/lib/movie-club-api";
import type { ActiveMovieNightResponse, RsvpStatus, Showtime, TicketStatus } from "@/lib/movie-club-types";

export default function ActiveClubPage() {
  const { clubId, movieNightId } = useParams<{ clubId: string; movieNightId: string }>();
  const { token, identityProvider } = useAuth();
  const [data, setData] = useState<ActiveMovieNightResponse | null>(null);
  const [rankings, setRankings] = useState<string[]>(["", "", ""]);
  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus>("going");
  const [ticketStatus, setTicketStatus] = useState<TicketStatus>("not_purchased");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token) {
        return;
      }
      setIsLoading(true);
      setData(null);
      setError(null);
      try {
        const active = await getMovieNight(token, movieNightId);
        if (cancelled) return;
        if (active.movieNight.clubId !== clubId) throw new Error("Movie night does not belong to this club.");
        setData(active);
        setRankings([
          active.currentUserVote?.rankings?.[0] || "",
          active.currentUserVote?.rankings?.[1] || "",
          active.currentUserVote?.rankings?.[2] || "",
        ]);
        if (active.currentUserRsvp) {
          setRsvpStatus(active.currentUserRsvp.status);
          setTicketStatus((active.currentUserRsvp.ticketPlanRevision ?? 1) < (active.movieNight.planRevision ?? 1) ? "not_purchased" : active.currentUserRsvp.ticketStatus);
        }
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load the active movie night.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [clubId, movieNightId, token]);

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
  const previousOptions = isConfirmed || movieNight?.status === "completed" || movieNight?.status === "cancelled";
  const planRevision = movieNight?.planRevision ?? 1;
  const needsAcknowledgement = Boolean(
    (isConfirmed || movieNight?.status === "cancelled") && planRevision > 1 &&
    (data?.currentUserAcknowledgement?.acknowledgedPlanRevision ?? 0) < planRevision
  );
  const needsRsvpReview = Boolean(isConfirmed && data?.currentUserRsvp && (data.currentUserRsvp.rsvpPlanRevision ?? 1) < planRevision);
  const needsTicketReview = Boolean(isConfirmed && data?.currentUserRsvp && (data.currentUserRsvp.ticketPlanRevision ?? 1) < planRevision);
  const hasPlanNotice = Boolean(movieNight?.previousPlan || movieNight?.changeReason || needsAcknowledgement || needsRsvpReview || needsTicketReview);
  const hasSaveBar = (isVoting && hasShowtimes) || isConfirmed;

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
      const result = await updateRsvp(token, movieNight.movieNightId, rsvpStatus, ticketStatus, movieNight.planRevision ?? 1);
      setData((current) => (current ? { ...current, currentUserRsvp: result.rsvp } : current));
      setMessage("RSVP updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update RSVP.");
      if (saveError instanceof MovieClubApiError && saveError.status === 409 && token && movieNight) {
        try {
          const fresh = await getMovieNight(token, movieNight.movieNightId);
          setData(fresh);
          setRsvpStatus(fresh.currentUserRsvp?.status || "going");
          setTicketStatus((fresh.currentUserRsvp?.ticketPlanRevision ?? 1) < (fresh.movieNight.planRevision ?? 1) ? "not_purchased" : fresh.currentUserRsvp?.ticketStatus || "not_purchased");
        } catch { setError("The plan changed and could not be refreshed. Reload this event before trying again."); }
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function acknowledgePlan() {
    if (!token || !movieNight) return;
    setIsSaving(true); setError(null);
    try {
      const acknowledgement = await acknowledgeMovieNightPlan(token, movieNight.movieNightId, movieNight.planRevision ?? 1);
      setData(current => current ? { ...current, currentUserAcknowledgement: acknowledgement } : current);
      setMessage("Plan acknowledged. Confirm your RSVP and ticket status separately.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to acknowledge this plan.");
      if (e instanceof MovieClubApiError && e.status === 409) {
        try { setData(await getMovieNight(token, movieNight.movieNightId)); }
        catch { setError("The plan changed and could not be refreshed. Reload this event."); }
      }
    }
    finally { setIsSaving(false); }
  }

  return (
    <AppShell>
      <div className={`mc-page mc-night-page ${hasSaveBar ? "mc-night-has-actions" : ""}`}>
        {isLoading ? (
          <PageSkeleton variant="movie" label="Loading movie night" />
        ) : error && !data ? (
          <EmptyState title="Movie night could not load" description={error} action={{ label: "Back to clubs", href: "/clubs" }} />
        ) : !data || !movieNight || !movie ? (
          <EmptyState
            title="No active movie night"
            description="An admin can create the next movie night. Check club history while setup is pending."
            action={{ label: "View club history", href: `/clubs/${clubId}/history` }}
          />
        ) : (
          <>
            <nav aria-label="Movie night links" className="mb-5 flex flex-wrap gap-x-5 text-sm text-cyan-200">
              <Link className="inline-flex min-h-11 items-center rounded-sm hover:text-white focus-visible:outline-2 focus-visible:outline-violet-300" href={`/clubs/${clubId}`}>Club schedule</Link>
              {data.currentUserRole === "admin" ? <Link className="inline-flex min-h-11 items-center rounded-sm hover:text-white focus-visible:outline-2 focus-visible:outline-violet-300" href={`/clubs/${clubId}/movie-nights/${movieNight.movieNightId}/admin`}>Manage this night</Link> : null}
            </nav>
            {hasPlanNotice ? (
              <StatusAlert tone="warning" className="mb-5">
                <div className="space-y-3 break-words">
                  <h2 className="font-semibold">The plan has changed</h2>
                  {movieNight.previousPlan ? <p><span className="font-medium">Previous plan:</span> {planLabel(movieNight.previousPlan)}</p> : null}
                  <p><span className="font-medium">Current plan:</span> {movieNight.status === "cancelled" ? "Cancelled" : confirmedShowtime ? planLabel(confirmedShowtime) : "See details below"}</p>
                  {movieNight.changeReason ? <p>Reason: {movieNight.changeReason}</p> : null}
                  {needsRsvpReview ? <p>Your previous RSVP needs reconfirmation. Review and submit your choices for this plan.</p> : null}
                  {needsTicketReview ? <p>Ticket status needs review. Your previous ticket status applies to the old plan; acknowledging the change does not confirm ticket validity.</p> : null}
                  {needsAcknowledgement ? <Button className="h-auto min-h-11 max-w-full whitespace-normal" disabled={isSaving} onClick={() => void acknowledgePlan()}>I’ve seen the changed plan</Button> : null}
                </div>
              </StatusAlert>
            ) : null}
            {error ? <StatusAlert tone="danger" className="mb-5">{error}</StatusAlert> : null}
            {message ? <StatusAlert tone="success" className="mb-5">{message}</StatusAlert> : null}

            <div className="grid min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6">
              <section id="details" aria-labelledby="movie-title" className="min-w-0 scroll-mt-24 rounded-xl border border-white/10 bg-[#141b29] p-4 sm:p-6 lg:col-start-1">
                <div className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[128px_minmax(0,1fr)] sm:gap-5 lg:grid-cols-[144px_minmax(0,1fr)]">
                  <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-slate-950">
                    {imageUrl ? (
                      <Image src={imageUrl} alt={`${movie.title} poster`} fill className="object-cover" sizes="(min-width: 1024px) 144px, (min-width: 640px) 128px, 88px" />
                    ) : (
                      <div className="grid h-full place-items-center text-slate-500"><Film aria-hidden="true" className="size-9" /><span className="sr-only">No poster available</span></div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h1 id="movie-title" className="break-words text-2xl font-semibold leading-tight tracking-[-.04em] text-white sm:text-4xl">{movie.title}</h1>
                    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-300">
                      {movie.releaseYear ? <span>{movie.releaseYear}</span> : null}
                      {movie.runtime ? <span>{movie.runtime} min</span> : null}
                      {movie.rating ? <span className="text-amber-200">★ {movie.rating.toFixed(1)}</span> : null}
                    </div>
                    {movie.genres?.some((genre) => typeof genre === "string") ? <p className="mt-2 break-words text-sm text-slate-400">{movie.genres.filter((genre): genre is string => typeof genre === "string").slice(0, 3).join(" · ")}</p> : null}
                    {!previousOptions && movieNight.targetDate ? <p className="mt-4 flex items-start gap-2 text-sm text-slate-300"><CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-violet-200" /><span>Target date: {formatDate(movieNight.targetDate)}</span></p> : null}
                  </div>
                </div>
                {movie.overview ? (
                  <>
                    <details className="group mt-4 lg:hidden">
                      <summary className="flex min-h-11 cursor-pointer items-center rounded-sm text-sm font-medium text-violet-200 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-300">About the movie <ChevronDown aria-hidden="true" className="ml-2 size-4 text-slate-400 transition-transform group-open:rotate-180" /></summary>
                      <p className="mt-2 break-words text-sm leading-7 text-slate-300">{movie.overview}</p>
                    </details>
                    <p className="mt-5 hidden max-w-prose break-words text-sm leading-7 text-slate-300 lg:block">{movie.overview}</p>
                  </>
                ) : null}
                <div className="mt-5">
                  <ActiveNightStateBanner
                    status={movieNight.status}
                    showtimeCount={data.showtimes.length}
                    hasVote={hasSavedVote}
                    votingOpen={isVoting}
                    votingClosesAt={movieNight.votingClosesAt}
                    historyHref={`/clubs/${clubId}/history`}
                  />
                </div>
              </section>

              {previousOptions && confirmedShowtime ? (
                <div className="min-w-0 lg:col-start-1">
                  <ConfirmedPlanCard
                    showtime={confirmedShowtime}
                    showTicketAction={isConfirmed}
                    secondaryAction={token && (isConfirmed || movieNight.status === "cancelled") ? (
                      <AddToCalendarButton movieNight={movieNight} showtime={confirmedShowtime} status={movieNight.status} token={token} identityProvider={identityProvider} />
                    ) : null}
                  />
                </div>
              ) : null}

              <aside aria-label="Your participation" className="min-w-0 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:sticky lg:top-24">
                {movieNight.status === "cancelled" || movieNight.status === "completed" ? (
                  <Card className="gap-2 border-white/10 bg-[#171f2c] p-5">
                    <h2 className="font-semibold">Participation closed</h2>
                    <p className="text-sm leading-6 text-slate-400">This movie night is {movieNight.status}. Its plan and history remain available.</p>
                  </Card>
                ) : isConfirmed ? (
                  <Card id="rsvp" className="scroll-mt-24 border-white/10 bg-[#171f2c] py-5">
                    <CardHeader><h2 className="font-semibold text-white">RSVP and tickets</h2></CardHeader>
                    <CardContent className="space-y-5">
                      <Segmented label="RSVP" value={rsvpStatus} disabled={isSaving} onChange={(value) => setRsvpStatus(value as RsvpStatus)} options={[["going", "Going"], ["maybe", "Maybe"], ["not_going", "Not going"]]} />
                      <Segmented label="Ticket" value={ticketStatus} disabled={isSaving} onChange={(value) => setTicketStatus(value as TicketStatus)} options={[["not_purchased", "Not purchased"], ["purchased", "Purchased"]]} />
                      <Button onClick={saveRsvp} disabled={isSaving} className="hidden min-h-11 w-full bg-violet-400 text-slate-950 hover:bg-violet-300 lg:flex">
                        {isSaving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                        Update RSVP
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <Card id="vote" className="scroll-mt-24 border-white/10 bg-[#171f2c] py-5">
                    <CardHeader><h2 className="font-semibold text-white">{hasSavedVote ? "Edit your vote" : "Rank your top showtimes"}</h2></CardHeader>
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
                        <p className="text-sm leading-6 text-slate-400">Your ballot will appear when showtimes are ready.</p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </aside>

              {!previousOptions || hasShowtimes ? (
                <section id="showtimes" aria-label={previousOptions ? "Previous showtime options" : "Candidate showtimes"} className="min-w-0 scroll-mt-24 lg:col-start-1">
                  {previousOptions ? (
                    <details className="group rounded-xl border border-white/10 bg-[#141b29] p-4 sm:p-5">
                      <summary className="min-h-11 cursor-pointer rounded-sm py-3 text-sm font-medium text-slate-300 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-300">Previous showtime options</summary>
                      <div className="mt-4 space-y-4">{renderShowtimes()}</div>
                    </details>
                  ) : (
                    <div className="space-y-4">
                      <h2 className="text-xl font-semibold text-white">Candidate showtimes</h2>
                      {hasShowtimes ? renderShowtimes() : <EmptyState title="No showtimes yet" description="The admin is still preparing showtime options." />}
                    </div>
                  )}
                </section>
              ) : null}
            </div>
            {hasSaveBar ? (
              <div aria-label={isConfirmed ? "Save RSVP" : "Save vote"} className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 border-t border-white/10 bg-slate-950/95 p-3 backdrop-blur-xl lg:hidden">
                <Button className="mx-auto flex min-h-11 w-full max-w-lg bg-violet-400 text-slate-950 hover:bg-violet-300" disabled={isSaving || (!isConfirmed && !rankings.some(Boolean))} onClick={isConfirmed ? saveRsvp : saveVote}>
                  {isSaving ? <Loader2 className="size-4 animate-spin" /> : isConfirmed ? <CheckCircle2 className="size-4" /> : <Vote className="size-4" />}
                  {isConfirmed ? "Update RSVP" : hasSavedVote ? "Update ranked vote" : "Save ranked vote"}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );

  function renderShowtimes() {
    return Object.entries(groupedShowtimes).map(([theater, slots]) => (
      <Card key={theater} className="min-w-0 gap-4 border-white/10 bg-slate-900/70 py-5">
        <CardHeader>
          <h3 className="break-words font-semibold text-white">{theater}</h3>
          {slots[0]?.theaterLocation ? <p className="mt-1 break-words text-sm text-slate-400">{slots[0].theaterLocation}</p> : null}
        </CardHeader>
        <CardContent>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
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
                onSelect={isVoting && !isSaving ? () => addShowtimeToBallot(slot.showtimeId) : undefined}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    ));
  }
}

function planLabel(showtime: Showtime) {
  const dateTime = showtimeDateTime(showtime);
  return `${formatDate(dateTime)} at ${formatTime(dateTime)} · ${showtime.theaterName} · ${showtime.screenFormat || "Standard"}`;
}

function Segmented({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-slate-200">{label}</p>
      <div role="group" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-2 lg:grid-flow-row">
        {options.map(([optionValue, optionLabel]) => (
          <button
            key={optionValue}
            type="button"
            disabled={disabled}
            onClick={() => onChange(optionValue)}
            aria-pressed={value === optionValue}
            className={`min-h-11 rounded-lg border px-2 py-2 text-center text-sm transition disabled:opacity-50 lg:px-3 lg:text-left focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
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
