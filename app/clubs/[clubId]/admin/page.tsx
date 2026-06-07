"use client";

import {
  CalendarClock,
  Check,
  CheckCircle2,
  Clapperboard,
  ClipboardCheck,
  Clock,
  Copy,
  Film,
  Loader2,
  MailPlus,
  MapPin,
  RefreshCcw,
  Search,
  ShieldCheck,
  Ticket,
  Vote,
} from "lucide-react";
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
  addShowtimes,
  confirmShowtime,
  createClubInvites,
  createMovieNight,
  getActiveMovieNight,
  getNowPlayingMovies,
  getVoteResults,
  listClubInvites,
  MovieClubApiError,
  refreshGracenote,
  searchGracenoteShowtimes,
  searchMovies,
} from "@/lib/movie-club-api";
import { formatDate, formatTime, posterUrl, showtimeDateTime, showtimeLabel } from "@/lib/movie-club-format";
import type { ActiveMovieNightResponse, CachedShowtime, ClubInvite, MovieNightStatus, MovieSnapshot, Showtime, VoteResults } from "@/lib/movie-club-types";

type ActionState = "idle" | "saving" | "saved" | "error";
type LoadState = "idle" | "loading" | "error";
type MetricTone = "default" | "green" | "amber" | "cyan" | "rose";
type GracenoteSearchForm = { zip: string; radius: number; numDays: number; units: "mi" | "km" };
type ShowtimeTimeBucket = "all" | "morning" | "afternoon" | "evening" | "late";
type TheaterLikeShowtime = {
  providerTheaterId?: string;
  theaterName: string;
  theaterLocation?: string;
};
type TheaterShowtimeGroup<T extends TheaterLikeShowtime> = {
  key: string;
  theaterName: string;
  theaterLocation?: string;
  showtimes: T[];
};

const progressSteps = [
  { label: "Movie", icon: Clapperboard },
  { label: "Showtimes", icon: Ticket },
  { label: "Voting", icon: Vote },
  { label: "Confirm", icon: ShieldCheck },
];

const showtimeTimeBuckets: { value: ShowtimeTimeBucket; label: string }[] = [
  { value: "all", label: "All" },
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "late", label: "Late" },
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
  const [refreshForm, setRefreshForm] = useState<GracenoteSearchForm>({ zip: "60422", radius: 30, numDays: 14, units: "mi" });
  const [cachedShowtimes, setCachedShowtimes] = useState<CachedShowtime[]>([]);
  const [selectedCachedKeys, setSelectedCachedKeys] = useState<string[]>([]);
  const [selectedShowtimeDate, setSelectedShowtimeDate] = useState("all");
  const [showtimeTimeBucket, setShowtimeTimeBucket] = useState<ShowtimeTimeBucket>("all");
  const [gracenoteState, setGracenoteState] = useState<LoadState>("idle");
  const [createState, setCreateState] = useState<ActionState>("idle");
  const [movieSearchState, setMovieSearchState] = useState<ActionState>("idle");
  const [refreshState, setRefreshState] = useState<ActionState>("idle");
  const [importState, setImportState] = useState<ActionState>("idle");
  const [inviteState, setInviteState] = useState<ActionState>("idle");
  const [confirmState, setConfirmState] = useState<ActionState>("idle");
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
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
      if (
        nextActive.showtimes.length &&
        (nextActive.movieNight.status === "voting" || nextActive.movieNight.status === "confirmed")
      ) {
        const nextResults = await getVoteResults(token, nextActive.movieNight.movieNightId);
        setResults(nextResults);
      } else {
        setResults(null);
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
    setMovieSearchState("saving");
    setError(null);
    setMessage(null);
    try {
      const result = await searchMovies(token, searchQuery.trim());
      setMovies(result.results);
      setMovieSearchState("idle");
      setMessage(result.results.length ? `${result.results.length} movie matches found.` : "No movie matches found. Try a different title.");
    } catch (searchError) {
      setMovieSearchState("error");
      setError(searchError instanceof Error ? searchError.message : "Unable to search movies.");
    }
  }

  async function handleCreateMovieNight() {
    if (!token || !selectedMovie || !targetDate) {
      return;
    }
    setCreateState("saving");
    setError(null);
    setMessage(null);
    try {
      await createMovieNight(token, clubId, {
        targetDate,
        movieSelectionMode: "admin_selected",
        movie: selectedMovie,
      });
      setCreateState("saved");
      setMessage(`${selectedMovie.title} is ready for showtime import.`);
      await loadActive();
    } catch (createError) {
      setCreateState("error");
      setError(createError instanceof Error ? createError.message : "Unable to create movie night.");
    }
  }

  async function handleRefreshGracenote() {
    if (!token) {
      return;
    }
    setRefreshState("saving");
    setError(null);
    setMessage(null);
    try {
      await refreshGracenote(token, refreshForm);
      setRefreshState("saved");
      setMessage(`Gracenote refresh queued for ${refreshForm.zip}, ${refreshForm.radius}${refreshForm.units}, ${refreshForm.numDays} days.`);
    } catch (refreshError) {
      setRefreshState("error");
      setError(refreshError instanceof Error ? refreshError.message : "Unable to queue Gracenote refresh.");
    }
  }

  async function handleSearchGracenote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !movieNight?.movie) {
      setError("Create a movie night before searching cached showtimes.");
      return;
    }

    setGracenoteState("loading");
    setCachedShowtimes([]);
    setSelectedCachedKeys([]);
    setSelectedShowtimeDate("all");
    setShowtimeTimeBucket("all");
    setError(null);
    setMessage(null);
    try {
      const result = await searchGracenoteShowtimes(token, {
        title: movieNight.movie.title,
        provider: movieNight.movie.provider,
        providerMovieId: movieNight.movie.externalId,
        zip: refreshForm.zip,
        radius: refreshForm.radius,
        numDays: refreshForm.numDays,
        units: refreshForm.units,
      });
      setCachedShowtimes(result.showtimes);
      setGracenoteState("idle");
      setMessage(
        result.showtimes.length
          ? `${result.showtimes.length} cached showtime${result.showtimes.length === 1 ? "" : "s"} found for ${movieNight.movie.title}.`
          : `No cached showtimes found for ${movieNight.movie.title} in this window. Queue a refresh, then search again.`
      );
    } catch (searchError) {
      setGracenoteState("error");
      setError(searchError instanceof Error ? searchError.message : "Unable to search cached Gracenote showtimes.");
    }
  }

  async function handleImportShowtimes() {
    if (!token || !movieNight || !selectedCachedKeys.length) {
      return;
    }

    const cachedShowtimeKeys = cachedShowtimes
      .filter((showtime) => selectedCachedKeys.includes(cacheKey(showtime)))
      .map((showtime) => ({ PK: showtime.PK, SK: showtime.SK }));

    setImportState("saving");
    setError(null);
    setMessage(null);
    try {
      await addShowtimes(token, movieNight.movieNightId, { cachedShowtimeKeys });
      setImportState("saved");
      setSelectedCachedKeys([]);
      setMessage(`${cachedShowtimeKeys.length} showtime${cachedShowtimeKeys.length === 1 ? "" : "s"} imported for member voting.`);
      await loadActive();
    } catch (importError) {
      setImportState("error");
      setError(importError instanceof Error ? importError.message : "Unable to import selected showtimes.");
    }
  }

  function toggleCachedShowtime(showtime: CachedShowtime) {
    const key = cacheKey(showtime);
    setSelectedCachedKeys((current) =>
      current.includes(key) ? current.filter((selectedKey) => selectedKey !== key) : [...current, key]
    );
  }

  function selectAllCachedShowtimes() {
    const visibleKeys = visibleCachedShowtimes.map(cacheKey);
    setSelectedCachedKeys((current) => Array.from(new Set([...current, ...visibleKeys])));
  }

  function clearCachedShowtimes() {
    setSelectedCachedKeys([]);
  }

  async function handleConfirm(showtimeId: string) {
    if (!token || !active?.movieNight) {
      return;
    }
    setConfirmState("saving");
    setError(null);
    setMessage(null);
    try {
      await confirmShowtime(token, active.movieNight.movieNightId, showtimeId);
      setConfirmState("saved");
      setMessage("Final showtime confirmed. Members can RSVP and track tickets now.");
      await loadActive();
    } catch (confirmError) {
      setConfirmState("error");
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

    setInviteState("saving");
    setError(null);
    setMessage(null);
    try {
      const result = await createClubInvites(token, clubId, emails);
      setInvites(result.invites);
      setInviteEmails("");
      setInviteState("saved");
      setMessage(`${emails.length} invite${emails.length === 1 ? "" : "s"} created for this club.`);
      await loadInvites();
    } catch (inviteError) {
      setInviteState("error");
      setError(inviteError instanceof Error ? inviteError.message : "Unable to create invites.");
    }
  }

  async function handleCopyInvite(invite: ClubInvite) {
    if (!invite.inviteUrl) {
      return;
    }
    await navigator.clipboard?.writeText(invite.inviteUrl);
    setCopiedInviteId(invite.inviteId);
    setMessage(`Invite link copied for ${invite.email}.`);
    window.setTimeout(() => setCopiedInviteId(null), 1800);
  }

  const movieNight = active?.movieNight;
  const currentShowtimes = active?.showtimes || [];
  const visibleCachedShowtimes = useMemo(
    () => filterCachedShowtimes(cachedShowtimes, selectedShowtimeDate, showtimeTimeBucket),
    [cachedShowtimes, selectedShowtimeDate, showtimeTimeBucket]
  );
  const selectedPoster = selectedMovie ? posterUrl(selectedMovie) : "";
  const groupedCurrentShowtimes = groupShowtimesByTheater(currentShowtimes, showtimeDateTime);
  const canCreate = Boolean(selectedMovie && targetDate && createState !== "saving");
  const statusLabel = formatStatus(movieNight?.status);
  const nextAction = getNextAction({
    hasMovieNight: Boolean(movieNight),
    hasSelectedMovie: Boolean(selectedMovie),
    showtimeCount: currentShowtimes.length,
    status: movieNight?.status,
    resultCount: results?.standings?.length || 0,
  });
  const completedProgress = getCompletedProgress({
    hasMovieNight: Boolean(movieNight),
    hasSelectedMovie: Boolean(selectedMovie),
    showtimeCount: currentShowtimes.length,
    status: movieNight?.status,
    resultCount: results?.standings?.length || 0,
  });

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="mb-6 border-b border-white/10 pb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm text-cyan-300">
                <CalendarClock className="size-4" />
                <span>Club admin workspace</span>
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-white">Manage movie night</h1>
              <p className="mt-2 max-w-2xl text-slate-300">{nextAction}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[32rem]">
              <Metric label="Status" value={statusLabel} tone={statusTone(movieNight?.status)} />
              <Metric label="Selected movie" value={movieNight?.movie.title || selectedMovie?.title || "Choose a movie"} />
              <Metric label="Target date" value={formatDate(movieNight?.targetDate || targetDate)} />
              <Metric label="Showtimes" value={`${currentShowtimes.length} imported`} />
              <Metric label="Theaters" value={`${groupedCurrentShowtimes.length} listed`} />
              <Metric label="Ballots" value={results ? `${results.voteCount} submitted` : "Not open yet"} />
            </div>
          </div>
        </section>

        <ProgressStrip completedCount={completedProgress} />

        {error ? <Alert tone="rose">{error}</Alert> : null}
        {message ? <Alert tone="green">{message}</Alert> : null}

        <Card className="mb-6 border-white/10 bg-slate-900/80 py-5 shadow-2xl shadow-black/20">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Movie picker</h2>
              <p className="text-sm text-slate-400">Choose the title members will vote showtimes for.</p>
            </div>
            <span className="text-sm text-slate-500">{nowPlayingMovies.length} now playing</span>
          </CardHeader>
          <CardContent>
            {isNowPlayingLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="size-4 animate-spin" />
                Loading current theatrical releases...
              </div>
            ) : (
              <MovieGrid movies={nowPlayingMovies} selectedMovie={selectedMovie} onSelect={setSelectedMovie} emptyText="No now-playing movies loaded yet. Use search or try again shortly." compact />
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="space-y-6 lg:col-span-8">
            <GracenoteImportPanel
              cachedShowtimes={cachedShowtimes}
              form={refreshForm}
              gracenoteState={gracenoteState}
              importState={importState}
              importedCount={currentShowtimes.length}
              movieNightExists={Boolean(movieNight)}
              onClearSelection={clearCachedShowtimes}
              onImport={handleImportShowtimes}
              onRefresh={handleRefreshGracenote}
              onSearch={handleSearchGracenote}
              onSelectAll={selectAllCachedShowtimes}
              onSelectedDateChange={setSelectedShowtimeDate}
              onTimeBucketChange={setShowtimeTimeBucket}
              onToggle={toggleCachedShowtime}
              refreshState={refreshState}
              selectedDate={selectedShowtimeDate}
              selectedKeys={selectedCachedKeys}
              setForm={setRefreshForm}
              timeBucket={showtimeTimeBucket}
              visibleShowtimes={visibleCachedShowtimes}
            />

            <AdminShowtimes showtimes={currentShowtimes} />
          </section>

          <aside className="space-y-6 lg:col-span-4">
            <Card className="border-violet-400/20 bg-slate-900/90 py-6 shadow-2xl shadow-violet-950/20">
              <CardHeader>
                <h2 className="font-semibold text-white">Movie night setup</h2>
                <p className="text-sm text-slate-400">{movieNight ? "This active movie night is connected to the showtime workflow." : "Pick a movie and date to unlock showtime import."}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedMovie ? (
                  <div className="flex gap-3">
                    <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded bg-slate-950">
                      {selectedPoster ? (
                        <Image src={selectedPoster} alt={selectedMovie.title} fill sizes="80px" className="object-cover" />
                      ) : (
                        <div className="grid h-full place-items-center text-slate-500">
                          <Film className="size-8" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-white">{selectedMovie.title}</p>
                      <p className="mt-1 text-sm text-slate-400">{selectedMovie.releaseYear || selectedMovie.releaseDate || "Release date TBD"}</p>
                      {selectedMovie.overview ? <p className="mt-2 line-clamp-3 text-sm text-slate-300">{selectedMovie.overview}</p> : null}
                    </div>
                  </div>
                ) : (
                  <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-400">
                    Select a now-playing title above, or search the movie catalog below.
                  </p>
                )}
                <Field label="Target date">
                  <Input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className="border-white/10 bg-white/5 text-white" />
                </Field>
                <Button onClick={handleCreateMovieNight} disabled={!canCreate} className="w-full bg-violet-500 text-white hover:bg-violet-600">
                  {createState === "saving" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  {movieNight ? "Replace active setup" : "Create movie night"}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-900/80 py-6 shadow-2xl shadow-black/20">
              <CardHeader>
                <h2 className="font-semibold text-white">Movie search</h2>
                <p className="text-sm text-slate-400">Use catalog search when a title is missing from now playing.</p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSearch} className="flex flex-col gap-3">
                  <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search by movie title" className="border-white/10 bg-white/5 text-white" />
                  <Button type="submit" disabled={movieSearchState === "saving" || searchQuery.trim().length < 2} className="bg-violet-500 text-white hover:bg-violet-600">
                    {movieSearchState === "saving" ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                    Search movies
                  </Button>
                </form>
                <div className="mt-5">
                  <MovieGrid movies={movies} selectedMovie={selectedMovie} onSelect={setSelectedMovie} emptyText="Search results will appear here." compact />
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-900/80 py-6">
              <CardHeader>
                <h2 className="font-semibold text-white">Club invites</h2>
                <p className="text-sm text-slate-400">Create invite links for friends joining this club.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleCreateInvites} className="space-y-3">
                  <Field label="Email addresses">
                    <textarea
                      value={inviteEmails}
                      onChange={(event) => setInviteEmails(event.target.value)}
                      placeholder="name@example.com, friend@example.com"
                      className="min-h-24 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    />
                  </Field>
                  <Button type="submit" disabled={inviteState === "saving" || !inviteEmails.trim()} className="w-full bg-violet-500 text-white hover:bg-violet-600">
                    {inviteState === "saving" ? <Loader2 className="size-4 animate-spin" /> : <MailPlus className="size-4" />}
                    Create invites
                  </Button>
                </form>
                <InviteList invites={invites} copiedInviteId={copiedInviteId} onCopy={handleCopyInvite} />
              </CardContent>
            </Card>

            <AdminResults results={results} onConfirm={handleConfirm} isSaving={confirmState === "saving"} />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function ProgressStrip({ completedCount }: { completedCount: number }) {
  return (
    <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {progressSteps.map((step, index) => {
        const Icon = step.icon;
        const isDone = index < completedCount;
        const isCurrent = index === completedCount;
        return (
          <div
            key={step.label}
            className={`rounded-lg border p-4 transition ${
              isDone
                ? "border-green-400/30 bg-green-500/10 text-green-100"
                : isCurrent
                  ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-100"
                  : "border-white/10 bg-slate-900/60 text-slate-400"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <Icon className="size-5" />
              <span className="font-mono text-xs opacity-70">0{index + 1}</span>
            </div>
            <p className="mt-4 font-semibold">{step.label}</p>
            <p className="mt-1 text-xs opacity-75">{isDone ? "Complete" : isCurrent ? "Next up" : "Waiting"}</p>
          </div>
        );
      })}
    </section>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: MetricTone }) {
  const toneClasses: Record<MetricTone, string> = {
    default: "text-white",
    green: "text-green-200",
    amber: "text-amber-200",
    cyan: "text-cyan-200",
    rose: "text-rose-200",
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 truncate text-sm font-semibold ${toneClasses[tone]}`}>{value}</p>
    </div>
  );
}

function MovieGrid({
  movies,
  selectedMovie,
  onSelect,
  emptyText,
  compact = false,
}: {
  movies: MovieSnapshot[];
  selectedMovie: MovieSnapshot | null;
  onSelect: (movie: MovieSnapshot) => void;
  emptyText: string;
  compact?: boolean;
}) {
  if (!movies.length) {
    return <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-400">{emptyText}</p>;
  }

  return (
    <div className={compact ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-4" : "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"}>
      {movies.map((movie) => {
        const image = posterUrl(movie);
        const activeMovie = selectedMovie?.provider === movie.provider && selectedMovie?.externalId === movie.externalId;
        return (
          <button
            key={`${movie.provider}-${movie.externalId}`}
            type="button"
            onClick={() => onSelect(movie)}
            className={`overflow-hidden rounded-lg border bg-white/5 text-left transition ${activeMovie ? "border-cyan-300/60 bg-cyan-400/10" : "border-white/10 hover:border-white/25 hover:bg-white/10"}`}
          >
            <div className={`relative bg-slate-950 ${compact ? "h-32" : "h-64"}`}>
              {image ? (
                <Image src={image} alt={movie.title} fill sizes={compact ? "180px" : "240px"} className="object-cover" />
              ) : (
                <div className="grid h-full place-items-center text-slate-500">
                  <Film className="size-10" />
                </div>
              )}
            </div>
            <div className="p-3">
              <p className={`font-semibold text-white ${compact ? "line-clamp-2 text-sm" : ""}`}>{movie.title}</p>
              <p className="mt-1 text-sm text-slate-400">{movie.releaseYear || movie.releaseDate || "Release date TBD"}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function GracenoteImportPanel({
  cachedShowtimes,
  form,
  gracenoteState,
  importState,
  importedCount,
  movieNightExists,
  onClearSelection,
  onImport,
  onRefresh,
  onSearch,
  onSelectAll,
  onSelectedDateChange,
  onTimeBucketChange,
  onToggle,
  refreshState,
  selectedDate,
  selectedKeys,
  setForm,
  timeBucket,
  visibleShowtimes,
}: {
  cachedShowtimes: CachedShowtime[];
  form: { zip: string; radius: number; numDays: number; units: "mi" | "km" };
  gracenoteState: LoadState;
  importState: ActionState;
  importedCount: number;
  movieNightExists: boolean;
  onClearSelection: () => void;
  onImport: () => void;
  onRefresh: () => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onSelectAll: () => void;
  onSelectedDateChange: (date: string) => void;
  onTimeBucketChange: (bucket: ShowtimeTimeBucket) => void;
  onToggle: (showtime: CachedShowtime) => void;
  refreshState: ActionState;
  selectedDate: string;
  selectedKeys: string[];
  setForm: (form: { zip: string; radius: number; numDays: number; units: "mi" | "km" }) => void;
  timeBucket: ShowtimeTimeBucket;
  visibleShowtimes: CachedShowtime[];
}) {
  const selectedCount = selectedKeys.length;
  const availableDates = getAvailableShowtimeDates(cachedShowtimes);
  const groupedShowtimes = groupShowtimesByTheater(visibleShowtimes, cachedShowtimeDateTime);
  const visibleKeys = visibleShowtimes.map(cacheKey);
  const visibleSelectedCount = visibleKeys.filter((key) => selectedKeys.includes(key)).length;
  const hiddenSelectedCount = selectedCount - visibleSelectedCount;
  const hasActiveFilters = selectedDate !== "all" || timeBucket !== "all";
  const allVisibleSelected = Boolean(visibleShowtimes.length) && visibleSelectedCount === visibleShowtimes.length;

  return (
    <Card className="border-cyan-300/20 bg-slate-900/85 py-6 shadow-2xl shadow-cyan-950/10">
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Showtime import</h2>
            <p className="text-sm text-slate-400">Refresh provider data, search the local cache, then choose the showtimes members can rank.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs sm:min-w-72">
            <MiniStat value={`${cachedShowtimes.length}`} label="cached" />
            <MiniStat value={`${selectedCount}`} label="selected" tone="cyan" />
            <MiniStat value={`${importedCount}`} label="imported" tone="green" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={onSearch} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="ZIP">
              <Input value={form.zip} onChange={(event) => setForm({ ...form, zip: event.target.value })} className="border-white/10 bg-white/5 text-white" />
            </Field>
            <Field label={`Radius (${form.units})`}>
              <Input type="number" min={1} value={form.radius} onChange={(event) => setForm({ ...form, radius: Number(event.target.value) })} className="border-white/10 bg-white/5 text-white" />
            </Field>
            <Field label="Days">
              <Input type="number" min={1} value={form.numDays} onChange={(event) => setForm({ ...form, numDays: Number(event.target.value) })} className="border-white/10 bg-white/5 text-white" />
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <ActionPanel
              title="1. Queue fresh showtimes"
              description="Ask Gracenote to refresh the cache for this area. This can run before you search."
              icon={<RefreshCcw className="size-4" />}
              disabled={!movieNightExists || refreshState === "saving"}
              isLoading={refreshState === "saving"}
              onClick={onRefresh}
              buttonText="Queue refresh"
              tone="cyan"
            />
            <ActionPanel
              title="2. Search cached matches"
              description="Find cached showtimes for the selected movie and current search window."
              icon={<Search className="size-4" />}
              disabled={!movieNightExists || gracenoteState === "loading"}
              isLoading={gracenoteState === "loading"}
              type="submit"
              buttonText="Search cache"
              tone="violet"
            />
          </div>
        </form>

        {!movieNightExists ? (
          <p className="rounded-lg border border-amber-300/20 bg-amber-400/10 p-3 text-sm text-amber-100">
            Create a movie night before importing showtimes. The import will use that movie title and provider ID.
          </p>
        ) : cachedShowtimes.length ? (
          <div className="space-y-3">
            <div className="space-y-3 rounded-lg border border-white/10 bg-slate-950/30 p-3">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase text-slate-500">Date</p>
                <div className="flex flex-wrap gap-2">
                  <FilterChip isActive={selectedDate === "all"} onClick={() => onSelectedDateChange("all")}>
                    All dates
                  </FilterChip>
                  {availableDates.map((date) => (
                    <FilterChip key={date} isActive={selectedDate === date} onClick={() => onSelectedDateChange(date)}>
                      {formatShowtimeDateChip(date)}
                    </FilterChip>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase text-slate-500">Time</p>
                <div className="flex flex-wrap gap-2">
                  {showtimeTimeBuckets.map((bucket) => (
                    <FilterChip key={bucket.value} isActive={timeBucket === bucket.value} onClick={() => onTimeBucketChange(bucket.value)}>
                      {bucket.label}
                    </FilterChip>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/5 p-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-slate-300">
                {hasActiveFilters
                  ? `${visibleShowtimes.length} of ${cachedShowtimes.length} cached showtime${cachedShowtimes.length === 1 ? "" : "s"} visible`
                  : `${cachedShowtimes.length} cached showtime${cachedShowtimes.length === 1 ? "" : "s"}`}{" "}
                across {groupedShowtimes.length} theater{groupedShowtimes.length === 1 ? "" : "s"}
                {hiddenSelectedCount > 0 ? ` / ${hiddenSelectedCount} selected hidden by filters` : ""}
              </span>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={onSelectAll} disabled={allVisibleSelected || !visibleShowtimes.length} className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10">
                  Select all visible
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={onClearSelection} disabled={!selectedCount} className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10">
                  Clear selected
                </Button>
              </div>
            </div>

            {visibleShowtimes.length ? (
              <div className="max-h-[34rem] space-y-4 overflow-y-auto pr-1">
                {groupedShowtimes.map((group) => (
                  <TheaterShowtimeSection key={group.key} group={group}>
                    <div className="grid gap-2 md:grid-cols-2">
                      {group.showtimes.map((showtime) => {
                        const key = cacheKey(showtime);
                        const dateTime = cachedShowtimeDateTime(showtime);
                        const isSelected = selectedKeys.includes(key);
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => onToggle(showtime)}
                            className={`w-full rounded-lg border p-3 text-left transition ${isSelected ? "border-cyan-300/60 bg-cyan-400/10" : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10"}`}
                          >
                            <ShowtimeCardBody checked={isSelected} dateTime={dateTime} screenFormat={showtime.screenFormat} ticketURI={showtime.ticketURI} />
                          </button>
                        );
                      })}
                    </div>
                  </TheaterShowtimeSection>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-400">
                No cached showtimes match these date and time filters. Adjust the filters above to show more options.
              </p>
            )}
            <Button onClick={onImport} disabled={!selectedCount || importState === "saving"} className="w-full bg-green-500 text-slate-950 hover:bg-green-400">
              {importState === "saving" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Import {selectedCount || ""} selected showtime{selectedCount === 1 ? "" : "s"}
            </Button>
          </div>
        ) : (
          <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-400">
            No cached showtimes are loaded. Queue a refresh if needed, then search the cache for this movie.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ActionPanel({
  title,
  description,
  buttonText,
  disabled,
  icon,
  isLoading,
  onClick,
  tone,
  type = "button",
}: {
  title: string;
  description: string;
  buttonText: string;
  disabled: boolean;
  icon: React.ReactNode;
  isLoading: boolean;
  onClick?: () => void;
  tone: "cyan" | "violet";
  type?: "button" | "submit";
}) {
  const buttonClass = tone === "cyan" ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : "bg-violet-500 text-white hover:bg-violet-600";

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-1 min-h-10 text-sm text-slate-400">{description}</p>
      <Button type={type} onClick={onClick} disabled={disabled} className={`mt-4 w-full ${buttonClass}`}>
        {isLoading ? <Loader2 className="size-4 animate-spin" /> : icon}
        {buttonText}
      </Button>
    </div>
  );
}

function MiniStat({ value, label, tone = "default" }: { value: string; label: string; tone?: "default" | "cyan" | "green" }) {
  const toneClass = tone === "cyan" ? "text-cyan-200" : tone === "green" ? "text-green-200" : "text-white";
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-2">
      <p className={`font-semibold ${toneClass}`}>{value}</p>
      <p className="mt-0.5 text-slate-500">{label}</p>
    </div>
  );
}

function FilterChip({
  children,
  isActive,
  onClick,
}: {
  children: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-9 rounded border px-3 py-1.5 text-sm transition ${
        isActive
          ? "border-cyan-300/60 bg-cyan-400/15 text-cyan-50"
          : "border-white/10 bg-white/5 text-slate-300 hover:border-white/25 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function AdminShowtimes({ showtimes }: { showtimes: Showtime[] }) {
  const groupedShowtimes = groupShowtimesByTheater(showtimes, showtimeDateTime);

  return (
    <Card className="border-white/10 bg-slate-900/80 py-6">
      <CardHeader>
        <h2 className="text-xl font-semibold text-white">Imported candidate showtimes</h2>
        <p className="text-sm text-slate-400">
          {showtimes.length
            ? `${showtimes.length} member-votable slot${showtimes.length === 1 ? "" : "s"} across ${groupedShowtimes.length} theater${groupedShowtimes.length === 1 ? "" : "s"}.`
            : "Imported showtimes will appear here as the ballot options members rank."}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {showtimes.length ? (
          groupedShowtimes.map((group) => (
            <TheaterShowtimeSection key={group.key} group={group}>
              <div className="grid gap-3 md:grid-cols-2">
                {group.showtimes.map((showtime) => (
                  <div key={showtime.showtimeId} className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <ShowtimeCardBody dateTime={showtimeDateTime(showtime)} screenFormat={showtime.screenFormat} ticketURI={showtime.ticketURI} />
                  </div>
                ))}
              </div>
            </TheaterShowtimeSection>
          ))
        ) : (
          <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-400">
            Search cached showtimes above, select the best options, then import them for the member ballot.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ShowtimeCardBody({
  checked,
  dateTime,
  screenFormat,
  ticketURI,
}: {
  checked?: boolean;
  dateTime: string;
  screenFormat?: string;
  ticketURI?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      {typeof checked === "boolean" ? <input type="checkbox" checked={checked} readOnly className="mt-1 size-4 accent-cyan-300" /> : null}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-white">{formatDate(dateTime)}</p>
          <span className="rounded bg-cyan-400/10 px-2 py-1 text-xs font-medium text-cyan-100">{screenFormat || "Standard"}</span>
        </div>
        <p className="mt-2 flex items-center gap-2 text-sm text-slate-300">
          <Clock className="size-4 text-amber-300" />
          {formatTime(dateTime)}
        </p>
        {ticketURI ? <p className="mt-2 truncate text-xs text-slate-500">Tickets linked</p> : null}
      </div>
    </div>
  );
}

function TheaterShowtimeSection<T extends TheaterLikeShowtime>({
  group,
  children,
}: {
  group: TheaterShowtimeGroup<T>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-slate-950/30 p-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-semibold text-white">{group.theaterName}</h3>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-400">
            <MapPin className="size-4 shrink-0" />
            <span className="truncate">{group.theaterLocation || "Chicago area theater"}</span>
          </p>
        </div>
        <span className="w-fit rounded bg-white/5 px-2 py-1 text-xs text-slate-300">
          {group.showtimes.length} slot{group.showtimes.length === 1 ? "" : "s"}
        </span>
      </div>
      {children}
    </section>
  );
}

function groupShowtimesByTheater<T extends TheaterLikeShowtime>(
  showtimes: T[],
  getDateTime: (showtime: T) => string
): TheaterShowtimeGroup<T>[] {
  const groups = new Map<string, TheaterShowtimeGroup<T>>();

  for (const showtime of showtimes) {
    const key = showtime.providerTheaterId || normalizeTheaterName(showtime.theaterName);
    const existing = groups.get(key);

    if (existing) {
      existing.showtimes.push(showtime);
    } else {
      groups.set(key, {
        key,
        theaterName: showtime.theaterName,
        theaterLocation: showtime.theaterLocation,
        showtimes: [showtime],
      });
    }
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      showtimes: [...group.showtimes].sort((first, second) => compareDateTime(getDateTime(first), getDateTime(second))),
    }))
    .sort((first, second) => first.theaterName.localeCompare(second.theaterName));
}

function normalizeTheaterName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ") || "unknown-theater";
}

function compareDateTime(first?: string, second?: string) {
  return (Date.parse(first || "") || 0) - (Date.parse(second || "") || 0);
}

function filterCachedShowtimes(showtimes: CachedShowtime[], selectedDate: string, timeBucket: ShowtimeTimeBucket) {
  return showtimes.filter((showtime) => {
    const dateTime = cachedShowtimeDateTime(showtime);
    if (selectedDate !== "all" && getShowtimeDateKey(dateTime) !== selectedDate) {
      return false;
    }
    return timeBucket === "all" || getShowtimeTimeBucket(dateTime) === timeBucket;
  });
}

function getAvailableShowtimeDates(showtimes: CachedShowtime[]) {
  return Array.from(
    showtimes.reduce<Set<string>>((dates, showtime) => {
      const dateKey = getShowtimeDateKey(cachedShowtimeDateTime(showtime));
      if (dateKey) {
        dates.add(dateKey);
      }
      return dates;
    }, new Set())
  ).sort();
}

function getShowtimeDateKey(value?: string) {
  const date = parseShowtimeDate(value);
  if (!date) {
    return "";
  }

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function getShowtimeTimeBucket(value?: string): ShowtimeTimeBucket | null {
  const date = parseShowtimeDate(value);
  if (!date) {
    return null;
  }

  const hour = date.getHours();
  if (hour < 12) {
    return "morning";
  }
  if (hour < 17) {
    return "afternoon";
  }
  if (hour < 22) {
    return "evening";
  }
  return "late";
}

function parseShowtimeDate(value?: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatShowtimeDateChip(date: string) {
  return formatDate(`${date}T00:00:00`);
}

function cacheKey(showtime: CachedShowtime) {
  return `${showtime.PK}::${showtime.SK}`;
}

function cachedShowtimeDateTime(showtime: CachedShowtime) {
  return showtime.localDateTime || showtime.startsAtUtc;
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
  const winner = results?.standings?.[0];

  return (
    <Card className="border-white/10 bg-slate-900/80 py-6">
      <CardHeader>
        <h2 className="text-xl font-semibold text-white">Voting results</h2>
        <p className="text-sm text-slate-400">{results ? `${results.voteCount} ballots submitted` : "Results appear after voting opens and members rank showtimes."}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {winner ? (
          <div className="rounded-lg border border-green-400/30 bg-green-500/10 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-green-100">
              <ClipboardCheck className="size-4" />
              Current leader
            </p>
            <p className="mt-2 font-semibold text-white">{showtimeLabel(winner.showtime)}</p>
            <p className="mt-1 text-xs text-green-100/80">
              {winner.points} pts / {winner.firstChoiceVotes} first-choice / {winner.rankedVotes} total rankings
            </p>
            <Button size="sm" onClick={() => onConfirm(winner.showtimeId)} disabled={isSaving} className="mt-4 bg-green-500 text-slate-950 hover:bg-green-400">
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Confirm leader
            </Button>
          </div>
        ) : null}

        {results?.standings?.length ? (
          results.standings.map((standing, index) => (
            <div key={standing.showtimeId} className={`rounded-lg border p-4 ${index === 0 ? "border-green-400/20 bg-green-500/5" : "border-white/10 bg-white/5"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-cyan-200">#{index + 1} / {standing.points} pts</p>
                  <p className="mt-1 font-semibold text-white">{showtimeLabel(standing.showtime)}</p>
                  <p className="mt-1 text-xs text-slate-400">{standing.firstChoiceVotes} first-choice votes / {standing.rankedVotes} total rankings</p>
                </div>
                <Button size="sm" variant={index === 0 ? "outline" : "ghost"} onClick={() => onConfirm(standing.showtimeId)} disabled={isSaving} className="shrink-0 border-white/10 text-slate-100 hover:bg-white/10">
                  Confirm
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-400">
            Once voting opens, standings will show ranked-choice points and a confirm action for the final showtime.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function InviteList({
  invites,
  copiedInviteId,
  onCopy,
}: {
  invites: ClubInvite[];
  copiedInviteId: string | null;
  onCopy: (invite: ClubInvite) => void;
}) {
  if (!invites.length) {
    return (
      <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-400">
        No invites yet. Add one or more email addresses to create shareable invite links.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {invites.map((invite) => (
        <div key={invite.inviteId} className="rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="truncate font-medium text-white">{invite.email}</p>
                <InviteBadge status={invite.status} />
              </div>
              <p className="mt-1 text-xs text-slate-400">Expires {formatDate(invite.expiresAt)}</p>
            </div>
            {invite.inviteUrl ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                title="Copy invite link"
                onClick={() => onCopy(invite)}
                className="shrink-0 text-slate-200 hover:bg-white/10"
              >
                {copiedInviteId === invite.inviteId ? <Check className="size-4 text-green-300" /> : <Copy className="size-4" />}
              </Button>
            ) : null}
          </div>
          {invite.inviteUrl ? <p className="mt-2 truncate text-xs text-cyan-200">{invite.inviteUrl}</p> : null}
        </div>
      ))}
    </div>
  );
}

function InviteBadge({ status }: { status: ClubInvite["status"] }) {
  const classes: Record<ClubInvite["status"], string> = {
    pending: "border-amber-300/20 bg-amber-400/10 text-amber-100",
    accepted: "border-green-300/20 bg-green-400/10 text-green-100",
    expired: "border-rose-300/20 bg-rose-400/10 text-rose-100",
  };

  return <span className={`rounded border px-2 py-0.5 text-xs capitalize ${classes[status]}`}>{status}</span>;
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

function formatStatus(status?: MovieNightStatus) {
  if (!status) {
    return "No active night";
  }
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status?: MovieNightStatus): MetricTone {
  if (status === "confirmed" || status === "completed") {
    return "green";
  }
  if (status === "voting") {
    return "cyan";
  }
  if (status === "cancelled") {
    return "rose";
  }
  if (status === "planning") {
    return "amber";
  }
  return "default";
}

function getCompletedProgress({
  hasMovieNight,
  hasSelectedMovie,
  showtimeCount,
  status,
  resultCount,
}: {
  hasMovieNight: boolean;
  hasSelectedMovie: boolean;
  showtimeCount: number;
  status?: MovieNightStatus;
  resultCount: number;
}) {
  if (status === "confirmed" || status === "completed") {
    return 4;
  }
  if (resultCount || status === "voting") {
    return 3;
  }
  if (showtimeCount) {
    return 2;
  }
  if (hasMovieNight || hasSelectedMovie) {
    return 1;
  }
  return 0;
}

function getNextAction({
  hasMovieNight,
  hasSelectedMovie,
  showtimeCount,
  status,
  resultCount,
}: {
  hasMovieNight: boolean;
  hasSelectedMovie: boolean;
  showtimeCount: number;
  status?: MovieNightStatus;
  resultCount: number;
}) {
  if (status === "confirmed" || status === "completed") {
    return "The final showtime is set. Keep invites current and use the active night page for RSVP follow-up.";
  }
  if (resultCount) {
    return "Voting results are ready. Review the current leader and confirm the final showtime.";
  }
  if (status === "voting") {
    return "Voting is open. Monitor results as ballots come in, then confirm the winner.";
  }
  if (showtimeCount) {
    return "Candidate showtimes are imported. Members can rank the available options once voting is open.";
  }
  if (hasMovieNight) {
    return "Movie night created. Refresh or search cached showtimes, then import the best options for voting.";
  }
  if (hasSelectedMovie) {
    return "Movie selected. Set the target date and create the movie night to unlock showtime import.";
  }
  return "Start by choosing the movie for the next club screening.";
}
