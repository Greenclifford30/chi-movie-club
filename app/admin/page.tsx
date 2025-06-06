'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";

type Movie = {
  id: number;
  title: string;
  release_date: string;
  poster_path: string;
};

export default function AdminPage() {
  const today = new Date();
  const minDate = format(new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");
  const maxDate = format(new Date(today.getTime() + 28 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");
  const year = today.getFullYear().toString()

  const [movies, setMovies] = useState<Movie[]>([]);
  const [page, setPage] = useState(1);
  const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null);
  const [proposedStartDate, setProposedStartDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchMode, setIsSearchMode] = useState<boolean>(false);

  // Function to trigger admin selection API request
  const triggerAdminSelection = async (movieId: number, movieTitle: string) => {
    try {
      console.log(`Submitting admin selection: ${movieTitle} (ID: ${movieId}) on date: ${proposedStartDate}`);
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          movieId,
          movieTitle,
          showDate: proposedStartDate,
        }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        console.log('Admin selection submitted successfully:', result);
      } else {
        console.error('Error submitting admin selection:', result.error);
      }
    } catch (error) {
      console.error('Error submitting admin selection:', error);
    }
  };

  // Function to handle movie selection
  const handleMovieSelection = (movieId: number) => {
    setSelectedMovieId(movieId);
    
    // Trigger API if both movie and date are selected
    if (proposedStartDate) {
      const selected = movies.find((m) => m.id === movieId);
      if (selected) {
        triggerAdminSelection(selected.id, selected.title);
      }
    }
  };

  const fetchMovies = async () => {
    let url: URL;
    
    if (isSearchMode && searchQuery.trim()) {
      // Search mode
      url = new URL("https://api.themoviedb.org/3/search/movie");
      url.searchParams.set("query", searchQuery.trim());
      url.searchParams.set("primary_release_year", year);
    } else {
      // Discover mode
      url = new URL("https://api.themoviedb.org/3/discover/movie");
      url.searchParams.set("sort_by", "popularity.desc");
      url.searchParams.set("with_release_type", "2|3");
      url.searchParams.set("release_date.gte", minDate);
      url.searchParams.set("release_date.lte", maxDate);
    }
    
    // Common parameters
    url.searchParams.set("include_adult", "false");
    url.searchParams.set("include_video", "false");
    url.searchParams.set("language", "en-US");
    url.searchParams.set("region", "US");
    url.searchParams.set("page", page.toString());

    try {
      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_TMDB_API_KEY}`,
        },
      });

      const data = await res.json();
      setMovies(data.results || []);
    } catch (err) {
      console.error("Error fetching movies:", err);
    }
  };

  useEffect(() => {
    fetchMovies();
  }, [page, isSearchMode]);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setIsSearchMode(true);
      setPage(1);
      fetchMovies();
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setIsSearchMode(false);
    setPage(1);
  };

  const handleSaveDate = () => {
    if (proposedStartDate) {
      // Trigger API request if both movie and date are selected
      if (selectedMovieId !== null) {
        const selected = movies.find((m) => m.id === selectedMovieId);
        if (selected) {
          triggerAdminSelection(selected.id, selected.title);
        }
      }
    }
  };

  return (
    <main className="max-w-5xl mx-auto py-10 space-y-8">
      <div className="flex justify-between items-start mb-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">🎬 Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Configure movie selection and event planning
          </p>
        </div>
        <ThemeToggle />
      </div>

      <Card className="rounded-2xl shadow-lg">
        <CardHeader>
          <h2 className="text-2xl font-semibold">Proposed Start Date</h2>
          <p className="text-muted-foreground">Set the proposed date for movie night planning</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="start-date">Proposed Start Date</Label>
            <Input
              id="start-date"
              type="date"
              value={proposedStartDate}
              onChange={(e) => setProposedStartDate(e.target.value)}
              className="w-full max-w-xs"
            />
          </div>
          <Button onClick={handleSaveDate} disabled={!proposedStartDate}>
            Save Date
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-lg">
        <CardHeader>
          <h2 className="text-2xl font-semibold">Select Featured Film</h2>
          <p className="text-muted-foreground">
            {isSearchMode ? `Search results for "${searchQuery}"` : `Releases from ${minDate} to ${maxDate}`}
          </p>
        </CardHeader>
        <CardContent>
          <div className="mb-6 space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Search for a movie title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full"
                />
              </div>
              <Button onClick={handleSearch} disabled={!searchQuery.trim()}>
                Search
              </Button>
              {isSearchMode && (
                <Button variant="outline" onClick={handleClearSearch}>
                  Clear
                </Button>
              )}
            </div>
          </div>

          {movies.length === 0 && isSearchMode ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No movies found for "{searchQuery}". Try a different search term.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {movies.map((movie) => (
              <Card
                key={movie.id}
                className={`cursor-pointer border-2 rounded-2xl transition-all hover:shadow-md ${
                  selectedMovieId === movie.id ? 'border-primary shadow-lg' : 'border-border'
                }`}
                onClick={() => handleMovieSelection(movie.id)}
              >
                <CardContent className="p-4 space-y-2">
                  {movie.poster_path && (
                    <img
                      src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                      alt={movie.title}
                      className="rounded-lg w-full"
                    />
                  )}
                  <h3 className="text-lg font-semibold">{movie.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    Release: {movie.release_date || 'TBA'}
                  </p>
                  {isSearchMode && (
                    <p className="text-xs text-blue-600 font-medium">🔍 Search Result</p>
                  )}
                  {selectedMovieId === movie.id && (
                    <p className="text-primary font-bold">🎯 Selected</p>
                  )}
                </CardContent>
              </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded-lg">
          ⬅ Prev
        </Button>
        <span className="text-sm text-muted-foreground">Page {page}</span>
        <Button variant="outline" onClick={() => setPage(page + 1)} className="rounded-lg">
          Next ➡
        </Button>
      </div>
    </main>
  );
}
