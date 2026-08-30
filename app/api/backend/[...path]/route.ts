import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";

type Context = {
  params: Promise<{ path: string[] }>;
};

const upstreamTimeoutMs = 12_000;

function inviteRequestDetails(path: string[]) {
  if (path[0] !== "invites" || !path[1]) {
    return null;
  }
  return {
    route: path[2] === "accept" ? "/invites/:token/accept" : "/invites/:token",
    tokenHashPrefix: createHash("sha256").update(path[1]).digest("hex").slice(0, 12),
  };
}

function logInviteProxy(details: Record<string, unknown>) {
  console.info(JSON.stringify({ event: "movie_club_invite_proxy", ...details }));
}

async function proxy(req: NextRequest, context: Context) {
  const { path } = await context.params;
  const requestId = req.headers.get("x-movie-club-request-id") || randomUUID();
  const inviteDetails = inviteRequestDetails(path);
  const startedAt = Date.now();
  const apiHost = process.env.API_HOST || process.env.ADMIN_SELECTION_GATEWAY_URL;
  const apiKey = process.env.API_KEY || process.env.ADMIN_SELECTION_API_KEY;

  if (!apiHost || !apiKey) {
    if (inviteDetails) {
      logInviteProxy({ action: "configuration_error", requestId, ...inviteDetails });
    }
    return NextResponse.json(
      { error: "Movie Club API is not configured. Set API_HOST and API_KEY." },
      { status: 500, headers: { "x-movie-club-request-id": requestId } }
    );
  }

  const upstreamUrl = new URL(path.join("/"), `${apiHost.replace(/\/$/, "")}/`);
  req.nextUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.set(key, value);
  });

  const authHeader = req.headers.get("authorization");
  const isPublicInviteLookup = req.method === "GET" && path.length === 2 && path[0] === "invites";
  if (!authHeader && !isPublicInviteLookup) {
    if (inviteDetails) {
      logInviteProxy({ action: "authorization_error", requestId, ...inviteDetails });
    }
    return NextResponse.json(
      { error: "Authorization bearer token is required." },
      { status: 401, headers: { "x-movie-club-request-id": requestId } },
    );
  }

  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), upstreamTimeoutMs);
  let response: Response;
  try {
    response = await fetch(upstreamUrl, {
      method: req.method,
      headers: {
        "Content-Type": req.headers.get("content-type") || "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
        // Invite links are assembled by the API. Forward the browser-facing origin,
        // rather than the private API Gateway host, so shared links open the app.
        "x-movie-club-app-origin": req.nextUrl.origin,
        "x-movie-club-request-id": requestId,
        "x-api-key": apiKey,
      },
      body,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    const timedOut = controller.signal.aborted;
    if (inviteDetails) {
      logInviteProxy({
        action: "upstream_error",
        requestId,
        ...inviteDetails,
        durationMs: Date.now() - startedAt,
        error: timedOut ? "timeout" : error instanceof Error ? error.name : "unknown",
      });
    }
    return NextResponse.json(
      { error: timedOut ? "Invite acceptance timed out. Please try again." : "Movie Club API is unavailable. Please try again." },
      { status: timedOut ? 504 : 502, headers: { "x-movie-club-request-id": requestId } },
    );
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  const contentType = response.headers.get("content-type") || "application/json";

  if (inviteDetails) {
    logInviteProxy({
      action: "upstream_response",
      requestId,
      ...inviteDetails,
      status: response.status,
      durationMs: Date.now() - startedAt,
    });
  }

  return new NextResponse(text, {
    status: response.status,
    headers: {
      "Content-Type": contentType,
      "x-movie-club-request-id": requestId,
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

export async function DELETE(req: NextRequest, context: Context) {
  return proxy(req, context);
}
