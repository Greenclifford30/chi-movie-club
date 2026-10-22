"use client";

import { Check, Film, Heart, Lightbulb, Loader2, Search, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/movie-club/app-shell";
import { EmptyState } from "@/components/movie-club/empty-state";
import { PageSkeleton } from "@/components/movie-club/page-skeleton";
import { StatusAlert } from "@/components/movie-club/status-alert";
import { DEFAULT_PLANNING_RADIUS, DEFAULT_PLANNING_ZIP, PlanningPreferencesFields, validatePlanningLocation } from "@/components/movie-club/planning-preferences-fields";
import { localDateValue, moviePlanningDates, validatePlanningWindow } from "@/lib/movie-club-planning";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { listClubs, MovieClubApiError, scheduleMovieProposal, createMovieProposal, endorseMovieProposal, listMovieProposals, removeMovieProposalEndorsement, searchMovies, updateMovieProposal } from "@/lib/movie-club-api";
import { formatDate, posterUrl } from "@/lib/movie-club-format";
import type { MovieProposal, MovieProposalStatus, MovieNightPlanningInput, MovieSnapshot } from "@/lib/movie-club-types";

export default function ClubSuggestionsPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<MovieProposalStatus>("open");
  const [cursor, setCursor] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [proposals, setProposals] = useState<MovieProposal[]>([]);
  const [results, setResults] = useState<MovieSnapshot[]>([]);
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState("");
  const [selectedMovie, setSelectedMovie] = useState<MovieSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadProposals = useCallback(async (findId?: string) => {
    if (!token) return;
    const result = await listMovieProposals(token, clubId, status);
    const found = [...result.proposals];
    let next = result.nextCursor;
    while (findId && !found.some(p => p.proposalId === findId) && next) {
      const page = await listMovieProposals(token, clubId, status, { cursor: next });
      found.push(...page.proposals); next = page.nextCursor;
    }
    setProposals(found); setCursor(next || null);
  }, [clubId, status, token]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token) return;
      setIsLoading(true);
      setError(null);
      try {
        const result = await listMovieProposals(token, clubId, status);
        const loaded = [...result.proposals];
        let next = result.nextCursor;
        while (!cancelled && status === "open" && duplicateId && !loaded.some(item => item.proposalId === duplicateId) && next) {
          const page = await listMovieProposals(token, clubId, status, { cursor: next });
          loaded.push(...page.proposals); next = page.nextCursor;
        }
        if (!cancelled) { setProposals(loaded); setCursor(next || null); }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load film suggestions.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [clubId, duplicateId, status, token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    listClubs(token).then(({ clubs }) => { if (!cancelled) setIsAdmin(clubs.find(c => c.clubId === clubId)?.role === "admin"); }).catch(() => {});
    return () => { cancelled = true; };
  }, [clubId, token]);

  async function more() {
    if (!token || !cursor) return;
    setWorkingId("more"); setError(null);
    try {
      const result = await listMovieProposals(token, clubId, status, { cursor });
      setProposals(current => [...current, ...result.proposals.filter(p => !current.some(c => c.proposalId === p.proposalId))]);
      setCursor(result.nextCursor || null);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load suggestions."); }
    finally { setWorkingId(null); }
  }

  async function proposalChanged() { await loadProposals(); }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !query.trim()) return;
    setIsSearching(true);
    setError(null);
    setResults([]);
    setSearchedQuery(null);
    setSelectedMovie(null);
    try {
      const result = await searchMovies(token, query.trim());
      setResults(result.results);
      setSearchedQuery(query.trim());
      setMessage(null);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Unable to search films.");
    } finally {
      setIsSearching(false);
    }
  }

  async function proposeFilm() {
    if (!token || !selectedMovie) return;
    setWorkingId("new");
    setError(null);
    setMessage(null);
    try {
      await createMovieProposal(token, clubId, { provider: selectedMovie.provider, externalId: selectedMovie.externalId }, reason.trim());
      if (status === "open") await loadProposals();
      else setStatus("open");
      setSelectedMovie(null);
      setQuery("");
      setReason("");
      setResults([]);
      setSearchedQuery(null);
      setMessage("Film added to club suggestions.");
    } catch (saveError) {
      if (saveError instanceof MovieClubApiError && saveError.existingProposalId) {
        setDuplicateId(saveError.existingProposalId);
        if (status !== "open") setStatus("open");
      }
      setError(saveError instanceof Error ? saveError.message : "Unable to propose this film.");
    } finally {
      setWorkingId(null);
    }
  }

  async function toggleEndorsement(proposal: MovieProposal) {
    if (!token) return;
    setWorkingId(proposal.proposalId);
    setError(null);
    try {
      const result = proposal.viewerHasEndorsed
        ? await removeMovieProposalEndorsement(token, clubId, proposal.proposalId)
        : await endorseMovieProposal(token, clubId, proposal.proposalId);
      setProposals((current) => current.map((item) => item.proposalId === proposal.proposalId ? result.proposal : item).sort((a, b) => b.endorsementCount - a.endorsementCount || (a.createdAt || "").localeCompare(b.createdAt || "") || a.proposalId.localeCompare(b.proposalId)));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update your endorsement.");
    } finally {
      setWorkingId(null);
    }
  }

  async function withdraw(proposal: MovieProposal) {
    if (!token) return;
    setWorkingId(proposal.proposalId);
    setError(null);
    try {
      await updateMovieProposal(token, clubId, proposal.proposalId, { status: "withdrawn", version: proposal.version });
      setProposals((current) => current.filter((item) => item.proposalId !== proposal.proposalId));
      setMessage("Your suggestion was withdrawn.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to withdraw this suggestion.");
      if (saveError instanceof MovieClubApiError && saveError.status === 409) await loadProposals();
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <AppShell>
      <div className="mc-page [overflow-wrap:anywhere] [&_button]:scroll-mt-24 [&_button]:scroll-mb-24">
        <section className="mb-8 border-b border-white/10 pb-7 sm:mb-10">
          <h1 className="mc-title" style={{ letterSpacing: "-0.03em" }}>Film suggestions</h1>
          <p className="mt-3 text-lg font-medium text-slate-200">Pick the next film together</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">Suggest a movie you would love to see with the club. Members can endorse ideas; a host can turn one into a movie night.</p>
        </section>

        {error ? <StatusAlert tone="danger" className="mb-4">{error}</StatusAlert> : null}
        {duplicateId ? <p className="mb-4 text-sm text-cyan-200"><a href={`#proposal-${duplicateId}`}>View the existing suggestion</a></p> : null}
        {message ? <StatusAlert tone="success" className="mb-4">{message}</StatusAlert> : null}

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.4fr)]">
          <Card className="min-w-0 border-white/10 bg-slate-900/70 py-5 sm:py-6">
            <div className="px-5 sm:px-6">
              <h2 className="text-lg font-semibold text-white">Add a film idea</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">Search the catalog and tell the club why it belongs on the list.</p>
              <form onSubmit={search} role="search" className="mt-5 flex gap-2">
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search movie titles" aria-label="Search movie titles" maxLength={120} className="min-w-0 flex-1" />
                <Button type="submit" aria-label="Search movies" disabled={isSearching || !query.trim()}>{isSearching ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Search aria-hidden="true" className="size-4" />}Search</Button>
              </form>
              <div role="status" className="text-sm text-slate-400">
                {isSearching ? <p className="mt-3">Searching films…</p> : searchedQuery ? <p className="mt-4">{results.length ? `Select a film · ${Math.min(results.length, 8)} ${results.length === 1 ? "result" : "results"}` : searchedQuery === query.trim() ? "No films found. Try another title." : null}</p> : null}
              </div>
              {results.length ? <div className="mt-3 max-h-80 space-y-2 overflow-y-auto overscroll-contain p-1 -mx-1 [scrollbar-color:var(--border)_transparent]" aria-label="Search results">
                {results.slice(0, 8).map((movie) => {
                  const active = selectedMovie?.provider === movie.provider && selectedMovie.externalId === movie.externalId;
                  return <button key={`${movie.provider}-${movie.externalId}`} type="button" aria-pressed={active} onClick={() => setSelectedMovie(movie)} className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${active ? "border-cyan-300/50 bg-cyan-400/10" : "border-white/10 bg-white/[.03] hover:bg-white/[.07]"}`}>
                    <Poster movie={movie} />
                    <span className="min-w-0 flex-1"><span className="block break-words text-sm font-medium leading-5 text-white">{movie.title}</span><span className="mt-1 block text-xs leading-5 text-slate-400"><ReleaseDate movie={movie} /></span></span>
                    {active ? <Check aria-hidden="true" className="size-4 shrink-0 text-cyan-200" /> : null}
                  </button>;
                })}
              </div> : null}
              {selectedMovie ? <div className="mt-4 border-t border-white/10 pt-4">
                <p className="break-words text-sm font-medium text-white">Suggestion: {selectedMovie.title}</p>
                <label htmlFor="proposal-reason" className="mt-4 flex items-center justify-between gap-2 text-sm text-slate-300">Why this film? <span className="text-xs text-slate-400">Optional</span></label>
                <textarea id="proposal-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} rows={3} placeholder="A short note for the club" className="mt-2 w-full resize-y rounded-md border border-white/15 bg-white/[.04] px-3 py-2 text-sm leading-6 text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300" />
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <Button variant="outline" onClick={() => setSelectedMovie(null)}><X className="size-4" />Clear</Button>
                  <Button onClick={proposeFilm} disabled={workingId === "new"}>{workingId === "new" ? <Loader2 className="size-4 animate-spin" /> : <Lightbulb className="size-4" />}Suggest film</Button>
                </div>
              </div> : null}
            </div>
          </Card>

          <section aria-labelledby="open-suggestions-heading" className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 id="open-suggestions-heading" className="text-lg font-semibold text-white">Club suggestions</h2>
                {!isLoading ? <span className="text-sm tabular-nums text-slate-400">{proposals.length}{cursor ? "+" : ""} {proposals.length === 1 && !cursor ? "film" : "films"}</span> : null}
              </div>
              <label className="text-sm text-slate-300"><span className="sr-only">Suggestion status</span><select aria-label="Suggestion status" disabled={workingId !== null} value={status} onChange={event => { setStatus(event.target.value as MovieProposalStatus); setProposals([]); setCursor(null); setIsLoading(true); }} className="min-h-11 rounded-md border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 md:min-h-9">{(["open", "scheduled", "withdrawn", "dismissed"] as const).map(value => <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>)}</select></label>
            </div>
            {isLoading ? <PageSkeleton label="Loading film suggestions" /> : proposals.length ? <div className="space-y-3">
            {proposals.map((proposal) => <ProposalCard key={proposal.proposalId} proposal={proposal} working={workingId === proposal.proposalId} onEndorse={() => void toggleEndorsement(proposal)} onWithdraw={() => void withdraw(proposal)} controls={token ? <ProposalControls proposal={proposal} token={token} clubId={clubId} isAdmin={isAdmin} onChanged={proposalChanged} onScheduled={id => router.push(`/clubs/${encodeURIComponent(clubId)}/movie-nights/${encodeURIComponent(id)}/admin`)} /> : null} />)}
            </div> : !error ? <EmptyState title={status === "open" ? "No film suggestions yet" : `No ${status} suggestions`} description={status === "open" ? "Start the list with a film you would like to watch together." : `Films marked as ${status} will appear here.`} icon={<Lightbulb className="size-5" />} /> : null}
          {cursor ? <Button variant="outline" className="mt-4 w-full" onClick={() => void more()} disabled={workingId === "more"}>{workingId === "more" ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}Load more suggestions</Button> : null}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function ProposalCard({ proposal, working, onEndorse, onWithdraw, controls }: { proposal: MovieProposal; working: boolean; onEndorse: () => void; onWithdraw: () => void; controls: React.ReactNode }) {
  return <Card id={`proposal-${proposal.proposalId}`} className="scroll-mt-24 border-white/10 bg-slate-900/70 py-5 target:border-cyan-300/60">
    <CardContent>
      <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-4 gap-y-4">
        <Poster movie={proposal.movie} large />
        <div className="min-w-0">
          <h3 className="break-words text-lg font-semibold leading-6 text-white">{proposal.movie.title}</h3>
          <p className="mt-2 text-xs leading-5 text-slate-400"><ReleaseDate movie={proposal.movie} /></p>
          {proposal.proposerName ? <p className="mt-1 break-words text-xs leading-5 text-slate-400">Suggested by {proposal.proposerName}</p> : null}
          {proposal.createdAt ? <time dateTime={proposal.createdAt} className="mt-1 block text-xs leading-5 text-slate-400">{formatDate(proposal.createdAt)}</time> : null}
        </div>
        {proposal.reason ? <p className="col-span-2 whitespace-pre-line break-words text-sm leading-6 text-slate-300">{proposal.reason}</p> : null}
        <div className="col-span-2 flex flex-wrap items-center justify-between gap-2">
          <Button size="sm" variant="outline" className={proposal.viewerHasEndorsed ? "border-violet-300/30 bg-violet-400/10 text-violet-200 hover:bg-violet-400/20" : undefined} onClick={onEndorse} disabled={working || proposal.status !== "open"} aria-pressed={proposal.viewerHasEndorsed}>
            {working ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Heart aria-hidden="true" className={`size-4 ${proposal.viewerHasEndorsed ? "fill-current" : ""}`} />}
            {proposal.viewerHasEndorsed ? "Endorsed" : "I’m interested"}<span aria-hidden="true" className="mx-1 h-3 border-l border-current opacity-30" /><span className="tabular-nums">{proposal.endorsementCount}</span>
          </Button>
          {proposal.status === "open" && proposal.viewerCanWithdraw ? <Button size="sm" variant="ghost" onClick={onWithdraw} disabled={working} className="text-slate-400 hover:text-rose-200">Withdraw</Button> : null}
        </div>
      </div>
      {proposal.movieNightId ? <Link className="mt-4 block text-sm text-cyan-200" href={`/clubs/${encodeURIComponent(proposal.clubId)}/movie-nights/${encodeURIComponent(proposal.movieNightId)}`}>View scheduled movie night</Link> : null}
      {proposal.moderationReason ? <p className="mt-3 break-words text-sm leading-6 text-slate-400">Dismissal reason: {proposal.moderationReason}</p> : null}
      {controls}
    </CardContent>
  </Card>;
}

function ReleaseDate({ movie }: { movie: MovieSnapshot }) {
  if (movie.releaseDate) {
    return <>Release date: <time dateTime={movie.releaseDate}>{formatDate(movie.releaseDate, "MMM d, yyyy")}</time></>;
  }
  return <>{movie.releaseYear ? `${movie.releaseYear} · ` : ""}Release date TBD</>;
}

function Poster({ movie, large = false }: { movie: MovieSnapshot; large?: boolean }) {
  const image = posterUrl(movie);
  return <div className={`relative shrink-0 overflow-hidden rounded-md bg-slate-950 ${large ? "h-[6.75rem] w-[4.5rem]" : "h-[3.75rem] w-10"}`}>
    {image ? <Image src={image} alt="" fill sizes={large ? "72px" : "40px"} className="object-cover" /> : <div className="grid h-full place-items-center text-slate-400"><Film aria-hidden="true" className={large ? "size-6" : "size-4"} /></div>}
  </div>;
}

function ProposalControls({ proposal, token, clubId, isAdmin, onChanged, onScheduled }: { proposal: MovieProposal; token: string; clubId: string; isAdmin: boolean; onChanged: () => Promise<void>; onScheduled: (id: string) => void }) {
  const [mode, setMode] = useState<"edit" | "dismiss" | "schedule" | null>(null);
  const [reason, setReason] = useState(proposal.reason || "");
  const [moderationReason, setModerationReason] = useState("");
  const today = localDateValue();
  const [planning, setPlanning] = useState<MovieNightPlanningInput>(() => ({ ...moviePlanningDates(proposal.movie.releaseDate, today), zipCode: DEFAULT_PLANNING_ZIP, radiusMiles: DEFAULT_PLANNING_RADIUS, timezone: "America/Chicago", preferredFormats: [], preferredTheaterIds: [] }));
  const retries = useRef(new Map<string, string>());
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (proposal.status !== "open" || (!proposal.viewerCanWithdraw && !isAdmin)) return null;
  async function save() {
    setError(null);
    if (mode === "schedule") {
      const invalid = validatePlanningLocation(planning.zipCode, planning.radiusMiles) || validatePlanningWindow(planning, today);
      if (invalid) { setError(invalid); return; }
    }
    if (mode === "dismiss" && !moderationReason.trim()) { setError("Enter a dismissal reason."); return; }
    setWorking(true);
    try {
      if (mode === "schedule") {
        const input = { ...planning, version: proposal.version };
        const fingerprint = JSON.stringify(input);
        if (!retries.current.has(fingerprint)) retries.current.set(fingerprint, crypto.randomUUID());
        const result = await scheduleMovieProposal(token, clubId, proposal.proposalId, { ...input, idempotencyKey: retries.current.get(fingerprint)! });
        onScheduled(result.movieNight.movieNightId);
      } else {
        await updateMovieProposal(token, clubId, proposal.proposalId, mode === "edit" ? { reason: reason.trim(), version: proposal.version } : { status: "dismissed", moderationReason: moderationReason.trim(), version: proposal.version });
        setMode(null); await onChanged();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update this suggestion.");
      if (e instanceof MovieClubApiError && e.status === 409) await onChanged();
    } finally { setWorking(false); }
  }
  return <div className="mt-4 border-t border-white/10 pt-3">
    <div className="flex flex-wrap gap-2">{proposal.viewerCanWithdraw ? <Button size="sm" variant="ghost" disabled={working} onClick={() => { setMode("edit"); setReason(proposal.reason || ""); }}>Edit reason</Button> : null}{isAdmin ? <><Button size="sm" variant="outline" disabled={working} onClick={() => setMode("schedule")}>Schedule movie night</Button><Button size="sm" variant="ghost" disabled={working} className="text-slate-400 hover:text-rose-200" onClick={() => setMode("dismiss")}>Dismiss</Button></> : null}</div>
    {mode ? <form className="mt-5 space-y-4 [&_textarea]:resize-y [&_textarea]:focus-visible:outline-none [&_textarea]:focus-visible:ring-2 [&_textarea]:focus-visible:ring-violet-300" onSubmit={event => { event.preventDefault(); void save(); }}>
      {mode === "edit" ? <label className="block text-sm">Suggestion reason<textarea aria-label="Suggestion reason" className="mt-2 w-full rounded border border-white/15 bg-slate-950 p-3" maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} /></label> : null}
      {mode === "dismiss" ? <label className="block text-sm">Dismissal reason<textarea aria-label="Dismissal reason" required maxLength={1000} className="mt-2 w-full rounded border border-white/15 bg-slate-950 p-3" value={moderationReason} onChange={event => setModerationReason(event.target.value)} /></label> : null}
      {mode === "schedule" ? <>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Target date<Input aria-label="Target date" type="date" min={today} required value={planning.targetDate} onChange={e => setPlanning(current => ({ ...current, targetDate: e.target.value, dateWindowStart: e.target.value, dateWindowEnd: e.target.value }))} /></label><label className="text-sm">Timezone<Input aria-label="Timezone" required value={planning.timezone} onChange={e => setPlanning(current => ({ ...current, timezone: e.target.value }))} /></label><label className="text-sm">Window start<Input aria-label="Window start" required type="date" min={today} value={planning.dateWindowStart} onChange={e => setPlanning(current => ({ ...current, dateWindowStart: e.target.value }))} /></label><label className="text-sm">Window end<Input aria-label="Window end" required type="date" min={planning.dateWindowStart} value={planning.dateWindowEnd} onChange={e => setPlanning(current => ({ ...current, dateWindowEnd: e.target.value }))} /></label></div>
        <PlanningPreferencesFields zipCode={planning.zipCode} radiusMiles={planning.radiusMiles} preferredFormats={planning.preferredFormats || []} onZipCodeChange={zipCode => setPlanning(current => ({ ...current, zipCode }))} onRadiusMilesChange={radiusMiles => setPlanning(current => ({ ...current, radiusMiles }))} onPreferredFormatsChange={preferredFormats => setPlanning(current => ({ ...current, preferredFormats }))} />
        <label className="block text-sm">Preferred theater IDs (comma separated)<Input value={(planning.preferredTheaterIds || []).join(", ")} onChange={e => setPlanning(current => ({ ...current, preferredTheaterIds: e.target.value.split(",").map(v => v.trim()).filter(Boolean) }))} /></label>
      </> : null}
      {error ? <StatusAlert tone="danger">{error}</StatusAlert> : null}
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={working}>{working ? "Saving…" : mode === "schedule" ? "Create linked movie night" : "Save"}</Button><Button type="button" variant="ghost" disabled={working} onClick={() => setMode(null)}>Close</Button></div>
    </form> : null}
  </div>;
}
