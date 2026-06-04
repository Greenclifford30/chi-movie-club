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
}

export interface MovieNight {
  clubId: string;
  movieNightId: string;
  status: MovieNightStatus;
  movieSelectionMode?: "admin_selected" | "group_vote";
  movie: MovieSnapshot;
  targetDate?: string;
  votingClosesAt?: string;
  confirmedShowtimeId?: string;
  confirmedShowtime?: Showtime;
  createdAt?: string;
  updatedAt?: string;
}

export interface Showtime {
  movieNightId: string;
  showtimeId: string;
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
}

export interface HistoryMovieNight extends MovieNight {
  attendanceCount?: number;
  resultSummary?: string;
}

export interface ApiErrorBody {
  error?: string;
  message?: string;
}
