"use client";

import { Check, Heart, Lightbulb, Loader2, Search, X } from "lucide-react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/movie-club/app-shell";
import { EmptyState } from "@/components/movie-club/empty-state";
import { PageSkeleton } from "@/components/movie-club/page-skeleton";
import { StatusAlert } from "@/components/movie-club/status-alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { createMovieProposal, endorseMovieProposal, listMovieProposals, removeMovieProposalEndorsement, searchMovies, updateMovieProposal } from "@/lib/movie-club-api";
import { formatDate, posterUrl } from "@/lib/movie-club-format";
import type { MovieProposal, MovieSnapshot } from "@/lib/movie-club-types";

export default function ClubSuggestionsPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const { token } = useAuth();
  const [proposals, setProposals] = useState<MovieProposal[]>([]);
  const [results, setResults] = useState<MovieSnapshot[]>([]);
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState("");
  const [selectedMovie, setSelectedMovie] = useState<MovieSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadProposals = useCallback(async () => {
    if (!token) return;
    const result = await listMovieProposals(token, clubId, "open");
    setProposals(result.proposals);
  }, [clubId, token]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token) return;
      setIsLoading(true);
      setError(null);
      try {
        const result = await listMovieProposals(token, clubId, "open");
        if (!cancelled) setProposals(result.proposals);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load film suggestions.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [clubId, token]);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !query.trim()) return;
    setIsSearching(true);
    setError(null);
    setResults([]);
    setSelectedMovie(null);
    try {
      const result = await searchMovies(token, query.trim());
      setResults(result.results);
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
      await loadProposals();
      setSelectedMovie(null);
      setQuery("");
      setReason("");
      setResults([]);
      setMessage("Film added to club suggestions.");
    } catch (saveError) {
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
      setProposals((current) => current.map((item) => item.proposalId === proposal.proposalId ? result.proposal : item));
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
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <AppShell>
      <div className="mc-page">
        <section className="mb-8 border-b border-white/10 pb-6">
          <p className="mb-2 flex items-center gap-2 text-sm text-cyan-300"><Lightbulb className="size-4" /> Pick the next film together</p>
          <h1 className="mc-title">Film suggestions</h1>
          <p className="mt-2 max-w-2xl text-slate-400">Suggest a movie you would love to see with the club. Members can endorse ideas; a host can turn one into a movie night.</p>
        </section>

        {error ? <StatusAlert tone="danger" className="mb-4">{error}</StatusAlert> : null}
        {message ? <StatusAlert tone="success" className="mb-4">{message}</StatusAlert> : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Card className="h-fit border-white/10 bg-slate-900/70 py-5">
            <div className="px-5 sm:px-6">
              <h2 className="text-lg font-semibold text-white">Add a film idea</h2>
              <p className="mt-1 text-sm text-slate-400">Search the catalog and tell the club why it belongs on the list.</p>
              <form onSubmit={search} className="mt-4 flex gap-2">
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search movie titles" aria-label="Search movie titles" maxLength={120} />
                <Button type="submit" aria-label="Search movies" disabled={isSearching || !query.trim()}><Search className="size-4" />Search</Button>
              </form>
              {isSearching ? <p className="mt-3 flex items-center gap-2 text-sm text-slate-400"><Loader2 className="size-4 animate-spin" />Searching films</p> : null}
              {results.length ? <div className="mt-4 space-y-2" aria-label="Search results">
                {results.slice(0, 8).map((movie) => {
                  const active = selectedMovie?.provider === movie.provider && selectedMovie.externalId === movie.externalId;
                  return <button key={`${movie.provider}-${movie.externalId}`} type="button" onClick={() => setSelectedMovie(movie)} className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left transition ${active ? "border-cyan-300/50 bg-cyan-400/10" : "border-white/10 bg-white/[.03] hover:bg-white/[.07]"}`}>
                    <Poster movie={movie} />
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium text-white">{movie.title}</span><span className="text-xs text-slate-400">{movie.releaseYear || movie.releaseDate?.slice(0, 4) || "Year unknown"}</span></span>
                    {active ? <Check className="size-4 text-cyan-200" /> : null}
                  </button>;
                })}
              </div> : query.trim() && !isSearching && !error ? <p className="mt-4 text-sm text-slate-400">No films found. Try another title.</p> : null}
              {selectedMovie ? <div className="mt-4 border-t border-white/10 pt-4">
                <p className="text-sm font-medium text-white">Suggestion: {selectedMovie.title}</p>
                <label htmlFor="proposal-reason" className="mt-3 block text-sm text-slate-300">Why this film? <span className="text-slate-500">Optional</span></label>
                <textarea id="proposal-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} rows={3} placeholder="A short note for the club" className="mt-2 w-full rounded-md border border-white/15 bg-white/[.04] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300" />
                <div className="mt-3 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setSelectedMovie(null)}><X className="size-4" />Clear</Button>
                  <Button onClick={proposeFilm} disabled={workingId === "new"}>{workingId === "new" ? <Loader2 className="size-4 animate-spin" /> : <Lightbulb className="size-4" />}Suggest film</Button>
                </div>
              </div> : null}
            </div>
          </Card>

          <section aria-labelledby="open-suggestions-heading">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 id="open-suggestions-heading" className="text-xl font-semibold text-white">Open suggestions</h2>
              <span className="text-sm text-slate-400">{proposals.length} {proposals.length === 1 ? "film" : "films"}</span>
            </div>
            {isLoading ? <PageSkeleton label="Loading film suggestions" /> : proposals.length ? <div className="space-y-3">
            {proposals.map((proposal) => <ProposalCard key={proposal.proposalId} proposal={proposal} working={workingId === proposal.proposalId} onEndorse={() => void toggleEndorsement(proposal)} onWithdraw={() => void withdraw(proposal)} />)}
            </div> : !error ? <EmptyState title="No film suggestions yet" description="Start the list with a film you would like to watch together." icon={<Lightbulb className="size-5" />} /> : null}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function ProposalCard({ proposal, working, onEndorse, onWithdraw }: { proposal: MovieProposal; working: boolean; onEndorse: () => void; onWithdraw: () => void }) {
  return <Card className="border-white/10 bg-slate-900/70 py-4">
    <CardContent>
      <div className="flex gap-4">
        <Poster movie={proposal.movie} large />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h3 className="font-semibold text-white">{proposal.movie.title}</h3><p className="mt-1 text-xs text-slate-400">{proposal.movie.releaseYear || proposal.movie.releaseDate?.slice(0, 4) || "Release year unknown"}{proposal.proposerName ? ` · Suggested by ${proposal.proposerName}` : ""}</p></div>
            {proposal.createdAt ? <span className="text-xs text-slate-500">{formatDate(proposal.createdAt)}</span> : null}
          </div>
          {proposal.reason ? <p className="mt-3 text-sm leading-6 text-slate-300">{proposal.reason}</p> : null}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm" variant={proposal.viewerHasEndorsed ? "secondary" : "outline"} onClick={onEndorse} disabled={working} aria-pressed={proposal.viewerHasEndorsed}>
              {working ? <Loader2 className="size-4 animate-spin" /> : <Heart className={`size-4 ${proposal.viewerHasEndorsed ? "fill-current" : ""}`} />}
              {proposal.viewerHasEndorsed ? "Endorsed" : "I’m interested"} · {proposal.endorsementCount}
            </Button>
            {proposal.viewerCanWithdraw ? <Button size="sm" variant="ghost" onClick={onWithdraw} disabled={working} className="text-slate-400 hover:text-rose-200">Withdraw</Button> : null}
          </div>
        </div>
      </div>
    </CardContent>
  </Card>;
}

function Poster({ movie, large = false }: { movie: MovieSnapshot; large?: boolean }) {
  const image = posterUrl(movie);
  return <div className={`relative shrink-0 overflow-hidden rounded bg-slate-950 ${large ? "h-28 w-[4.5rem]" : "h-14 w-10"}`}>
    {image ? <Image src={image} alt="" fill sizes={large ? "72px" : "40px"} className="object-cover" /> : <div className="grid h-full place-items-center text-slate-600"><Lightbulb className="size-4" /></div>}
  </div>;
}
