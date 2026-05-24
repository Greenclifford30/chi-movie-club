// app/api/showtimes/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const gatewayUrl = process.env.API_HOST;
    const apiKey = process.env.API_KEY;
    const apiGatewayUrl = `${gatewayUrl}/options`;

    if (!gatewayUrl || !apiKey) {
      console.error('Missing API_HOST or API_KEY');
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }
    const res = await fetch(apiGatewayUrl, { 
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      }});
    const data = await res.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching movie options:", error);
    return NextResponse.json({ error: "Failed to fetch movie options" }, { status: 500 });
  }
}
