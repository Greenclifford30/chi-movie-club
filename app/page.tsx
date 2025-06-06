'use client';
import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

interface MovieOption {
  movieId: number;
  movieTitle: string;
  showDate: string;
  theaters: {
    name: string;
    formats: {
      type: string;
      slots: {
        date: string;
        time: string;
      }[];
    }[];
  }[];
}

interface ShowtimeSlot {
  theater: string;
  time: string;
  format: string;
  date: string;
}

export default function HomePage() {
  const [movieOptions, setMovieOptions] = useState<MovieOption[]>([]);
  const [posterPath, setPosterPath] = useState<string | null>(null);
  const [showtimes, setShowtimes] = useState<ShowtimeSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedShowtimes, setSelectedShowtimes] = useState<string[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  useEffect(() => {
    const TMDB_ACCESS_TOKEN = process.env.NEXT_PUBLIC_TMDB_API_KEY;
    
    // Fetch movie options from API gateway
    fetch('/api/showtimes')
      .then((res) => res.json())
      .then((data: MovieOption[]) => {
        setMovieOptions(data);
        
        // Extract all unique dates and sort them
        const dates = [...new Set(data.map(option => option.showDate))].sort();
        setAvailableDates(dates);
        setSelectedDate(dates[0] || "");
        
        // Parse all showtimes from the new API structure
        const parsed: ShowtimeSlot[] = [];
        data.forEach((option) => {
          option.theaters.forEach((theater) => {
            theater.formats.forEach((format) => {
              format.slots.forEach((slot) => {
                parsed.push({
                  theater: theater.name,
                  time: slot.time,
                  format: format.type,
                  date: slot.date
                });
              });
            });
          });
        });
        setShowtimes(parsed);

        // Fetch movie poster from TMDB using movie title (use first option)
        if (data.length > 0 && data[0].movieTitle && TMDB_ACCESS_TOKEN) {
          fetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(data[0].movieTitle)}`, {
            headers: {
              Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
              Accept: "application/json"
            }
          })
            .then((res) => res.json())
            .then((tmdbData) => {
              if (tmdbData.results && tmdbData.results.length > 0) {
                setPosterPath(tmdbData.results[0].poster_path);
              }
            })
            .catch((error) => {
              console.error('Error fetching movie poster:', error);
            });
        }
      })
      .catch((error) => {
        console.error('Error fetching movie options:', error);
        setMovieOptions([]);
      });
  }, []);

  // Filter showtimes by selected date
  const filteredShowtimes = showtimes.filter(showtime => showtime.date === selectedDate);
  
  // Group showtimes by theater
  const showtimesByTheater = filteredShowtimes.reduce((acc, showtime) => {
    if (!acc[showtime.theater]) {
      acc[showtime.theater] = [];
    }
    acc[showtime.theater].push(showtime);
    return acc;
  }, {} as Record<string, ShowtimeSlot[]>);

  const handleShowtimeToggle = (showtimeId: string) => {
    setSelectedShowtimes(prev => {
      if (prev.includes(showtimeId)) {
        return prev.filter(id => id !== showtimeId);
      } else if (prev.length < 3) {
        return [...prev, showtimeId];
      }
      return prev;
    });
  };

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
            <p className="text-xl text-primary">{movieOptions[0]?.movieTitle ?? "Loading..."}</p>
          </CardHeader>
          <CardContent className="text-center">
            {posterPath && (
              <div className="relative w-[300px] h-[450px] mx-auto mb-4">
                <Image
                  src={`https://image.tmdb.org/t/p/w300${posterPath}`}
                  alt={movieOptions[0]?.movieTitle ?? "Movie Poster"}
                  fill
                  className="rounded-lg shadow-md object-cover"
                  sizes="300px"
                />
              </div>
            )}
            {availableDates.length > 0 && (
              <p className="text-muted-foreground">
                Available: {format(parseISO(availableDates[0]), 'EEEE, MMMM do')} - {format(parseISO(availableDates[availableDates.length - 1]), 'EEEE, MMMM do, yyyy')}
              </p>
            )}
          </CardContent>
        </Card>

        {availableDates.length > 0 && (
          <Card className="rounded-2xl shadow-lg">
            <CardHeader>
              <h2 className="text-2xl font-semibold">Select Date</h2>
              <p className="text-muted-foreground">Choose which date you&apos;d like to see the movie.</p>
            </CardHeader>
            <CardContent>
              <Select value={selectedDate} onValueChange={setSelectedDate}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a date" />
                </SelectTrigger>
                <SelectContent>
                  {availableDates.map((date) => (
                    <SelectItem key={date} value={date}>
                      {format(parseISO(date), 'EEEE, MMMM do, yyyy')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {selectedDate && Object.keys(showtimesByTheater).length > 0 && (
          <Card className="rounded-2xl shadow-lg">
            <CardHeader>
              <h2 className="text-2xl font-semibold">Select Showtimes</h2>
              <p className="text-muted-foreground">
                Choose up to 3 preferred showtimes for {format(parseISO(selectedDate), 'EEEE, MMMM do')}. 
                Selected: {selectedShowtimes.length}/3
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {Object.entries(showtimesByTheater).map(([theater, times]) => (
                  <div key={theater}>
                    <h3 className="text-lg font-semibold mb-3 text-primary">{theater}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {times.map((showtime, idx) => {
                        const showtimeId = `${showtime.theater}-${showtime.time}-${showtime.format}-${idx}`;
                        const isSelected = selectedShowtimes.includes(showtimeId);
                        const canSelect = selectedShowtimes.length < 3 || isSelected;
                        
                        return (
                          <button
                            key={showtimeId}
                            onClick={() => handleShowtimeToggle(showtimeId)}
                            disabled={!canSelect}
                            className={`p-3 rounded-lg text-sm font-medium transition-colors border-2 ${
                              isSelected 
                                ? 'bg-primary text-primary-foreground border-primary' 
                                : canSelect
                                ? 'bg-background border-border hover:bg-muted hover:border-primary/50'
                                : 'bg-muted text-muted-foreground border-muted cursor-not-allowed'
                            }`}
                          >
                            <div className="text-center">
                              <div className="font-semibold">{showtime.time}</div>
                              <div className="text-xs opacity-80">{showtime.format}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-center">
          <Button className="text-lg px-8 py-3 rounded-lg">
            Confirm Movie Night
          </Button>
        </div>
      </section>
    </main>
  );
}
