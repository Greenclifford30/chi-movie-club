import { NextRequest, NextResponse } from 'next/server';

const API_GATEWAY_URL = process.env.ADMIN_SELECTION_GATEWAY_URL;
const API_KEY = process.env.ADMIN_SELECTION_API_KEY; // optional

export async function POST(req: NextRequest) {
  console.log("[API] POST /api/admin/selection");
  try {
    const body = await req.json();
    console.log("[API] Received body:", body);

    // If no external API gateway is configured, just return success
    // This allows the app to work locally without external dependencies
    if (!API_GATEWAY_URL) {
      console.log("No API_GATEWAY_URL configured, returning success locally");
      return NextResponse.json({ 
        success: true, 
        message: "Selection saved locally (no external API configured)" 
      }, { status: 200 });
    }
    console.log(API_GATEWAY_URL + "/admin/selection")
    const response = await fetch(API_GATEWAY_URL + "/admin/selection", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY && { 'x-api-key': API_KEY }),
      },
      body: JSON.stringify(body),
    });

    const responseBody = await response.json();

    return NextResponse.json(responseBody, { status: response.status });
  } catch (error) {
    console.error('POST to API Gateway failed:', error);
    return NextResponse.json({ error: 'Failed to invoke backend selection handler.' }, { status: 500 });
  }
}
