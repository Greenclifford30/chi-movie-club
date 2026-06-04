"use client";

import { CalendarClock, Check, Clapperboard, Copy, Loader2, MailPlus, RefreshCcw, Search, ShieldCheck, Ticket, Vote } from "lucide-react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/movie-club/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import {
  confirmShowtime,
  createClubInvites,
  createMovieNight,
  getActiveMovieNight,
  getNowPlayingMovies,
  getVoteResults,
  listClubInvites,
  MovieClubApiError,
  refreshGracenote,
  searchMovies,
} from "@/lib/movie-club-api";
import { formatDate, formatTime, posterUrl, showtimeDateTime, showtimeLabel } from "@/lib/movie-club-format";
import type { ActiveMovieNightResponse, ClubInvite, MovieSnapshot, Showtime, VoteResults } from "@/lib/movie-club-types";

type SaveState = "idle" | "saving" | "saved" | "error";

const setupSteps = [
  { label: "Movie", icon: Clapperboard },
  { label: "Showtimes", icon: Ticket },
  { label: "Voting", icon: Vote },
  { label: "Confirmation", icon: ShieldCheck },
];

export default function ClubAdminPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const { token } = useAuth();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [active, setActive] = useState<ActiveMovieNightResponse | null>(null);
  const [invites, setInvites] = useState<ClubInvite[]>([]);
  const [inviteEmails, setInviteEmails] = useState("");
  const [results, setResults] = useState<VoteResults | null>(null);
  const [movies, setMovies] = useState<MovieSnapshot[]>([]);
  const [nowPlayingMovies, setNowPlayingMovies] = useState<MovieSnapshot[]>([]);
  const [isNowPlayingLoading, setIsNowPlayingLoading] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<MovieSnapshot | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [targetDate, setTargetDate] = useState(today);
  const [refreshForm, setRefreshForm] = useState({ zip: "60422", radius: 30, numDays: 14, units: "mi" as const });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadActive() {
    if (!token) {
      return;
    }
    try {
      const nextActive = await getActiveMovieNight(token, clubId);
      setActive(nextActive);
      setSelectedMovie(nextActive.movieNight.movie);
      if (nextActive.movieNight.status === "voting" || nextActive.movieNight.status === "confirmed") {
        const nextResults = await getVoteResults(token, nextActive.movieNight.movieNightId);
        setResults(nextResults);
      }
    } catch (activeError) {
      setActive(null);
      setResults(null);
      if (activeError instanceof MovieClubApiError && activeError.status !== 404) {
        setError(activeError.message);
      }
    }
  }

  async function loadInvites() {
    if (!token) {
      return;
    }
    try {
      const result = await listClubInvites(token, clubId);
      setInvites(result.invites);
    } catch (inviteError) {
      setInvites([]);
      if (inviteError instanceof MovieClubApiError) {
        setError(inviteError.message);
      }
    }
  }

  async function loadNowPlaying() {
    if (!token) {
      return;
    }
    setIsNowPlayingLoading(true);
    try {
      const result = await getNowPlayingMovies(token);
      setNowPlayingMovies(result.results);
    } catch (nowPlayingError) {
      setNowPlayingMovies([]);
      setError(nowPlayingError instanceof Error ? nowPlayingError.message : "Unable to load now playing movies.");
    } finally {
      setIsNowPlayingLoading(false);
    }
  }

  useEffect(() => {
    loadActive();
    loadInvites();
    loadNowPlaying();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, token]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || searchQuery.trim().length < 2) {
      return;
    }
    setSaveState("saving");
    setError(null);
    setMessage(null);
    try {
      const result = await searchMovies(token, searchQuery.trim());
      setMovies(result.results);
      setSaveState("idle");
    } catch (searchError) {
      setSaveState("error");
      setError(searchError instanceof Error ? searchError.message : "Unable to search movies.");
    }
  }

  async function handleCreateMovieNight() {
    if (!token || !selectedMovie || !targetDate) {
      return;
    }
    setSaveState("saving");
    setError(null);
    setMessage(null);
    try {
      await createMovieNight(token, clubId, {
        targetDate,
        movieSelectionMode: "admin_selected",
        movie: selectedMovie,
      });
      setSaveState("saved");
      setMessage("Movie night created.");
      await loadActive();
    } catch (createError) {
      setSaveState("error");
      setError(createError instanceof Error ? createError.message : "Unable to create movie night.");
    }
  }

  async function handleRefreshGracenote() {
    if (!token) {
      return;
    }
    setSaveState("saving");
    setError(null);
    setMessage(null);
    try {
      await refreshGracenote(token, refreshForm);
      setSaveState("saved");
      setMessage("Gracenote refresh queued.");
    } catch (refreshError) {
      setSaveState("error");
      setError(refreshError instanceof Error ? refreshError.message : "Unable to queue Gracenote refresh.");
    }
  }

  async function handleConfirm(showtimeId: string) {
    if (!token || !active?.movieNight) {
      return;
    }
    setSaveState("saving");
    setError(null);
    setMessage(null);
    try {
      await confirmShowtime(token, active.movieNight.movieNightId, showtimeId);
      setSaveState("saved");
      setMessage("Final showtime confirmed.");
      await loadActive();
    } catch (confirmError) {
      setSaveState("error");
      setError(confirmError instanceof Error ? confirmError.message : "Unable to confirm showtime.");
    }
  }

  async function handleCreateInvites(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    const emails = normalizeEmails(inviteEmails);
    if (!emails.length) {
      setError("Enter at least one email address.");
      return;
    }

    setSaveState("saving");
    setError(null);
    setMessage(null);
    try {
      const result = await createClubInvites(token, clubId, emails);
      setInvites(result.invites);
      setInviteEmails("");
      setSaveState("saved");
      setMessage(`${emails.length} invite${emails.length === 1 ? "" : "s"} created.`);
      await loadInvites();
    } catch (inviteError) {
      setSaveState("error");
      setError(inviteError instanceof Error ? inviteError.message : "Unable to create invites.");
    }
  }

  const movieNight = active?.movieNight;
  const canCreate = Boolean(selectedMovie && targetDate && saveState !== "saving");
  const selectedPoster = selectedMovie ? posterUrl(selectedMovie) : "";
  const currentShowtimes = active?.showtimes || [];

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-cyan-300">
              <CalendarClock className="size-4" />
              <span>Admin command center</span>
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-white">Setup movie night</h1>
            <p className="mt-2 max-w-2xl text-slate-400">
              Browse movies, refresh candidate showtimes, monitor ranked-choice results, and confirm the final plan.
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
            <span className="text-slate-500">Status</span>
            <span className="ml-3 rounded bg-amber-400/10 px-2 py-1 font-medium text-amber-200">{movieNight?.status || "No active night"}</span>
          </div>
        </section>

        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {setupSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.label} className="rounded-lg border border-white/10 bg-slate-900/60 p-4 text-slate-300">
                <div className="flex items-center justify-between gap-3">
                  <Icon className="size-5" />
                  <span className="font-mono text-xs text-slate-500">0{index + 1}</span>
                </div>
                <p className="mt-4 font-semibold">{step.label}</p>
              </div>
            );
          })}
        </section>

        {error ? <Alert tone="rose">{error}</Alert> : null}
        {message ? <Alert tone="green">{message}</Alert> : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="space-y-6 lg:col-span-8">
            <Card className="border-white/10 bg-slate-900/80 py-6 shadow-2xl shadow-black/20">
              <CardHeader>
                <h2 className="text-xl font-semibold text-white">Now playing</h2>
              </CardHeader>
              <CardContent>
                {isNowPlayingLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 className="size-4 animate-spin" />
                    Loading now playing movies...
                  </div>
                ) : (
                  <MovieGrid movies={nowPlayingMovies} selectedMovie={selectedMovie} onSelect={setSelectedMovie} />
                )}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-900/80 py-6 shadow-2xl shadow-black/20">
              <CardHeader>
                <h2 className="text-xl font-semibold text-white">Movie search</h2>
                <p className="text-sm text-slate-400">Search runs through the backend `/movies/search` handler.</p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
                  <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search a movie title" className="border-white/10 bg-white/5 text-white" />
                  <Button type="submit" disabled={saveState === "saving"} className="bg-violet-500 text-white hover:bg-violet-600">
                    {saveState === "saving" ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                    Search
                  </Button>
                </form>
                <div className="mt-5">
                  <MovieGrid movies={movies} selectedMovie={selectedMovie} onSelect={setSelectedMovie} />
                </div>
              </CardContent>
            </Card>
          </section>

          <aside className="space-y-6 lg:col-span-4">
            <Card className="border-violet-400/20 bg-slate-900/90 py-6 shadow-2xl shadow-violet-950/20">
              <CardHeader>
                <h2 className="font-semibold text-white">Selected movie</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedMovie ? (
                  <div className="flex gap-3">
                    <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded bg-slate-950">
                      {selectedPoster ? <Image src={selectedPoster} alt={selectedMovie.title} fill sizes="80px" className="object-cover" /> : null}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{selectedMovie.title}</p>
                      <p className="mt-1 text-sm text-slate-400">{selectedMovie.releaseYear || "Release TBD"}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Search and choose a movie to start.</p>
                )}
                <Field label="Target date">
                  <Input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className="border-white/10 bg-white/5 text-white" />
                </Field>
                <Button onClick={handleCreateMovieNight} disabled={!canCreate} className="w-full bg-violet-500 text-white hover:bg-violet-600">
                  {saveState === "saving" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  Create movie night
                </Button>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-900/80 py-6">
              <CardHeader>
                <h2 className="font-semibold text-white">Gracenote refresh</h2>
                <p className="text-sm text-slate-400">Queues server-side cache ingestion.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Field label="ZIP">
                  <Input value={refreshForm.zip} onChange={(event) => setRefreshForm((current) => ({ ...current, zip: event.target.value }))} className="border-white/10 bg-white/5 text-white" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Radius">
                    <Input type="number" value={refreshForm.radius} onChange={(event) => setRefreshForm((current) => ({ ...current, radius: Number(event.target.value) }))} className="border-white/10 bg-white/5 text-white" />
                  </Field>
                  <Field label="Days">
                    <Input type="number" value={refreshForm.numDays} onChange={(event) => setRefreshForm((current) => ({ ...current, numDays: Number(event.target.value) }))} className="border-white/10 bg-white/5 text-white" />
                  </Field>
                </div>
                <Button onClick={handleRefreshGracenote} disabled={saveState === "saving"} className="w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400">
                  <RefreshCcw className="size-4" />
                  Queue refresh
                </Button>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-900/80 py-6">
              <CardHeader>
                <h2 className="font-semibold text-white">Club invites</h2>
                <p className="text-sm text-slate-400">Send one or more email invites.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleCreateInvites} className="space-y-3">
                  <Field label="Email addresses">
                    <textarea
                      value={inviteEmails}
                      onChange={(event) => setInviteEmails(event.target.value)}
                      placeholder="name@example.com, friend@example.com"
                      className="min-h-28 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    />
                  </Field>
                  <Button type="submit" disabled={saveState === "saving" || !inviteEmails.trim()} className="w-full bg-violet-500 text-white hover:bg-violet-600">
                    {saveState === "saving" ? <Loader2 className="size-4 animate-spin" /> : <MailPlus className="size-4" />}
                    Create invites
                  </Button>
                </form>
                <InviteList invites={invites} />
              </CardContent>
            </Card>
          </aside>
        </div>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <AdminShowtimes showtimes={currentShowtimes} />
          <AdminResults results={results} onConfirm={handleConfirm} isSaving={saveState === "saving"} />
        </section>
      </div>
    </AppShell>
  );
}

function MovieGrid({
  movies,
  selectedMovie,
  onSelect,
}: {
  movies: MovieSnapshot[];
  selectedMovie: MovieSnapshot | null;
  onSelect: (movie: MovieSnapshot) => void;
}) {
  if (!movies.length) {
    return <p className="text-sm text-slate-400">No movies to show yet.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {movies.map((movie) => {
        const image = posterUrl(movie);
        const activeMovie = selectedMovie?.provider === movie.provider && selectedMovie?.externalId === movie.externalId;
        return (
          <button
            key={`${movie.provider}-${movie.externalId}`}
            type="button"
            onClick={() => onSelect(movie)}
            className={`overflow-hidden rounded-lg border bg-white/5 text-left transition ${activeMovie ? "border-cyan-300/50" : "border-white/10 hover:border-white/25"}`}
          >
            <div className="relative h-64 bg-slate-950">
              {image ? <Image src={image} alt={movie.title} fill sizes="240px" className="object-cover" /> : <div className="grid h-full place-items-center text-slate-500">No poster</div>}
            </div>
            <div className="p-3">
              <p className="font-semibold text-white">{movie.title}</p>
              <p className="mt-1 text-sm text-slate-400">{movie.releaseYear || movie.releaseDate || "Year TBD"}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function AdminShowtimes({ showtimes }: { showtimes: Showtime[] }) {
  return (
    <Card className="border-white/10 bg-slate-900/80 py-6">
      <CardHeader>
        <h2 className="text-xl font-semibold text-white">Candidate showtimes</h2>
      </CardHeader>
      <CardContent className="space-y-3">
        {showtimes.length ? (
          showtimes.map((showtime) => {
            const dateTime = showtimeDateTime(showtime);
            return (
              <div key={showtime.showtimeId} className="rounded-lg border border-white/10 bg-white/5 p-4">
                <p className="font-semibold text-white">{showtime.theaterName}</p>
                <p className="mt-1 text-sm text-slate-300">{formatDate(dateTime)} at {formatTime(dateTime)}</p>
                <p className="mt-1 text-xs text-cyan-200">{showtime.screenFormat || "Standard"}</p>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-slate-400">No candidate showtimes are attached yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function AdminResults({
  results,
  onConfirm,
  isSaving,
}: {
  results: VoteResults | null;
  onConfirm: (showtimeId: string) => void;
  isSaving: boolean;
}) {
  return (
    <Card className="border-white/10 bg-slate-900/80 py-6">
      <CardHeader>
        <h2 className="text-xl font-semibold text-white">Voting results</h2>
        <p className="text-sm text-slate-400">{results ? `${results.voteCount} ballots submitted` : "Results appear after voting opens."}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {results?.standings?.length ? (
          results.standings.map((standing, index) => (
            <div key={standing.showtimeId} className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-cyan-200">#{index + 1} / {standing.points} pts</p>
                  <p className="mt-1 font-semibold text-white">{showtimeLabel(standing.showtime)}</p>
                  <p className="mt-1 text-xs text-slate-400">{standing.firstChoiceVotes} first-choice votes / {standing.rankedVotes} total rankings</p>
                </div>
                <Button size="sm" onClick={() => onConfirm(standing.showtimeId)} disabled={isSaving} className="bg-green-500 text-slate-950 hover:bg-green-400">
                  Confirm
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-400">No vote standings yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function InviteList({ invites }: { invites: ClubInvite[] }) {
  if (!invites.length) {
    return <p className="text-sm text-slate-400">No pending invites yet.</p>;
  }

  return (
    <div className="space-y-3">
      {invites.map((invite) => (
        <div key={invite.inviteId} className="rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-white">{invite.email}</p>
              <p className="mt-1 text-xs text-slate-400">
                {invite.status} / expires {formatDate(invite.expiresAt)}
              </p>
            </div>
            {invite.inviteUrl ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                title="Copy invite link"
                onClick={() => navigator.clipboard?.writeText(invite.inviteUrl || "")}
                className="text-slate-200 hover:bg-white/10"
              >
                <Copy className="size-4" />
              </Button>
            ) : null}
          </div>
          {invite.inviteUrl ? <p className="mt-2 truncate text-xs text-cyan-200">{invite.inviteUrl}</p> : null}
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Alert({ children, tone }: { children: React.ReactNode; tone: "rose" | "green" }) {
  const classes =
    tone === "rose"
      ? "mb-4 border-rose-400/30 bg-rose-500/10 text-rose-100"
      : "mb-4 border-green-400/30 bg-green-500/10 text-green-100";
  return <div className={`rounded-lg border p-3 text-sm ${classes}`}>{children}</div>;
}

function normalizeEmails(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\s,;]+/)
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.includes("@"))
    )
  );
}
