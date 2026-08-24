export type MovieNightStatus = "planning" | "voting" | "confirmed" | "completed" | "cancelled";

export type RsvpStatus = "going" | "maybe" | "not_going";

export type TicketStatus = "not_purchased" | "purchased";

export type ClubRole = "admin" | "friend" | "guest";

export interface Club {
  clubId: string;
  name: string;
  role?: ClubRole;
  activeStatus?: MovieNightStatus;
  memberCount?: number;
}

export interface ClubsResponse {
  clubs: Club[];
  isPlatformAdmin: boolean;
}

export interface UserPlanningPreferences {
  defaultZipCode: string;
  defaultRadiusMiles: number;
  preferredFormats: string[];
  updatedAt?: string;
}

export interface ClubInvite {
  clubId: string;
  clubName?: string;
  inviteId: string;
  email: string;
  role: "friend";
  status: "pending" | "accepted" | "expired";
  expiresAt: string;
  expiresAtEpoch?: number;
  createdAt?: string;
  updatedAt?: string;
  inviteUrl?: string;
}

export interface ClubMembership {
  clubId: string;
  userId: string;
  email?: string;
  name?: string;
  role: ClubRole;
  status?: "active" | "invited" | "removed";
  createdAt?: string;
  updatedAt?: string;
}

export interface MovieSnapshot {
  externalProvider?: string;
  externalMovieId?: string;
  provider: string;
  externalId: string;
  title: string;
  overview?: string;
  posterPath?: string;
  posterUrl?: string;
  releaseDate?: string;
  releaseYear?: string;
  runtime?: number | null;
  genres?: string[] | number[];
  rating?: number | null;
  popularity?: number | null;
  status?: "now_playing" | "coming_soon" | string;
  metadataSnapshot?: Record<string, unknown>;
}

export interface MovieNight {
  clubId: string;
  movieNightId: string;
  status: MovieNightStatus;
  movieSelectionMode?: "admin_selected" | "group_vote";
  movie: MovieSnapshot;
  targetDate?: string;
  dateWindowStart?: string;
  dateWindowEnd?: string;
  zipCode?: string;
  radiusMiles?: number;
  timezone?: string;
  preferredFormats?: string[];
  preferredTheaterIds?: string[];
  showtimeImportStatus?: "idle" | "queued" | "running" | "completed" | "failed" | string;
  lastShowtimeImportAt?: string;
  lastShowtimeImportSummary?: ShowtimeImportSummary;
  votingClosesAt?: string;
  votingClosedAt?: string;
  votingClosedBy?: string;
  confirmedShowtimeId?: string;
  confirmedShowtime?: Showtime;
  confirmedAt?: string;
  calendarSequence?: number;
  confirmedBy?: string;
  completedAt?: string;
  completedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Showtime {
  movieNightId: string;
  showtimeId: string;
  provider?: string;
  externalShowtimeId?: string;
  externalMovieId?: string;
  externalTheaterId?: string;
  providerShowtimeId?: string;
  providerMovieId?: string;
  providerTheaterId?: string;
  theaterName: string;
  theaterLocation?: string;
  theaterAddress?: string;
  startsAt?: string;
  startsAtUtc: string;
  localDate?: string;
  localTime?: string;
  localDateTime?: string;
  timezone?: string;
  screenFormat?: string;
  amenities?: string[];
  ticketURI?: string;
  quals?: string[];
  importJobId?: string;
  dedupeKey?: string;
  status?: "imported" | "approved" | "rejected";
}

export interface MovieNightPlanningInput {
  targetDate: string;
  dateWindowStart: string;
  dateWindowEnd: string;
  zipCode: string;
  radiusMiles: number;
  timezone?: string;
  preferredFormats?: string[];
  preferredTheaterIds?: string[];
}

export interface ShowtimeImportSummary {
  resultCount?: number;
  importedCount?: number;
  duplicateCount?: number;
  requestedDates?: string[];
  errorMessage?: string;
}

export interface ShowtimeImportJob {
  importJobId: string;
  movieNightId: string;
  clubId: string;
  provider: string;
  status: "queued" | "running" | "completed" | "failed";
  params: {
    movieExternalId: string;
    zipCode: string;
    radiusMiles: number;
    dateWindowStart: string;
    dateWindowEnd: string;
  };
  requestedDates: string[];
  resultCount: number;
  importedCount: number;
  duplicateCount: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MovieDiscoveryResult {
  externalProvider: string;
  externalMovieId: string;
  title: string;
  overview?: string;
  posterUrl?: string;
  releaseDate?: string;
  runtimeMinutes?: number;
  genres?: string[];
  status: "now_playing" | "coming_soon";
  metadataSnapshot?: Record<string, unknown>;
}

export interface CachedShowtime {
  PK: string;
  SK: string;
  provider?: string;
  providerShowtimeId?: string;
  providerMovieId?: string;
  providerTheaterId?: string;
  theaterName: string;
  theaterLocation?: string;
  startsAtUtc: string;
  localDateTime?: string;
  screenFormat?: string;
  ticketURI?: string;
  quals?: string[];
}

export interface Vote {
  movieNightId: string;
  userId?: string;
  rankings: string[];
  updatedAt?: string;
}

export interface VoteStanding {
  showtimeId: string;
  points: number;
  firstChoiceVotes: number;
  rankedVotes: number;
  showtime: Showtime;
}

export interface VoteResults {
  voteCount: number;
  standings: VoteStanding[];
}

export interface Rsvp {
  movieNightId: string;
  userId?: string;
  status: RsvpStatus;
  ticketStatus: TicketStatus;
  updatedAt?: string;
}

export interface ActiveMovieNightResponse {
  movieNight: MovieNight;
  showtimes: Showtime[];
  currentUserVote: Vote | null;
  currentUserRsvp: Rsvp | null;
  currentUserRole?: ClubRole;
}

export interface AttendanceMember {
  userId: string;
  name: string;
  email: string;
  role: ClubRole;
  rsvpStatus: RsvpStatus | "pending";
  ticketStatus: TicketStatus;
  updatedAt?: string;
}

export interface AttendanceResponse {
  summary: {
    totalMembers: number;
    going: number;
    maybe: number;
    notGoing: number;
    pending: number;
    purchased: number;
    notPurchased: number;
  };
  members: AttendanceMember[];
}

export interface HistoryMovieNight extends MovieNight {
  attendanceCount?: number;
  resultSummary?: string;
}

export interface ApiErrorBody {
  error?: string;
  message?: string;
}
