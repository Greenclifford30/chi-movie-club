'use client';
import { useEffect, useState } from "react";
import { format, addDays, parseISO, isAfter } from "date-fns";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ThemeToggle } from "@/components/theme-toggle";

const TMDB_ACCESS_TOKEN = process.env.NEXT_PUBLIC_TMDB_API_KEY;

export default function HomePage() {
  const [selectedMovie, setSelectedMovie] = useState<string | null>(null);
  const [posterPath, setPosterPath] = useState<string | null>(null);
  const [showtimes, setShowtimes] = useState<{ theater: string; time: string }[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [proposedStartDate, setProposedStartDate] = useState<string | null>(null);

  useEffect(() => {
    const movieId = localStorage.getItem("featuredMovieId");
    const savedProposedDate = localStorage.getItem("proposedStartDate");
    if (savedProposedDate) {
      setProposedStartDate(savedProposedDate);
    }

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
                showtimesData.forEach((entry: { theaters?: { name: string; showing?: { time?: string[] }[] }[] }) => {
                  entry.theaters?.forEach((theater) => {
                    theater.showing?.forEach((showing) => {
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

  // Generate availability dates based on proposed start date
  const generateAvailabilityDates = () => {
    if (!proposedStartDate) return [];
    
    const startDate = addDays(parseISO(proposedStartDate), 7); // 7 days after proposed date
    const today = new Date();
    const dates = [];
    
    for (let i = 0; i < 14; i++) {
      const date = addDays(startDate, i);
      const dateString = format(date, 'yyyy-MM-dd');
      const isDisabled = !isAfter(date, today);
      
      dates.push({
        value: dateString,
        label: format(date, 'EEE MM/dd'),
        disabled: isDisabled
      });
    }
    
    return dates;
  };

  const availabilityDates = generateAvailabilityDates();

  return (
    <main className="min-h-screen bg-background text-foreground p-6">
      <header className="mb-10">
        <div className="flex justify-between items-center mb-4">
          <div></div>
          <ThemeToggle />
        </div>
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">🎬 Movie Club</h1>
          <p className="text-muted-foreground">Plan and coordinate your next movie outing</p>
        </div>
      </header>

      <section className="max-w-4xl mx-auto space-y-8">
        <Card className="rounded-2xl shadow-lg">
          <CardHeader className="text-center">
            <h2 className="text-2xl font-semibold mb-2">This Week&apos;s Movie</h2>
            <p className="text-xl text-primary">{selectedMovie ?? "Loading..."}</p>
          </CardHeader>
          <CardContent className="text-center">
            {posterPath && (
              <img
                src={`https://image.tmdb.org/t/p/w300${posterPath}`}
                alt={selectedMovie ?? "Movie Poster"}
                className="mx-auto rounded-lg shadow-md"
              />
            )}
          </CardContent>
        </Card>

        {proposedStartDate && availabilityDates.length > 0 && (
          <Card className="rounded-2xl shadow-lg">
            <CardHeader>
              <h2 className="text-2xl font-semibold">Set Your Availability</h2>
              <p className="text-muted-foreground">Pick the dates you&apos;re available to attend a movie night.</p>
            </CardHeader>
            <CardContent>
              <ToggleGroup value={availableDates} onValueChange={setAvailableDates}>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {availabilityDates.map((date) => (
                    <ToggleGroupItem
                      key={date.value}
                      value={date.value}
                      disabled={date.disabled}
                      className="h-12 text-sm"
                    >
                      {date.label}
                    </ToggleGroupItem>
                  ))}
                </div>
              </ToggleGroup>
            </CardContent>
          </Card>
        )}

        <Card className="rounded-2xl shadow-lg">
          <CardHeader>
            <h2 className="text-2xl font-semibold">Vote for Showtimes</h2>
            <p className="text-muted-foreground">Select your top 3 theater + time combos in ranked order:</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((rank) => (
                <div key={rank} className="bg-muted p-4 rounded-lg">
                  <label className="block mb-2 font-medium">#{rank} Choice</label>
                  <Select>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a showtime" />
                    </SelectTrigger>
                    <SelectContent>
                      {showtimes.map((entry, idx) => (
                        <SelectItem 
                          key={`${entry.theater}-${entry.time}-${idx}`} 
                          value={`${entry.theater} - ${entry.time}`}
                        >
                          {entry.theater} — {entry.time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button className="text-lg px-8 py-3 rounded-lg">
            Confirm Movie Night
          </Button>
        </div>
      </section>
    </main>
  );
}
