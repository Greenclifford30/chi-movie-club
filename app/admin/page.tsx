'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

  const [movies, setMovies] = useState<Movie[]>([]);
  const [page, setPage] = useState(1);
  const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const savedId = localStorage.getItem('featuredMovieId');
    if (savedId) {
      setSelectedMovieId(parseInt(savedId, 10));
    }
  }, []);

  // Save selected movie to localStorage when it changes
  useEffect(() => {
    if (selectedMovieId !== null) {
      const selected = movies.find((m) => m.id === selectedMovieId);
      if (selected) {
        localStorage.setItem('featuredMovieId', selected.id.toString());
        localStorage.setItem('featuredMovieTitle', selected.title);
      }
    }
  }, [selectedMovieId, movies]);

  useEffect(() => {
    const fetchMovies = async () => {
      const url = new URL("https://api.themoviedb.org/3/discover/movie");
      url.searchParams.set("include_adult", "false");
      url.searchParams.set("include_video", "false");
      url.searchParams.set("language", "en-US");
      url.searchParams.set("region", "US");
      url.searchParams.set("sort_by", "popularity.desc");
      url.searchParams.set("with_release_type", "2|3");
      url.searchParams.set("release_date.gte", minDate);
      url.searchParams.set("release_date.lte", maxDate);
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

    fetchMovies();
  }, [page]);

  return (
    <main className="max-w-5xl mx-auto py-10 space-y-6">
      <h1 className="text-3xl font-bold">🎬 Select Featured Film</h1>
      <p className="text-muted-foreground">
        Releases from <strong>{minDate}</strong> to <strong>{maxDate}</strong>
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {movies.map((movie) => (
          <Card
            key={movie.id}
            className={`cursor-pointer border-2 ${
              selectedMovieId === movie.id ? 'border-primary' : 'border-border'
            }`}
            onClick={() => setSelectedMovieId(movie.id)}
          >
            <CardContent className="p-4 space-y-2">
              {movie.poster_path && (
                <img
                  src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                  alt={movie.title}
                  className="rounded"
                />
              )}
              <h2 className="text-lg font-semibold">{movie.title}</h2>
              <p className="text-sm text-muted-foreground">
                Release: {movie.release_date}
              </p>
              {selectedMovieId === movie.id && (
                <p className="text-primary font-bold">🎯 Selected</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-between items-center pt-6">
        <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
          ⬅ Prev
        </Button>
        <span>Page {page}</span>
        <Button variant="outline" onClick={() => setPage(page + 1)}>
          Next ➡
        </Button>
      </div>
    </main>
  );
}
