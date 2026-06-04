"use client";

import type {
  ActiveMovieNightResponse,
  ApiErrorBody,
  CachedShowtime,
  Club,
  ClubInvite,
  ClubMembership,
  ClubsResponse,
  HistoryMovieNight,
  MovieSnapshot,
  Rsvp,
  RsvpStatus,
  Showtime,
  TicketStatus,
  Vote,
  VoteResults,
} from "@/lib/movie-club-types";

export class MovieClubApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "MovieClubApiError";
    this.status = status;
  }
}

async function apiFetch<T>(
  token: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`/api/backend${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const body = data as ApiErrorBody | null;
    throw new MovieClubApiError(
      body?.error || body?.message || "Movie Club API request failed.",
      response.status
    );
  }

  return data as T;
}

async function publicApiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/backend${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const body = data as ApiErrorBody | null;
    throw new MovieClubApiError(
      body?.error || body?.message || "Movie Club API request failed.",
      response.status
    );
  }

  return data as T;
}

export function listClubs(token: string) {
  return apiFetch<ClubsResponse>(token, "/clubs");
}

export function createClub(token: string, body: { name: string; clubId?: string }) {
  return apiFetch<{ club: Club }>(token, "/clubs", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listClubInvites(token: string, clubId: string) {
  return apiFetch<{ invites: ClubInvite[] }>(
    token,
    `/clubs/${encodeURIComponent(clubId)}/invites`
  );
}

export function createClubInvites(token: string, clubId: string, emails: string[]) {
  return apiFetch<{ invites: ClubInvite[] }>(
    token,
    `/clubs/${encodeURIComponent(clubId)}/invites`,
    { method: "POST", body: JSON.stringify({ emails }) }
  );
}

export function getInvite(token: string) {
  return publicApiFetch<{ invite: ClubInvite }>(`/invites/${encodeURIComponent(token)}`);
}

export function acceptInvite(authToken: string, inviteToken: string) {
  return apiFetch<{ membership: ClubMembership; clubId: string }>(
    authToken,
    `/invites/${encodeURIComponent(inviteToken)}/accept`,
    { method: "POST", body: JSON.stringify({}) }
  );
}

export function searchMovies(token: string, query: string, page = 1) {
  const params = new URLSearchParams({ query, page: String(page) });
  return apiFetch<{ results: MovieSnapshot[] }>(token, `/movies/search?${params}`);
}

export function getNowPlayingMovies(token: string, page = 1) {
  const params = new URLSearchParams({ page: String(page) });
  return apiFetch<{ results: MovieSnapshot[] }>(token, `/movies/now-playing?${params}`);
}

export function createMovieNight(
  token: string,
  clubId: string,
  body: { targetDate: string; movieSelectionMode: "admin_selected"; movie: MovieSnapshot }
) {
  return apiFetch<{ movieNight: ActiveMovieNightResponse["movieNight"] }>(
    token,
    `/clubs/${encodeURIComponent(clubId)}/movie-nights`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

export function getActiveMovieNight(token: string, clubId: string) {
  return apiFetch<ActiveMovieNightResponse>(
    token,
    `/clubs/${encodeURIComponent(clubId)}/movie-nights/active`
  );
}

export function addShowtimes(
  token: string,
  movieNightId: string,
  body: { showtimes?: Partial<Showtime>[]; cachedShowtimeKeys?: { PK: string; SK: string }[] }
) {
  return apiFetch<{ showtimes: Showtime[] }>(
    token,
    `/movie-nights/${encodeURIComponent(movieNightId)}/showtimes`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

export function refreshGracenote(
  token: string,
  body: { zip: string; radius: number; numDays: number; units: "mi" | "km" }
) {
  return apiFetch<{ success?: boolean; message?: string }>(
    token,
    "/admin/showtimes/gracenote/refresh",
    { method: "POST", body: JSON.stringify(body) }
  );
}

export function searchGracenoteShowtimes(
  token: string,
  params: {
    title: string;
    zip: string;
    radius: number;
    numDays: number;
    units: "mi" | "km";
    provider?: string;
    providerMovieId?: string;
  }
) {
  const searchParams = new URLSearchParams({
    title: params.title,
    zip: params.zip,
    radius: String(params.radius),
    numDays: String(params.numDays),
    units: params.units,
  });
  if (params.provider) {
    searchParams.set("provider", params.provider);
  }
  if (params.providerMovieId) {
    searchParams.set("providerMovieId", params.providerMovieId);
  }

  return apiFetch<{ showtimes: CachedShowtime[] }>(
    token,
    `/admin/showtimes/gracenote/search?${searchParams}`
  );
}

export function submitVote(token: string, movieNightId: string, rankings: string[]) {
  return apiFetch<{ vote: Vote }>(
    token,
    `/movie-nights/${encodeURIComponent(movieNightId)}/vote`,
    { method: "PUT", body: JSON.stringify({ rankings }) }
  );
}

export function getVoteResults(token: string, movieNightId: string) {
  return apiFetch<VoteResults>(
    token,
    `/movie-nights/${encodeURIComponent(movieNightId)}/vote-results`
  );
}

export function confirmShowtime(token: string, movieNightId: string, showtimeId: string) {
  return apiFetch<{ movieNight: ActiveMovieNightResponse["movieNight"] }>(
    token,
    `/movie-nights/${encodeURIComponent(movieNightId)}/confirm`,
    { method: "POST", body: JSON.stringify({ showtimeId }) }
  );
}

export function updateRsvp(
  token: string,
  movieNightId: string,
  status: RsvpStatus,
  ticketStatus: TicketStatus
) {
  return apiFetch<{ rsvp: Rsvp }>(
    token,
    `/movie-nights/${encodeURIComponent(movieNightId)}/rsvp`,
    { method: "PUT", body: JSON.stringify({ status, ticketStatus }) }
  );
}

export function listHistory(token: string, clubId: string) {
  return apiFetch<{ movieNights: HistoryMovieNight[] }>(
    token,
    `/clubs/${encodeURIComponent(clubId)}/movie-nights/history`
  );
}
