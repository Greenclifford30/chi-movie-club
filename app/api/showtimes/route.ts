// app/api/showtimes/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const serpApiKey = process.env.SERP_API_KEY;
  const { searchParams } = new URL(req.url);
  const movieTitle = searchParams.get("q") || "eternals theater"; // default fallback
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("q", movieTitle);
  url.searchParams.set("location", "Chicago, Illinois, United States");
  url.searchParams.set("hl", "en");
  url.searchParams.set("gl", "us");
  url.searchParams.set("api_key", serpApiKey!);

  const res = await fetch(url.toString());
  const data = await res.json();

  return NextResponse.json(data.showtimes || []);
}
