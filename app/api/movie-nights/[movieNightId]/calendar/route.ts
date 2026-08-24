import { NextRequest, NextResponse } from "next/server";
import { createMovieNightCalendar } from "@/lib/calendar/create-movie-night-calendar";
import type { MovieNight, Showtime } from "@/lib/movie-club-types";

export const runtime = "nodejs";

type Context = { params: Promise<{ movieNightId: string }> };

export async function GET(req: NextRequest, context: Context) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  const apiHost = process.env.API_HOST || process.env.ADMIN_SELECTION_GATEWAY_URL;
  const apiKey = process.env.API_KEY || process.env.ADMIN_SELECTION_API_KEY;
  if (!apiHost || !apiKey) return NextResponse.json({ error: "Movie Club API is not configured." }, { status: 500 });

  const { movieNightId } = await context.params;
  const upstreamUrl = `${apiHost.replace(/\/$/, "")}/movie-nights/${encodeURIComponent(movieNightId)}/calendar`;
  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, { headers: { Authorization: authHeader, "x-api-key": apiKey }, cache: "no-store" });
  } catch {
    return NextResponse.json({ error: "Unable to load the confirmed Movie Night." }, { status: 500 });
  }
  if (!upstream.ok) {
    if ([401, 403, 404, 409, 422].includes(upstream.status)) {
      const body = await upstream.text();
      let payload: unknown;
      try { payload = body ? JSON.parse(body) : null; } catch { payload = null; }
      return NextResponse.json(payload || { error: upstream.status === 404 ? "Movie Night not found." : "Calendar is unavailable." }, { status: upstream.status === 403 ? 404 : upstream.status });
    }
    return NextResponse.json({ error: "Unable to create the calendar file." }, { status: 500 });
  }

  let data: { movieNight: MovieNight; showtime: Showtime };
  try { data = await upstream.json() as typeof data; } catch { return NextResponse.json({ error: "Calendar data is invalid." }, { status: 422 }); }
  try {
    const calendar = createMovieNightCalendar({ movieNight: data.movieNight, showtime: data.showtime, url: new URL(`/clubs/${encodeURIComponent(data.movieNight.clubId)}`, req.url).toString() });
    return new NextResponse(calendar.content, { status: 200, headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${calendar.filename}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return NextResponse.json({ error: "Confirmed Movie Night data is invalid." }, { status: 422 });
  }
}
