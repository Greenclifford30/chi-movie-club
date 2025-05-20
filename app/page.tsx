'use client';
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TMDB_ACCESS_TOKEN = process.env.NEXT_PUBLIC_TMDB_API_KEY;

export default function HomePage() {
  const [selectedMovie, setSelectedMovie] = useState<string | null>(null);
  const [posterPath, setPosterPath] = useState<string | null>(null);
  const [showtimes, setShowtimes] = useState<{ theater: string; time: string }[]>([]);

  useEffect(() => {
    const movieId = localStorage.getItem("featuredMovieId");

    if (movieId && TMDB_ACCESS_TOKEN) {
      fetch(`https://api.themoviedb.org/3/movie/${movieId}?language=en-US`, {
        headers: {
          Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
          Accept: "application/json"
        }
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.title) {
            setSelectedMovie(data.title);
            setPosterPath(data.poster_path);

            // Fetch showtimes based on movie title
            fetch(`/api/showtimes?q=${encodeURIComponent(data.title)}`)
              .then((res) => res.json())
              .then((showtimesData) => {
                const parsed: { theater: string; time: string }[] = [];
                // ✅ Corrected SerpAPI showtime parsing logic
                showtimesData.forEach((entry: any) => {
                  entry.theaters?.forEach((theater: any) => {
                    theater.showing?.forEach((showing: any) => {
                      showing.time?.forEach((time: string) => {
                        parsed.push({
                          theater: theater.name,
                          time
                        });
                      });
                    });
                  });
                });
                setShowtimes(parsed);
              })
              .catch(() => setShowtimes([]));
          } else {
            setSelectedMovie("Unknown Movie");
          }
        })
        .catch(() => setSelectedMovie("Error fetching movie"));
    } else {
      setSelectedMovie("Movie not set");
    }
  }, []);

  return (
    <main className="min-h-screen bg-zinc-900 text-white p-6">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold mb-2">🎬 Movie Club</h1>
        <p className="text-zinc-400">Plan and coordinate your next movie outing</p>
      </header>

      <section className="max-w-3xl mx-auto">
        <div className="mb-8 bg-zinc-800 p-6 rounded-xl shadow-lg text-center">
          <h2 className="text-2xl font-semibold mb-2">This Week's Movie</h2>
          <p className="text-xl text-indigo-400 mb-4">{selectedMovie ?? "Loading..."}</p>
          {posterPath && (
            <img
              src={`https://image.tmdb.org/t/p/w300${posterPath}`}
              alt={selectedMovie ?? "Movie Poster"}
              className="mx-auto rounded-lg shadow-md"
            />
          )}
        </div>

        <div className="mb-8 bg-zinc-800 p-6 rounded-xl shadow-lg">
          <h2 className="text-2xl font-semibold mb-4">Vote for Showtimes</h2>
          <p className="text-zinc-400 mb-4">Select your top 3 theater + time combos in ranked order:</p>
          <div className="space-y-4">
            {[1, 2, 3].map((rank) => (
              <div key={rank} className="bg-zinc-700 p-4 rounded">
                <label className="block mb-2 font-medium">#{rank} Choice</label>
                <Select>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a showtime" />
                  </SelectTrigger>
                  <SelectContent>
                    {showtimes.map((entry, idx) => (
                      <SelectItem key={`${entry.theater}-${entry.time}-${idx}`} value={`${entry.theater} - ${entry.time}`}>
                        {entry.theater} — {entry.time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <Button className="text-lg">Confirm Movie Night</Button>
        </div>
      </section>
    </main>
  );
}
