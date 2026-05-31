import { NextRequest, NextResponse } from "next/server";

type Context = {
  params: Promise<{ path: string[] }>;
};

async function proxy(req: NextRequest, context: Context) {
  const { path } = await context.params;
  const apiHost = process.env.API_HOST || process.env.ADMIN_SELECTION_GATEWAY_URL;
  const apiKey = process.env.API_KEY || process.env.ADMIN_SELECTION_API_KEY;

  if (!apiHost || !apiKey) {
    return NextResponse.json(
      { error: "Movie Club API is not configured. Set API_HOST and API_KEY." },
      { status: 500 }
    );
  }

  const upstreamUrl = new URL(path.join("/"), `${apiHost.replace(/\/$/, "")}/`);
  req.nextUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.set(key, value);
  });

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Authorization bearer token is required." }, { status: 401 });
  }

  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();

  const response = await fetch(upstreamUrl, {
    method: req.method,
    headers: {
      "Content-Type": req.headers.get("content-type") || "application/json",
      Authorization: authHeader,
      "x-api-key": apiKey,
    },
    body,
    cache: "no-store",
  });

  const text = await response.text();
  const contentType = response.headers.get("content-type") || "application/json";

  return new NextResponse(text, {
    status: response.status,
    headers: {
      "Content-Type": contentType,
    },
  });
}

export async function GET(req: NextRequest, context: Context) {
  return proxy(req, context);
}

export async function POST(req: NextRequest, context: Context) {
  return proxy(req, context);
}

export async function PUT(req: NextRequest, context: Context) {
  return proxy(req, context);
}
