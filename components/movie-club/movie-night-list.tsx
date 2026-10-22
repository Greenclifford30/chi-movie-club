"use client";

import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, Film, Loader2, MapPin, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FocusEvent, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/movie-club/app-shell";
import { EmptyState } from "@/components/movie-club/empty-state";
import { StatusAlert } from "@/components/movie-club/status-alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { listClubs, listMovieNights, listMyMovieNights } from "@/lib/movie-club-api";
import { formatDate, formatTime, posterUrl } from "@/lib/movie-club-format";
import type { MovieNightSummary } from "@/lib/movie-club-types";

const actionLabels: Record<string, string> = {
  vote: "Vote on showtimes",
  edit_vote: "Edit your ballot",
  rsvp: "RSVP to this night",
  review_tickets: "Review your tickets",
  acknowledge_plan: "Review changed plan",
};

export function MovieNightList({ clubId }: { clubId?: string }) {
  const { token } = useAuth();
  const router = useRouter();
  const [nights, setNights] = useState<MovieNightSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [scope, setScope] = useState<"upcoming" | "recent">("upcoming");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [clubName, setClubName] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const requestVersion = useRef(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    requestVersion.current += 1;
    setLoading(true);
    setLoadingMore(false);
    setError(null);
    setNights([]);
    setCursor(null);
    setIsAdmin(false);
    setClubName(null);
    const request = clubId ? listMovieNights(token, clubId) : listMyMovieNights(token, { scope });
    request
      .then(result => {
        if (!cancelled) {
          if (clubId && !result.movieNights.length && !result.nextCursor) {
            router.replace(`/clubs/${encodeURIComponent(clubId)}/suggestions`);
          }
          setNights(result.movieNights);
          setCursor(result.nextCursor || null);
        }
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load movie nights."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    if (clubId) {
      listClubs(token)
        .then(result => {
          if (!cancelled) {
            const club = result.clubs.find(c => c.clubId === clubId);
            setIsAdmin(club?.role === "admin");
            setClubName(club?.name || null);
          }
        })
        .catch(() => {});
    }
    return () => { cancelled = true; requestVersion.current += 1; };
  }, [clubId, scope, token, retry, router]);

  async function loadMore() {
    if (!token || !cursor || loadingMore) return;
    const version = requestVersion.current;
    setLoadingMore(true);
    setError(null);
    try {
      const result = clubId ? await listMovieNights(token, clubId, { cursor }) : await listMyMovieNights(token, { cursor, scope });
      if (version !== requestVersion.current) return;
      setNights(current => [...current, ...result.movieNights.filter(n => !current.some(c => c.movieNightId === n.movieNightId))]);
      setCursor(result.nextCursor || null);
    } catch (e) {
      if (version === requestVersion.current) setError(e instanceof Error ? e.message : "Unable to load more movie nights.");
    } finally {
      if (version === requestVersion.current) setLoadingMore(false);
    }
  }

  return (
    <AppShell>
      <div className="mc-page mc-schedule-page" onFocusCapture={keepFocusVisible}>
        <header className="mb-7 flex min-w-0 flex-col gap-5 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="mb-3 text-sm font-medium text-violet-200">{clubId ? clubName || "Your club" : "Across your clubs"}</p>
            <h1 className="mc-title">{clubId ? "Club schedule" : "My movie nights"}</h1>
            <p className="mt-3 max-w-prose text-sm leading-6 text-slate-400">
              {scope === "recent" ? "Completed outings from the past 30 days." : "See what’s planned and what needs your response."}
            </p>
          </div>
          {clubId && isAdmin ? (
            <Button asChild className="h-auto min-h-11 w-full whitespace-normal sm:w-auto sm:shrink-0">
              <Link href={`/clubs/${encodeURIComponent(clubId)}/movie-nights/new`}><Plus aria-hidden="true" className="size-4" />Create a movie night</Link>
            </Button>
          ) : null}
        </header>

        {!clubId ? (
          <div role="group" aria-label="Movie night timeframe" className="mb-6 inline-flex max-w-full gap-1 rounded-lg border border-white/10 bg-white/[.03] p-1">
            {(["upcoming", "recent"] as const).map(value => (
              <Button key={value} variant={scope === value ? "secondary" : "ghost"} aria-pressed={scope === value} className="min-h-11" disabled={loadingMore} onClick={() => setScope(value)}>
                {value === "upcoming" ? "Upcoming" : "Recent"}
              </Button>
            ))}
          </div>
        ) : null}

        {error ? (
          <StatusAlert tone="danger" className="mb-5">
            <p>{error}</p>
            {!nights.length ? <Button variant="outline" className="mt-3 min-h-11" onClick={() => setRetry(value => value + 1)}>Try again</Button> : null}
          </StatusAlert>
        ) : null}

        {loading || (clubId && !nights.length && !cursor && !error) ? <ScheduleSkeleton /> : !nights.length && !error ? (
          <EmptyState
            className="[&_[data-slot=button]]:h-auto [&_[data-slot=button]]:min-h-11 [&_[data-slot=button]]:whitespace-normal"
            icon={<CalendarDays aria-hidden="true" className="size-5" />}
            title={scope === "recent" ? "No recent movie nights" : "No movie nights planned"}
            description={scope === "recent" ? "Completed outings from the past 30 days will appear here." : clubId ? isAdmin ? "Create the next movie night to get the club together." : "Your next outing will appear here once a club admin creates it." : "Upcoming movie nights from your clubs will appear here."}
            action={clubId ? isAdmin ? undefined : { label: "View club history", href: `/clubs/${encodeURIComponent(clubId)}/history` } : { label: "Browse clubs", href: "/clubs" }}
          />
        ) : nights.length ? (
          <ul aria-label={clubId ? "Club movie nights" : "Your movie nights"} className="space-y-4">
            {nights.map(night => (
              <li key={night.movieNightId} className="min-w-0">
                <ScheduleNight night={night} showClub={!clubId} isAdmin={Boolean(clubId && isAdmin)} />
              </li>
            ))}
          </ul>
        ) : null}

        {cursor && !loading ? (
          <div className="mt-6 flex justify-center" aria-busy={loadingMore}>
            <Button className="min-h-11 w-full sm:w-auto" variant="outline" disabled={loadingMore} onClick={() => void loadMore()}>
              {loadingMore ? <><Loader2 aria-hidden="true" className="size-4 animate-spin" />Loading more…</> : "Load more"}
            </Button>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

function keepFocusVisible(event: FocusEvent<HTMLDivElement>) {
  if (!event.target.matches(":focus-visible")) return;
  const bounds = event.target.getBoundingClientRect();
  const navigation = document.querySelector('nav[aria-label="Club navigation"]')?.getBoundingClientRect();
  const bottom = navigation?.height ? navigation.top - 12 : window.innerHeight - 16;
  // Native focus scrolling does not account for the shell's fixed navigation.
  if (bounds.bottom > bottom) {
    window.scrollBy({ top: bounds.bottom - bottom, behavior: "instant" });
  } else if (bounds.top < 80) {
    window.scrollBy({ top: bounds.top - 80, behavior: "instant" });
  }
}

function ScheduleNight({ night, showClub, isAdmin }: { night: MovieNightSummary; showClub: boolean; isAdmin: boolean }) {
  const href = `/clubs/${encodeURIComponent(night.clubId)}/movie-nights/${encodeURIComponent(night.movieNightId)}`;
  const imageUrl = posterUrl(night.movie);
  const status = scheduleStatus(night);
  const closed = night.status === "completed" || night.status === "cancelled";
  const nextAction = night.nextActions?.[0];
  const action = !closed && nextAction && !(status.label === "Voting closed" && (nextAction === "vote" || nextAction === "edit_vote")) ? actionLabels[nextAction] : undefined;
  const timing = scheduleTiming(night);
  const rsvp = night.status === "confirmed" ? night.currentUserRsvp : null;
  const planRevision = night.planRevision ?? 1;
  const needsRsvpReview = Boolean(rsvp && (rsvp.rsvpPlanRevision ?? 1) < planRevision);
  const needsTicketReview = Boolean(rsvp && (rsvp.ticketPlanRevision ?? 1) < planRevision);
  const response = rsvp ? rsvp.status === "going" ? "Going" : rsvp.status === "not_going" ? "Not going" : "Maybe" : null;

  return (
    <article aria-label={night.movie.title} className="grid min-w-0 grid-cols-[64px_minmax(0,1fr)] gap-x-4 gap-y-5 rounded-xl border border-white/10 bg-[#141b29] p-4 sm:grid-cols-[80px_minmax(0,1fr)] sm:p-5 lg:grid-cols-[80px_minmax(0,1fr)_200px] lg:gap-x-6 lg:p-6">
      <div className="relative aspect-[2/3] self-start overflow-hidden rounded-md bg-slate-950">
        {imageUrl ? <Image src={imageUrl} alt={`${night.movie.title} poster`} fill className="object-cover" sizes="(min-width: 640px) 80px, 64px" /> : <div className="grid h-full place-items-center text-slate-600"><Film aria-hidden="true" className="size-7" /></div>}
      </div>
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className={`inline-flex rounded px-2 py-1 text-xs font-medium ${status.tone}`}>{status.label}</span>
          {showClub && night.clubName ? <span className="min-w-0 text-xs text-slate-400">{night.clubName}</span> : null}
        </div>
        <h2 className="text-lg font-semibold leading-snug tracking-tight text-white sm:text-xl">
          <Link href={href} className="rounded-sm transition hover:text-violet-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-300">{night.movie.title}</Link>
        </h2>
        <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-slate-300">
          <CalendarDays aria-hidden="true" className="mt-1 size-4 shrink-0 text-slate-500" />
          {timing.dateTime ? <time dateTime={timing.dateTime}>{timing.label}</time> : <span>{timing.label}</span>}
        </p>
        {night.confirmedShowtime ? (
          <p className="mt-1 flex items-start gap-2 text-sm leading-6 text-slate-400">
            <MapPin aria-hidden="true" className="mt-1 size-4 shrink-0 text-slate-500" />
            <span>{night.confirmedShowtime.theaterName}{night.confirmedShowtime.screenFormat ? ` · ${night.confirmedShowtime.screenFormat}` : ""}</span>
          </p>
        ) : null}
        {response && !needsRsvpReview && !needsTicketReview ? (
          <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-slate-300">
            <CheckCircle2 aria-hidden="true" className="mt-1 size-4 shrink-0 text-violet-200" />
            <span>{response}{rsvp?.status !== "not_going" ? rsvp?.ticketStatus === "purchased" ? " · Ticket purchased" : " · No ticket yet" : ""}</span>
          </p>
        ) : null}
        {night.status === "voting" && night.currentUserVote?.rankings.length ? <p className="mt-3 text-sm text-slate-400">Your vote is saved</p> : null}
        {needsRsvpReview || needsTicketReview || night.conflicts?.length ? (
          <div className="mt-3 flex items-start gap-2 text-sm leading-6 text-amber-200">
            <AlertTriangle aria-hidden="true" className="mt-1 size-4 shrink-0" />
            <div>
              {needsRsvpReview ? <p>RSVP needs reconfirmation.</p> : null}
              {needsTicketReview ? <p>Tickets need review for the changed plan.</p> : null}
              {night.conflicts?.length ? <p>{night.conflicts.some(c => c.uncertain) ? "May overlap another movie night." : "Overlaps another movie night."}</p> : null}
            </div>
          </div>
        ) : null}
      </div>
      <div className="col-span-2 flex min-w-0 items-center gap-2 border-t border-white/10 pt-4 lg:col-span-1 lg:col-start-3 lg:self-center lg:flex-col lg:border-0 lg:pt-0">
        <Button asChild variant={action ? "default" : "outline"} className="h-auto min-h-11 min-w-0 flex-1 whitespace-normal sm:flex-none lg:w-full">
          <Link href={href}>{action || "View movie night"}<ArrowRight aria-hidden="true" className="size-4" /></Link>
        </Button>
        {isAdmin ? <Link href={`${href}/admin`} aria-label={`Manage ${night.movie.title}`} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md px-3 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-300">Manage</Link> : null}
      </div>
    </article>
  );
}

function scheduleStatus(night: MovieNightSummary) {
  if (night.status === "confirmed") {
    const awaiting = night.confirmedShowtime?.startsAtUtc && Date.parse(night.confirmedShowtime.startsAtUtc) < Date.now();
    return awaiting ? { label: "Awaiting completion", tone: "bg-amber-300/10 text-amber-200" } : { label: "Confirmed", tone: "bg-green-400/10 text-green-200" };
  }
  if (night.status === "voting") {
    const closed = night.votingClosedAt || (night.votingClosesAt && Date.parse(night.votingClosesAt) <= Date.now());
    return closed ? { label: "Voting closed", tone: "bg-amber-300/10 text-amber-200" } : { label: "Voting open", tone: "bg-violet-300/10 text-violet-200" };
  }
  if (night.status === "cancelled") return { label: "Cancelled", tone: "bg-rose-400/10 text-rose-200" };
  if (night.status === "completed") return { label: "Completed", tone: "bg-white/5 text-slate-300" };
  return { label: "Planning", tone: "bg-white/5 text-slate-300" };
}

function scheduleTiming(night: MovieNightSummary) {
  const showtime = night.confirmedShowtime;
  if (showtime) {
    const timezone = showtime.timezone || night.timezone || "America/Chicago";
    try {
      const date = new Date(showtime.startsAtUtc);
      const day = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(date);
      const time = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(date);
      return { dateTime: showtime.startsAtUtc, label: `${day} at ${time}` };
    } catch {
      return showtime.localDateTime ? { dateTime: showtime.localDateTime, label: `${formatDate(showtime.localDateTime, "EEE, MMM d, yyyy")} at ${formatTime(showtime.localDateTime)}` } : { label: "Date and time to be confirmed" };
    }
  }
  return night.targetDate ? { dateTime: night.targetDate, label: `Target date: ${formatDate(night.targetDate, "EEE, MMM d, yyyy")}` } : { label: "Date to be decided" };
}

function ScheduleSkeleton() {
  return (
    <section aria-label="Loading movie nights" aria-busy="true" className="space-y-4">
      <span className="sr-only">Loading movie nights</span>
      {[0, 1, 2].map(item => (
        <div key={item} className="mc-panel flex min-w-0 gap-4 p-4 sm:p-6" aria-hidden="true">
          <div className="mc-skeleton h-24 w-16 shrink-0 sm:h-30 sm:w-20" />
          <div className="min-w-0 flex-1 space-y-3 py-1"><div className="mc-skeleton h-4 w-20" /><div className="mc-skeleton h-6 w-3/4" /><div className="mc-skeleton h-4 w-1/2" /></div>
        </div>
      ))}
    </section>
  );
}
