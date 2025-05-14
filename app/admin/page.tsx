import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";

type Movie = {
  id: number;
  title: string;
  release_date: string;
  poster_path: string;
};

export default async function AdminPage() {
  const today = new Date();
  const minDate = format(new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"); // 2 weeks ago
  const maxDate = format(new Date(today.getTime() + 28 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"); // 4 weeks ahead

  const url = new URL("https://api.themoviedb.org/3/discover/movie");
  url.searchParams.set("include_adult", "true");
  url.searchParams.set("include_video", "false");
  url.searchParams.set("language", "en-US");
  url.searchParams.set("page", "1");
  url.searchParams.set("sort_by", "popularity.desc");
//   url.searchParams.set("region", "US");
  url.searchParams.set("with_release_type", "3|2"); // Theatrical and digital
  url.searchParams.set("release_date.gte", minDate);
  url.searchParams.set("release_date.lte", maxDate);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("TMDB Error:", res.status, res.statusText, body);
      throw new Error(`Failed to fetch movies`);
    }

    const data = await res.json();
    const movies: Movie[] = data.results;

    return (
      <main className="max-w-4xl mx-auto py-10 space-y-6">
        <h1 className="text-3xl font-bold">🎬 Select Featured Film</h1>
        <p className="text-muted-foreground">
          Showing releases between <strong>{minDate}</strong> and <strong>{maxDate}</strong>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {movies.map((movie) => (
            <Card key={movie.id}>
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
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    );
  } catch (err: any) {
    console.error("Fetch error:", err.message || err);
    return (
      <main className="max-w-xl mx-auto py-10 text-red-500">
        <p>⚠️ Error loading movies: {err.message || "Unknown error"}</p>
      </main>
    );
  }
}
