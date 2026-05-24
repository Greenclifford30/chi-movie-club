'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  CalendarClock,
  Check,
  ChevronDown,
  Clapperboard,
  Film,
  Loader2,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Ticket,
  Upload,
  Vote,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";

type Movie = {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const setupSteps = [
  { label: 'Movie', icon: Film, state: 'active' },
  { label: 'Showtimes', icon: Ticket, state: 'ready' },
  { label: 'Voting', icon: Vote, state: 'ready' },
  { label: 'Confirmation', icon: ShieldCheck, state: 'ready' },
];

export default function AdminPage() {
  const today = useMemo(() => new Date(), []);
  const minDate = useMemo(() => format(new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"), [today]);
  const maxDate = useMemo(() => format(new Date(today.getTime() + 28 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"), [today]);
  const year = today.getFullYear().toString();

  const [movies, setMovies] = useState<Movie[]>([]);
  const [page, setPage] = useState(1);
  const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null);
  const [proposedStartDate, setProposedStartDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchMode, setIsSearchMode] = useState<boolean>(false);
  const [isLoadingMovies, setIsLoadingMovies] = useState<boolean>(true);
  const [movieError, setMovieError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveMessage, setSaveMessage] = useState<string>('');

  const selectedMovie = movies.find((movie) => movie.id === selectedMovieId) ?? null;

  useEffect(() => {
    let ignore = false;

    async function fetchMovies() {
      setIsLoadingMovies(true);
      setMovieError(null);

      let url: URL;

      if (isSearchMode && searchQuery.trim()) {
        url = new URL("https://api.themoviedb.org/3/search/movie");
        url.searchParams.set("query", searchQuery.trim());
        url.searchParams.set("primary_release_year", year);
      } else {
        url = new URL("https://api.themoviedb.org/3/discover/movie");
        url.searchParams.set("sort_by", "popularity.desc");
        url.searchParams.set("with_release_type", "2|3");
        url.searchParams.set("release_date.gte", minDate);
        url.searchParams.set("release_date.lte", maxDate);
      }

      url.searchParams.set("include_adult", "false");
      url.searchParams.set("include_video", "false");
      url.searchParams.set("language", "en-US");
      url.searchParams.set("region", "US");
      url.searchParams.set("page", page.toString());

      try {
        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_TMDB_API_KEY}`,
          },
        });

        if (!response.ok) {
          throw new Error("TMDB movie search is not available.");
        }

        const data = await response.json();

        if (!ignore) {
          setMovies(data.results || []);
        }
      } catch (error) {
        if (!ignore) {
          setMovies([]);
          setMovieError(error instanceof Error ? error.message : "Unable to fetch movies.");
        }
      } finally {
        if (!ignore) {
          setIsLoadingMovies(false);
        }
      }
    }

    fetchMovies();

    return () => {
      ignore = true;
    };
  }, [page, isSearchMode, searchQuery, year, minDate, maxDate]);

  const handleMovieSelection = (movieId: number) => {
    setSelectedMovieId(movieId);
    setSaveStatus('idle');
    setSaveMessage('');
    localStorage.setItem('featuredMovieId', movieId.toString());
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setIsSearchMode(true);
      setPage(1);
      setSelectedMovieId(null);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setIsSearchMode(false);
    setPage(1);
    setSelectedMovieId(null);
  };

  const handleSaveSelection = async () => {
    if (!selectedMovie || !proposedStartDate) {
      return;
    }

    setSaveStatus('saving');
    setSaveMessage('');

    try {
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          movieId: selectedMovie.id,
          movieTitle: selectedMovie.title,
          showDate: proposedStartDate,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit admin selection.');
      }

      setSaveStatus('saved');
      setSaveMessage(result.message || 'Movie night setup saved.');
    } catch (error) {
      setSaveStatus('error');
      setSaveMessage(error instanceof Error ? error.message : 'Unable to save movie night setup.');
    }
  };

  const canSave = Boolean(selectedMovie && proposedStartDate && saveStatus !== 'saving');

  return (
    <main className="min-h-screen text-slate-50">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#111827]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-white">
              <Film className="size-5" />
              <span>Movie Club</span>
            </Link>
            <nav className="hidden items-center gap-4 text-sm md:flex">
              <Link href="/" className="text-slate-400 transition hover:text-white">
                Active Night
              </Link>
              <span className="text-slate-400">History</span>
              <Link href="/admin" className="border-b border-white pb-1 font-medium text-white">
                Admin
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="hidden border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 md:inline-flex">
              The Cinephiles
              <ChevronDown className="size-4" />
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-slate-400">
              <Settings2 className="size-4 text-cyan-300" />
              <span>Admin command center</span>
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-white">Setup movie night</h1>
            <p className="mt-2 max-w-2xl text-slate-400">
              Select the featured film, set the planning date, and prepare the session for ranked-choice showtime voting.
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
            <span className="text-slate-500">Status</span>
            <span className="ml-3 rounded bg-amber-400/10 px-2 py-1 font-medium text-amber-200">Draft setup</span>
          </div>
        </section>

        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {setupSteps.map((step, index) => {
            const Icon = step.icon;
            const isActive = step.state === 'active';

            return (
              <div
                key={step.label}
                className={`rounded-lg border p-4 ${
                  isActive
                    ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100'
                    : 'border-white/10 bg-slate-900/60 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <Icon className="size-5" />
                  <span className="font-mono text-xs text-slate-500">0{index + 1}</span>
                </div>
                <p className="mt-4 font-semibold">{step.label}</p>
              </div>
            );
          })}
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="space-y-6 lg:col-span-8">
            <Card className="border-white/10 bg-slate-900/80 py-6 shadow-2xl shadow-black/20">
              <CardHeader>
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-white">Select featured film</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {isSearchMode ? `Search results for "${searchQuery}"` : `Theatrical releases from ${minDate} to ${maxDate}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10">
                      <Upload className="size-4" />
                      Import
                    </Button>
                    <Button className="bg-white text-slate-950 hover:bg-slate-200">
                      <Plus className="size-4" />
                      Manual
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-6 flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      placeholder="Search for a movie title..."
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
                      className="border-white/10 bg-slate-950/60 pl-9 text-slate-100 placeholder:text-slate-500"
                    />
                  </div>
                  <Button onClick={handleSearch} disabled={!searchQuery.trim()} className="bg-white text-slate-950 hover:bg-slate-200">
                    Search
                  </Button>
                  {isSearchMode && (
                    <Button variant="outline" onClick={handleClearSearch} className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10">
                      Clear
                    </Button>
                  )}
                </div>

                {isLoadingMovies ? (
                  <div className="grid min-h-[360px] place-items-center rounded-lg border border-white/10 bg-slate-950/40">
                    <div className="flex flex-col items-center gap-3 text-slate-300">
                      <Loader2 className="size-8 animate-spin text-cyan-300" />
                      <p>Loading movie results...</p>
                    </div>
                  </div>
                ) : movieError ? (
                  <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-5">
                    <p className="font-semibold text-rose-100">Movie search failed</p>
                    <p className="mt-2 text-sm text-slate-300">{movieError}</p>
                  </div>
                ) : movies.length === 0 ? (
                  <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center text-slate-300">
                    No movies found. Try a different title or clear the search.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {movies.map((movie) => {
                      const isSelected = selectedMovieId === movie.id;

                      return (
                        <button
                          key={movie.id}
                          type="button"
                          onClick={() => handleMovieSelection(movie.id)}
                          className={`group overflow-hidden rounded-lg border bg-slate-950/50 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/40 ${
                            isSelected ? 'border-cyan-300/60 shadow-xl shadow-cyan-950/30' : 'border-white/10'
                          }`}
                        >
                          <div className="relative aspect-[2/3] bg-slate-950">
                            {movie.poster_path ? (
                              <Image
                                src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                                alt={movie.title}
                                fill
                                className="object-cover transition duration-500 group-hover:scale-105"
                                sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-slate-600">
                                <Clapperboard className="size-12" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                            {isSelected && (
                              <div className="absolute right-3 top-3 rounded-full bg-cyan-300 p-1.5 text-slate-950">
                                <Check className="size-4" />
                              </div>
                            )}
                          </div>
                          <div className="p-4">
                            <h3 className="line-clamp-2 font-semibold text-white">{movie.title}</h3>
                            <p className="mt-2 text-sm text-slate-400">Release: {movie.release_date || 'TBA'}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="mt-6 flex items-center justify-between">
                  <Button
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-slate-500">Page {page}</span>
                  <Button
                    variant="outline"
                    onClick={() => setPage((current) => current + 1)}
                    className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                  >
                    Next
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>

          <aside className="space-y-6 lg:col-span-4">
            <Card className="border-cyan-300/20 bg-slate-900/90 py-6 shadow-2xl shadow-cyan-950/20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-cyan-300/10 p-2 text-cyan-200">
                    <CalendarClock className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">Movie night setup</h2>
                    <p className="text-sm text-slate-400">Save only when movie and date are ready.</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="start-date" className="text-sm text-slate-300">Proposed start date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={proposedStartDate}
                    onChange={(event) => {
                      setProposedStartDate(event.target.value);
                      setSaveStatus('idle');
                      setSaveMessage('');
                    }}
                    className="border-white/10 bg-slate-950/60 text-slate-100"
                  />
                </div>

                <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-widest text-slate-500">Selected movie</p>
                  {selectedMovie ? (
                    <div className="mt-3 flex gap-3">
                      <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded bg-slate-950">
                        {selectedMovie.poster_path ? (
                          <Image
                            src={`https://image.tmdb.org/t/p/w185${selectedMovie.poster_path}`}
                            alt={selectedMovie.title}
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                        ) : (
                          <div className="grid h-full place-items-center text-slate-600">
                            <Film className="size-6" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{selectedMovie.title}</p>
                        <p className="mt-1 text-sm text-slate-400">{selectedMovie.release_date || 'Release TBA'}</p>
                        {proposedStartDate && <p className="mt-2 text-sm text-amber-200">{format(new Date(`${proposedStartDate}T00:00:00`), 'EEEE, MMMM d, yyyy')}</p>}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-400">Choose a movie from the results grid.</p>
                  )}
                </div>

                {saveMessage && (
                  <div
                    className={`rounded-lg border p-3 text-sm ${
                      saveStatus === 'saved'
                        ? 'border-green-400/30 bg-green-400/10 text-green-200'
                        : 'border-rose-400/30 bg-rose-500/10 text-rose-100'
                    }`}
                  >
                    {saveMessage}
                  </div>
                )}

                <Button
                  onClick={handleSaveSelection}
                  disabled={!canSave}
                  className="h-11 w-full rounded-lg bg-white font-semibold text-slate-950 hover:bg-slate-200"
                >
                  {saveStatus === 'saving' && <Loader2 className="size-4 animate-spin" />}
                  Save movie selection
                </Button>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-900/70 py-6">
              <CardHeader>
                <h2 className="text-lg font-semibold text-white">Next admin steps</h2>
                <p className="text-sm text-slate-400">Visual placeholders for the MVP workflow.</p>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between rounded border border-white/10 bg-slate-950/40 p-3">
                  <span>Review candidate showtimes</span>
                  <span className="text-slate-500">Soon</span>
                </div>
                <div className="flex items-center justify-between rounded border border-white/10 bg-slate-950/40 p-3">
                  <span>Open ranked voting</span>
                  <span className="text-slate-500">Soon</span>
                </div>
                <div className="flex items-center justify-between rounded border border-white/10 bg-slate-950/40 p-3">
                  <span>Confirm final plan</span>
                  <span className="text-slate-500">Soon</span>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  );
}
