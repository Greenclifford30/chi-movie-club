"use client";

import type {
  ActiveMovieNightResponse,
  AttendanceResponse,
  ApiErrorBody,
  CachedShowtime,
  Club,
  ClubInvite,
  ClubMembership,
  ClubsResponse,
  HistoryMovieNight,
  MovieDiscoveryResult,
  MovieNightPlanningInput,
  MovieSnapshot,
  Rsvp,
  RsvpStatus,
  Showtime,
  ShowtimeImportJob,
  TicketStatus,
  Vote,
  VoteResults,
  UserPlanningPreferences,
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

export function getUserPlanningPreferences(token: string) {
  return apiFetch<{ preferences: UserPlanningPreferences }>(token, "/me/preferences");
}

export function updateUserPlanningPreferences(
  token: string,
  preferences: Pick<UserPlanningPreferences, "defaultZipCode" | "defaultRadiusMiles" | "preferredFormats">
) {
  return apiFetch<{ preferences: UserPlanningPreferences }>(token, "/me/preferences", {
    method: "PUT",
    body: JSON.stringify(preferences),
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

export function addClubMembers(token: string, clubId: string, emails: string[]) {
  return apiFetch<{ members: ClubMembership[] }>(
    token,
    `/clubs/${encodeURIComponent(clubId)}/members`,
    { method: "POST", body: JSON.stringify({ emails, role: "friend" }) }
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

export function discoverMovies(token: string, mode: "now-playing" | "coming-soon", page = 1) {
  const params = new URLSearchParams({ mode, page: String(page) });
  return apiFetch<{ results: MovieDiscoveryResult[] }>(token, `/movies/now-playing?${params}`);
}

export function createMovieNight(
  token: string,
  clubId: string,
  body: MovieNightPlanningInput & { movieSelectionMode: "admin_selected"; movie: MovieSnapshot }
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

export async function downloadMovieNightCalendar(token: string, movieNightId: string) {
  const response = await fetch(
    `/api/movie-nights/${encodeURIComponent(movieNightId)}/calendar`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );

  if (!response.ok) {
    const text = await response.text();
    let message = "Unable to download the Movie Night calendar.";
    try {
      const body = text ? JSON.parse(text) as ApiErrorBody : null;
      message = body?.error || body?.message || message;
    } catch {
      // Keep the safe generic message for non-JSON failures.
    }
    throw new MovieClubApiError(message, response.status);
  }

  return {
    blob: await response.blob(),
    filename: attachmentFilename(response.headers.get("content-disposition")) || "movie-night.ics",
  };
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

export function updateMovieNightPlanning(
  token: string,
  movieNightId: string,
  planning: MovieNightPlanningInput
) {
  return apiFetch<{ movieNight: ActiveMovieNightResponse["movieNight"] }>(
    token,
    `/movie-nights/${encodeURIComponent(movieNightId)}/showtimes`,
    { method: "POST", body: JSON.stringify({ action: "updatePlanning", ...planning }) }
  );
}

export function updateMovieNightSetup(
  token: string,
  movieNightId: string,
  setup: MovieNightPlanningInput & { movie: MovieSnapshot }
) {
  return apiFetch<{ movieNight: ActiveMovieNightResponse["movieNight"] }>(
    token,
    `/movie-nights/${encodeURIComponent(movieNightId)}/showtimes`,
    { method: "POST", body: JSON.stringify({ action: "updatePlanning", ...setup }) }
  );
}

export function importShowtimesForMovieNight(token: string, movieNightId: string) {
  return apiFetch<{
    importJob: ShowtimeImportJob;
    movieNight: ActiveMovieNightResponse["movieNight"];
    showtimes: Showtime[];
  }>(token, `/movie-nights/${encodeURIComponent(movieNightId)}/showtimes`, {
    method: "POST",
    body: JSON.stringify({ action: "import" }),
  });
}

export function approveShowtimeCandidate(token: string, movieNightId: string, showtimeId: string) {
  return apiFetch<{ showtime: Showtime }>(
    token,
    `/movie-nights/${encodeURIComponent(movieNightId)}/showtimes`,
    { method: "POST", body: JSON.stringify({ action: "approve", showtimeId }) }
  );
}

export function rejectShowtimeCandidate(token: string, movieNightId: string, showtimeId: string) {
  return apiFetch<{ showtime: Showtime }>(
    token,
    `/movie-nights/${encodeURIComponent(movieNightId)}/showtimes`,
    { method: "POST", body: JSON.stringify({ action: "reject", showtimeId }) }
  );
}

export function approveBulkShowtimeCandidates(token: string, movieNightId: string, showtimeIds: string[]) {
  return apiFetch<{ showtimes: Showtime[] }>(
    token,
    `/movie-nights/${encodeURIComponent(movieNightId)}/showtimes`,
    { method: "POST", body: JSON.stringify({ action: "approveBulk", showtimeIds }) }
  );
}

export function openVoting(token: string, movieNightId: string, votingClosesAt: string) {
  return apiFetch<{ movieNight: ActiveMovieNightResponse["movieNight"]; showtimes: Showtime[] }>(
    token,
    `/movie-nights/${encodeURIComponent(movieNightId)}/showtimes`,
    { method: "POST", body: JSON.stringify({ action: "openVoting", votingClosesAt }) }
  );
}

export function closeVoting(token: string, movieNightId: string) {
  return apiFetch<{ movieNight: ActiveMovieNightResponse["movieNight"] }>(
    token,
    `/movie-nights/${encodeURIComponent(movieNightId)}/showtimes`,
    { method: "POST", body: JSON.stringify({ action: "closeVoting" }) }
  );
}

export function getAttendance(token: string, movieNightId: string) {
  return apiFetch<AttendanceResponse>(
    token,
    `/movie-nights/${encodeURIComponent(movieNightId)}/attendance`
  );
}

export function refreshGracenote(
  token: string,
  body: { zip: string; radius: number; numDays: number; units: "mi" | "km"; startDate?: string }
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
    startDate?: string;
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
  if (params.startDate) {
    searchParams.set("startDate", params.startDate);
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

export function completeMovieNight(token: string, movieNightId: string) {
  return apiFetch<{ movieNight: ActiveMovieNightResponse["movieNight"] }>(
    token,
    `/movie-nights/${encodeURIComponent(movieNightId)}/complete`,
    { method: "POST", body: JSON.stringify({}) }
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

function attachmentFilename(contentDisposition: string | null) {
  const match = contentDisposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1];
}
