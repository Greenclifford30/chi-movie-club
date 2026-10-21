"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/movie-club/app-shell";
import { PageSkeleton } from "@/components/movie-club/page-skeleton";
import { StatusAlert } from "@/components/movie-club/status-alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { listClubs, listMovieNights, listMyMovieNights } from "@/lib/movie-club-api";
import { formatDate, showtimeDateTime } from "@/lib/movie-club-format";
import type { MovieNightSummary } from "@/lib/movie-club-types";

const actionLabels: Record<string, string> = { vote: "Vote on showtimes", edit_vote: "Edit your ballot", rsvp: "Respond to the plan", review_tickets: "Review your tickets", acknowledge_plan: "Acknowledge changed plan" };

export function MovieNightList({ clubId }: { clubId?: string }) {
  const { token } = useAuth();
  const [nights, setNights] = useState<MovieNightSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [scope, setScope] = useState<"upcoming" | "recent">("upcoming");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [clubName, setClubName] = useState("Club schedule");
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true); setError(null); setNights([]); setCursor(null);
    const request = clubId ? listMovieNights(token, clubId) : listMyMovieNights(token, { scope });
    request.then(result => { if (!cancelled) { setNights(result.movieNights); setCursor(result.nextCursor || null); } })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load movie nights."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    if (clubId) listClubs(token).then(result => { if (!cancelled) { const club = result.clubs.find(c => c.clubId === clubId); setIsAdmin(club?.role === "admin"); setClubName(club?.name || "Club schedule"); } }).catch(() => {});
    return () => { cancelled = true; };
  }, [clubId, scope, token]);
  async function loadMore() {
    if (!token || !cursor) return;
    setLoadingMore(true); setError(null);
    try {
      const result = clubId ? await listMovieNights(token, clubId, { cursor }) : await listMyMovieNights(token, { cursor, scope });
      setNights(current => [...current, ...result.movieNights.filter(n => !current.some(c => c.movieNightId === n.movieNightId))]);
      setCursor(result.nextCursor || null);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load more movie nights."); }
    finally { setLoadingMore(false); }
  }
  return <AppShell><div className="mc-page">
    <section className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
      <div><p className="mb-2 text-sm text-cyan-300">{clubId ? clubName : "Across your clubs"}</p><h1 className="mc-title">{clubId ? "Movie night schedule" : "My movie nights"}</h1><p className="mt-2 text-slate-400">{scope === "recent" ? "Completed outings from the past 30 days." : "Plan, vote, and RSVP to each outing independently."}</p></div>
      {clubId && isAdmin ? <Button asChild><Link href={`/clubs/${clubId}/movie-nights/new`}>Create a movie night</Link></Button> : null}
      {!clubId ? <div className="flex gap-2"><Button variant={scope === "upcoming" ? "secondary" : "outline"} disabled={loadingMore} onClick={() => setScope("upcoming")}>Upcoming</Button><Button variant={scope === "recent" ? "secondary" : "outline"} disabled={loadingMore} onClick={() => setScope("recent")}>Recent</Button></div> : null}
    </section>
    {error ? <StatusAlert tone="danger">{error}</StatusAlert> : null}
    {loading ? <PageSkeleton label="Loading movie nights" /> : !nights.length && !error ? <p className="py-12 text-slate-400">No {scope} movie nights yet.</p> : <div className="grid gap-4 md:grid-cols-2">{nights.map(night => {
      const href = `/clubs/${night.clubId}/movie-nights/${night.movieNightId}`;
      const start = night.confirmedShowtime?.startsAtUtc;
      const awaiting = night.status === "confirmed" && start && Date.parse(start) < Date.now();
      const rsvp = night.currentUserRsvp;
      return <article key={night.movieNightId} className="rounded-xl border border-white/10 bg-[#141b29] p-5">
        <div className="flex items-center justify-between gap-3 text-sm"><span className="text-cyan-200">{night.status}</span>{!clubId ? <span className="text-slate-400">{night.clubName}</span> : null}</div>
        <h2 className="mt-3 text-xl font-semibold"><Link href={href} className="hover:text-violet-200">{night.movie.title}</Link></h2>
        <p className="mt-2 text-sm text-slate-300">{night.confirmedShowtime ? showtimeDateTime(night.confirmedShowtime) : night.targetDate ? formatDate(night.targetDate) : "Date to be decided"} · {night.timezone || "America/Chicago"}</p>
        {awaiting ? <p className="mt-2 text-sm text-amber-200">Awaiting completion</p> : null}
        {rsvp ? <p className="mt-2 text-sm text-slate-400">RSVP: {rsvp.status.replaceAll("_", " ")}{(rsvp.rsvpPlanRevision ?? 1) < (night.planRevision ?? 1) ? " · Needs reconfirmation" : ""}</p> : null}
        {night.currentUserVote ? <p className="mt-2 text-sm text-slate-400">Ballot saved</p> : null}
        {night.conflicts?.length ? <p className="mt-2 text-sm text-amber-200">{night.conflicts.some(c => c.uncertain) ? "Possible overlap; an end time is unknown." : "Overlaps another movie night."}</p> : null}
        <div className="mt-4 flex flex-wrap gap-3"><Button asChild variant="outline"><Link href={href}>{night.nextActions?.length ? actionLabels[night.nextActions[0]] || "View next action" : "View movie night"}</Link></Button>{clubId && isAdmin ? <Button asChild variant="ghost"><Link href={`${href}/admin`}>Manage</Link></Button> : null}</div>
      </article>;
    })}</div>}
    {cursor ? <Button className="mt-6" variant="outline" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? "Loading…" : "Load more"}</Button> : null}
  </div></AppShell>;
}
