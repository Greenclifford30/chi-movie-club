"use client";

import {
  CalendarClock,
  Check,
  CheckCircle2,
  Clapperboard,
  ClipboardCheck,
  Clock,
  Film,
  Loader2,
  MapPin,
  RefreshCcw,
  Search,
  ShieldCheck,
  Ticket,
  Vote,
} from "lucide-react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AdminStepCard } from "@/components/movie-club/admin-step-card";
import { AppShell } from "@/components/movie-club/app-shell";
import { ConfirmedPlanCard } from "@/components/movie-club/confirmed-plan-card";
import { EmptyState } from "@/components/movie-club/empty-state";
import { ShowtimeCard } from "@/components/movie-club/showtime-card";
import { StatusAlert } from "@/components/movie-club/status-alert";
import {
  DEFAULT_PLANNING_RADIUS,
  DEFAULT_PLANNING_ZIP,
  PlanningPreferencesFields,
  validatePlanningLocation,
} from "@/components/movie-club/planning-preferences-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import {
  addShowtimes,
  approveBulkShowtimeCandidates,
  approveShowtimeCandidate,
  completeMovieNight,
  closeVoting,
  confirmShowtime,
  createMovieNight,
  discoverMovies,
  getActiveMovieNight,
  getAttendance,
  getUserPlanningPreferences,
  getVoteResults,
  importShowtimesForMovieNight,
  listClubInvites,
  MovieClubApiError,
  openVoting,
  refreshGracenote,
  rejectShowtimeCandidate,
  searchGracenoteShowtimes,
  searchMovies,
  updateMovieNightPlanning,
  updateMovieNightSetup,
} from "@/lib/movie-club-api";
import { formatDate, formatTime, posterUrl, showtimeDateTime, showtimeLabel } from "@/lib/movie-club-format";
import type { ActiveMovieNightResponse, AttendanceResponse, CachedShowtime, ClubInvite, MovieDiscoveryResult, MovieNightPlanningInput, MovieNightStatus, MovieSnapshot, Showtime, VoteResults } from "@/lib/movie-club-types";

type ActionState = "idle" | "saving" | "saved" | "error";
type LoadState = "idle" | "loading" | "error";
type MetricTone = "default" | "green" | "amber" | "cyan" | "rose";
type GracenoteSearchForm = { zip: string; radius: number; numDays: number; units: "mi" | "km" };
type ShowtimeTimeBucket = "all" | "morning" | "afternoon" | "evening" | "late";
type TheaterLikeShowtime = {
  providerTheaterId?: string;
  theaterName: string;
  theaterLocation?: string;
};
type TheaterShowtimeGroup<T extends TheaterLikeShowtime> = {
  key: string;
  theaterName: string;
  theaterLocation?: string;
  showtimes: T[];
};

const progressSteps = [
  { label: "Movie", icon: Clapperboard },
  { label: "Planning", icon: CalendarClock },
  { label: "Showtimes", icon: Ticket },
  { label: "Voting", icon: Vote },
  { label: "Results", icon: ClipboardCheck },
  { label: "Confirm", icon: ShieldCheck },
];

const showtimeTimeBuckets: { value: ShowtimeTimeBucket; label: string }[] = [
  { value: "all", label: "All" },
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "late", label: "Late" },
];

export default function ClubAdminPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [active, setActive] = useState<ActiveMovieNightResponse | null>(null);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(true);
  const [attendance, setAttendance] = useState<AttendanceResponse | null>(null);
  const [invites, setInvites] = useState<ClubInvite[]>([]);
  const [inviteEmails, setInviteEmails] = useState("");
  const [results, setResults] = useState<VoteResults | null>(null);
  const [movies, setMovies] = useState<MovieSnapshot[]>([]);
  const [nowPlayingMovies, setNowPlayingMovies] = useState<MovieSnapshot[]>([]);
  const [movieDiscoveryMode, setMovieDiscoveryMode] = useState<"now-playing" | "coming-soon">("now-playing");
  const [isNowPlayingLoading, setIsNowPlayingLoading] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<MovieSnapshot | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [targetDate, setTargetDate] = useState(today);
  const [planningForm, setPlanningForm] = useState<MovieNightPlanningInput>({
    targetDate: today,
    dateWindowStart: today,
    dateWindowEnd: today,
    zipCode: DEFAULT_PLANNING_ZIP,
    radiusMiles: DEFAULT_PLANNING_RADIUS,
    timezone: "America/Chicago",
    preferredFormats: [],
    preferredTheaterIds: [],
  });
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [candidateDateFilter, setCandidateDateFilter] = useState("all");
  const [candidateTheaterFilter, setCandidateTheaterFilter] = useState("all");
  const [candidateFormatFilter, setCandidateFormatFilter] = useState("all");
  const [refreshForm, setRefreshForm] = useState<GracenoteSearchForm>({ zip: DEFAULT_PLANNING_ZIP, radius: DEFAULT_PLANNING_RADIUS, numDays: 14, units: "mi" });
  const [usesAccountDefaults, setUsesAccountDefaults] = useState(false);
  const [cachedShowtimes, setCachedShowtimes] = useState<CachedShowtime[]>([]);
  const [selectedCachedKeys, setSelectedCachedKeys] = useState<string[]>([]);
  const [selectedShowtimeDate, setSelectedShowtimeDate] = useState("all");
  const [showtimeTimeBucket, setShowtimeTimeBucket] = useState<ShowtimeTimeBucket>("all");
  const [gracenoteState, setGracenoteState] = useState<LoadState>("idle");
  const [createState, setCreateState] = useState<ActionState>("idle");
  const [movieSearchState, setMovieSearchState] = useState<ActionState>("idle");
  const [refreshState, setRefreshState] = useState<ActionState>("idle");
  const [importState, setImportState] = useState<ActionState>("idle");
  const [planningState, setPlanningState] = useState<ActionState>("idle");
  const [candidateState, setCandidateState] = useState<ActionState>("idle");
  const [votingState, setVotingState] = useState<ActionState>("idle");
  const [votingClosesAt, setVotingClosesAt] = useState("");
  const [inviteState, setInviteState] = useState<ActionState>("idle");
  const [confirmState, setConfirmState] = useState<ActionState>("idle");
  const [completeState, setCompleteState] = useState<ActionState>("idle");
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadActive() {
    if (!token) {
      return;
    }
    try {
      const nextActive = await getActiveMovieNight(token, clubId);
      setActive(nextActive);
      if (nextActive.currentUserRole && nextActive.currentUserRole !== "admin") {
        router.replace(`/clubs/${encodeURIComponent(clubId)}`);
        return;
      }
      setSelectedMovie(nextActive.movieNight.movie);
      setTargetDate(nextActive.movieNight.targetDate || today);
      setPlanningForm({
        targetDate: nextActive.movieNight.targetDate || today,
        dateWindowStart: nextActive.movieNight.dateWindowStart || nextActive.movieNight.targetDate || today,
        dateWindowEnd: nextActive.movieNight.dateWindowEnd || nextActive.movieNight.targetDate || today,
        zipCode: nextActive.movieNight.zipCode || DEFAULT_PLANNING_ZIP,
        radiusMiles: nextActive.movieNight.radiusMiles || DEFAULT_PLANNING_RADIUS,
        timezone: nextActive.movieNight.timezone || "America/Chicago",
        preferredFormats: nextActive.movieNight.preferredFormats || [],
        preferredTheaterIds: nextActive.movieNight.preferredTheaterIds || [],
      });
      setUsesAccountDefaults(false);
      setVotingClosesAt(nextActive.movieNight.votingClosesAt ? toLocalDateTimeInput(nextActive.movieNight.votingClosesAt) : defaultVotingDeadline(nextActive.movieNight.targetDate || today));
      if (
        nextActive.showtimes.length &&
        (nextActive.movieNight.status === "voting" || nextActive.movieNight.status === "confirmed")
      ) {
        const nextResults = await getVoteResults(token, nextActive.movieNight.movieNightId);
        setResults(nextResults);
      } else {
        setResults(null);
      }
    } catch (activeError) {
      setActive(null);
      setResults(null);
      if (activeError instanceof MovieClubApiError && activeError.status === 404 && token) {
        try {
          const { preferences } = await getUserPlanningPreferences(token);
          setPlanningForm((current) => ({
            ...current,
            zipCode: preferences.defaultZipCode || DEFAULT_PLANNING_ZIP,
            radiusMiles: preferences.defaultRadiusMiles || DEFAULT_PLANNING_RADIUS,
            preferredFormats: preferences.preferredFormats || [],
          }));
          setUsesAccountDefaults(true);
        } catch (preferenceError) {
          setUsesAccountDefaults(true);
          if (!(preferenceError instanceof MovieClubApiError) || preferenceError.status !== 404) {
            setError(preferenceError instanceof Error ? preferenceError.message : "Unable to load planning defaults.");
          }
        }
      } else if (activeError instanceof MovieClubApiError) {
        setError(activeError.message);
      }
    }
  }

  async function loadInvites() {
    if (!token) {
      return;
    }
    try {
      const result = await listClubInvites(token, clubId);
      setInvites(result.invites);
    } catch (inviteError) {
      setInvites([]);
      if (inviteError instanceof MovieClubApiError) {
        setError(inviteError.message);
      }
    }
  }

  async function loadAttendance(movieNightId: string) {
    if (!token) return;
    try {
      setAttendance(await getAttendance(token, movieNightId));
    } catch (attendanceError) {
      setAttendance(null);
      if (!(attendanceError instanceof MovieClubApiError) || attendanceError.status !== 409) {
        setError(attendanceError instanceof Error ? attendanceError.message : "Unable to load attendance.");
      }
    }
  }

  async function loadNowPlaying() {
    if (!token) {
      return;
    }
    setIsNowPlayingLoading(true);
    try {
      const result = await discoverMovies(token, movieDiscoveryMode);
      setNowPlayingMovies(result.results.map(discoveryToMovieSnapshot));
    } catch (nowPlayingError) {
      setNowPlayingMovies([]);
      setError(nowPlayingError instanceof Error ? nowPlayingError.message : "Unable to load movie discovery.");
    } finally {
      setIsNowPlayingLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setIsWorkspaceLoading(true);
    Promise.all([loadActive(), loadInvites()]).finally(() => {
      if (!cancelled) setIsWorkspaceLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, token]);

  useEffect(() => {
    loadNowPlaying();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, token, movieDiscoveryMode]);

  useEffect(() => {
    const movieNight = active?.movieNight;
    if (!movieNight || !["queued", "running"].includes(movieNight.showtimeImportStatus || "")) return;
    const timer = window.setInterval(() => { void loadActive(); }, 3000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.movieNight.movieNightId, active?.movieNight.showtimeImportStatus, token]);

  useEffect(() => {
    if (active?.movieNight.status === "confirmed") void loadAttendance(active.movieNight.movieNightId);
    else setAttendance(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.movieNight.movieNightId, active?.movieNight.status, token]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || searchQuery.trim().length < 2) {
      return;
    }
    setMovieSearchState("saving");
    setError(null);
    setMessage(null);
    try {
      const result = await searchMovies(token, searchQuery.trim());
      setMovies(result.results);
      setMovieSearchState("idle");
      setMessage(result.results.length ? `${result.results.length} movie matches found.` : "No movie matches found. Try a different title.");
    } catch (searchError) {
      setMovieSearchState("error");
      setError(searchError instanceof Error ? searchError.message : "Unable to search movies.");
    }
  }

  async function handleCreateMovieNight() {
    if (!token || !selectedMovie || !targetDate) {
      return;
    }
    if (movieNight && movieNight.status !== "planning" && movieNight.status !== "completed") {
      setError("Movie night setup can only be replaced while it is still in planning.");
      return;
    }
    const validationError = validatePlanningLocation(planningForm.zipCode, planningForm.radiusMiles);
    if (validationError) {
      setError(validationError);
      return;
    }
    setCreateState("saving");
    setError(null);
    setMessage(null);
    try {
      if (movieNight?.status === "planning") {
        await updateMovieNightSetup(token, movieNight.movieNightId, {
          ...planningForm,
          targetDate: planningForm.targetDate || targetDate,
          movie: selectedMovie,
        });
        setCachedShowtimes([]);
        setSelectedCachedKeys([]);
        setSelectedCandidateIds([]);
        setSelectedShowtimeDate("all");
        setShowtimeTimeBucket("all");
      } else {
        await createMovieNight(token, clubId, {
          ...planningForm,
          targetDate: planningForm.targetDate || targetDate,
          movieSelectionMode: "admin_selected",
          movie: selectedMovie,
        });
      }
      setCreateState("saved");
      setMessage(`${selectedMovie.title} is ready for showtime import.`);
      await loadActive();
    } catch (createError) {
      setCreateState("error");
      setError(createError instanceof Error ? createError.message : "Unable to create movie night.");
    }
  }

  async function handleRefreshGracenote() {
    if (!token) {
      return;
    }
    setRefreshState("saving");
    setError(null);
    setMessage(null);
    try {
      const numDays = inclusiveDateCount(planningForm.dateWindowStart, planningForm.dateWindowEnd);
      const searchForm = {
        ...refreshForm,
        zip: planningForm.zipCode,
        radius: planningForm.radiusMiles,
        numDays,
        startDate: planningForm.dateWindowStart,
      };
      await refreshGracenote(token, searchForm);
      setRefreshState("saved");
      setMessage(`Gracenote refresh queued for ${searchForm.zip}, ${searchForm.radius}${searchForm.units}, ${searchForm.numDays} days.`);
    } catch (refreshError) {
      setRefreshState("error");
      setError(refreshError instanceof Error ? refreshError.message : "Unable to queue Gracenote refresh.");
    }
  }

  async function handleSearchGracenote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !movieNight?.movie) {
      setError("Create a movie night before searching cached showtimes.");
      return;
    }

    setGracenoteState("loading");
    setCachedShowtimes([]);
    setSelectedCachedKeys([]);
    setSelectedShowtimeDate("all");
    setShowtimeTimeBucket("all");
    setError(null);
    setMessage(null);
    try {
      const result = await searchGracenoteShowtimes(token, {
        title: movieNight.movie.title,
        provider: movieNight.movie.provider,
        providerMovieId: movieNight.movie.externalId,
        zip: planningForm.zipCode,
        radius: planningForm.radiusMiles,
        numDays: inclusiveDateCount(planningForm.dateWindowStart, planningForm.dateWindowEnd),
        units: refreshForm.units,
        startDate: planningForm.dateWindowStart,
      });
      setCachedShowtimes(result.showtimes);
      setGracenoteState("idle");
      setMessage(
        result.showtimes.length
          ? `${result.showtimes.length} cached showtime${result.showtimes.length === 1 ? "" : "s"} found for ${movieNight.movie.title}.`
          : `No cached showtimes found for ${movieNight.movie.title} in this window. Queue a refresh, then search again.`
      );
    } catch (searchError) {
      setGracenoteState("error");
      setError(searchError instanceof Error ? searchError.message : "Unable to search cached Gracenote showtimes.");
    }
  }

  async function handleImportShowtimes() {
    if (!token || !movieNight || !selectedCachedKeys.length) {
      return;
    }

    const cachedShowtimeKeys = cachedShowtimes
      .filter((showtime) => selectedCachedKeys.includes(cacheKey(showtime)))
      .map((showtime) => ({ PK: showtime.PK, SK: showtime.SK }));

    setImportState("saving");
    setError(null);
    setMessage(null);
    try {
      await addShowtimes(token, movieNight.movieNightId, { cachedShowtimeKeys });
      setImportState("saved");
      setSelectedCachedKeys([]);
      setMessage(`${cachedShowtimeKeys.length} showtime${cachedShowtimeKeys.length === 1 ? "" : "s"} imported for member voting.`);
      await loadActive();
    } catch (importError) {
      setImportState("error");
      setError(importError instanceof Error ? importError.message : "Unable to import selected showtimes.");
    }
  }

  async function handleSavePlanning() {
    if (!token || !movieNight) {
      return;
    }
    if (movieNight.status !== "planning") {
      setError("Planning criteria are locked after voting opens.");
      return;
    }
    const validationError = validatePlanningLocation(planningForm.zipCode, planningForm.radiusMiles);
    if (validationError) {
      setError(validationError);
      return;
    }
    setPlanningState("saving");
    setError(null);
    setMessage(null);
    try {
      await updateMovieNightPlanning(token, movieNight.movieNightId, planningForm);
      setPlanningState("saved");
      setTargetDate(planningForm.targetDate);
      setMessage("Planning criteria saved.");
      await loadActive();
    } catch (planningError) {
      setPlanningState("error");
      setError(planningError instanceof Error ? planningError.message : "Unable to save planning criteria.");
    }
  }

  async function handleBackendImportShowtimes() {
    if (!token || !movieNight) {
      return;
    }
    setImportState("saving");
    setError(null);
    setMessage(null);
    try {
      const result = await importShowtimesForMovieNight(token, movieNight.movieNightId);
      setImportState("saved");
      setMessage(`Showtime import queued for ${result.importJob.requestedDates.length} day${result.importJob.requestedDates.length === 1 ? "" : "s"}. This page will update automatically.`);
      setSelectedCandidateIds([]);
      await loadActive();
    } catch (importError) {
      setImportState("error");
      setError(importError instanceof Error ? importError.message : "Unable to import showtimes.");
    }
  }

  async function handleCandidateStatus(showtimeId: string, status: "approved" | "rejected") {
    if (!token || !movieNight) {
      return;
    }
    setCandidateState("saving");
    setError(null);
    setMessage(null);
    try {
      if (status === "approved") {
        await approveShowtimeCandidate(token, movieNight.movieNightId, showtimeId);
      } else {
        await rejectShowtimeCandidate(token, movieNight.movieNightId, showtimeId);
      }
      setCandidateState("saved");
      setMessage(status === "approved" ? "Showtime approved for voting." : "Showtime rejected.");
      await loadActive();
    } catch (candidateError) {
      setCandidateState("error");
      setError(candidateError instanceof Error ? candidateError.message : "Unable to update showtime candidate.");
    }
  }

  async function handleBulkApproveCandidates() {
    if (!token || !movieNight || !selectedCandidateIds.length) {
      return;
    }
    setCandidateState("saving");
    setError(null);
    setMessage(null);
    try {
      await approveBulkShowtimeCandidates(token, movieNight.movieNightId, selectedCandidateIds);
      setCandidateState("saved");
      setMessage(`${selectedCandidateIds.length} showtime${selectedCandidateIds.length === 1 ? "" : "s"} approved for voting.`);
      setSelectedCandidateIds([]);
      await loadActive();
    } catch (candidateError) {
      setCandidateState("error");
      setError(candidateError instanceof Error ? candidateError.message : "Unable to approve selected showtimes.");
    }
  }

  async function handleOpenVoting() {
    if (!token || !movieNight) {
      return;
    }
    setVotingState("saving");
    setError(null);
    setMessage(null);
    try {
      const closesAt = new Date(votingClosesAt);
      if (!votingClosesAt || Number.isNaN(closesAt.getTime()) || closesAt <= new Date()) {
        setVotingState("error");
        setError("Choose a future voting deadline.");
        return;
      }
      await openVoting(token, movieNight.movieNightId, closesAt.toISOString());
      setVotingState("saved");
      setMessage("Voting is open for approved showtimes.");
      await loadActive();
    } catch (votingError) {
      setVotingState("error");
      setError(votingError instanceof Error ? votingError.message : "Unable to open voting.");
    }
  }

  async function handleCloseVoting() {
    if (!token || !movieNight || !window.confirm("Close voting now? Members will no longer be able to edit ballots.")) return;
    setVotingState("saving");
    setError(null);
    try {
      await closeVoting(token, movieNight.movieNightId);
      setVotingState("saved");
      setMessage("Voting is closed. Review the final standings and confirm a showtime.");
      await loadActive();
    } catch (votingError) {
      setVotingState("error");
      setError(votingError instanceof Error ? votingError.message : "Unable to close voting.");
    }
  }

  function toggleCachedShowtime(showtime: CachedShowtime) {
    const key = cacheKey(showtime);
    setSelectedCachedKeys((current) =>
      current.includes(key) ? current.filter((selectedKey) => selectedKey !== key) : [...current, key]
    );
  }

  function selectAllCachedShowtimes() {
    const visibleKeys = visibleCachedShowtimes.map(cacheKey);
    setSelectedCachedKeys((current) => Array.from(new Set([...current, ...visibleKeys])));
  }

  function clearCachedShowtimes() {
    setSelectedCachedKeys([]);
  }

  async function handleConfirm(showtimeId: string) {
    if (!token || !active?.movieNight) {
      return;
    }
    if (!window.confirm("Confirm this showtime as the final club plan? This cannot be changed from the admin workspace.")) return;
    setConfirmState("saving");
    setError(null);
    setMessage(null);
    try {
      await confirmShowtime(token, active.movieNight.movieNightId, showtimeId);
      setConfirmState("saved");
      setMessage("Final showtime confirmed. Members can RSVP and track tickets now.");
      await loadActive();
    } catch (confirmError) {
      setConfirmState("error");
      setError(confirmError instanceof Error ? confirmError.message : "Unable to confirm showtime.");
    }
  }

  async function handleCompleteMovieNight() {
    if (!token || !active?.movieNight) {
      return;
    }
    if (!window.confirm("Complete this movie night and move it to history?")) return;
    setCompleteState("saving");
    setError(null);
    setMessage(null);
    try {
      await completeMovieNight(token, active.movieNight.movieNightId);
      setCompleteState("saved");
      router.push(`/clubs/${clubId}/history`);
    } catch (completeError) {
      setCompleteState("error");
      setError(completeError instanceof Error ? completeError.message : "Unable to complete movie night.");
    }
  }

  async function handleCreateInvites(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    const emails = normalizeEmails(inviteEmails);
    if (!emails.length) {
      setError("Enter at least one email address.");
      return;
    }

    setInviteState("saving");
    setError(null);
    setMessage(null);
    try {
      const result = await createClubInvites(token, clubId, emails);
      setInvites(result.invites);
      setInviteEmails("");
      setInviteState("saved");
      setMessage(`${emails.length} invite${emails.length === 1 ? "" : "s"} created for this club.`);
      await loadInvites();
    } catch (inviteError) {
      setInviteState("error");
      setError(inviteError instanceof Error ? inviteError.message : "Unable to create invites.");
    }
  }

  async function handleCopyInvite(invite: ClubInvite) {
    if (!invite.inviteUrl) {
      return;
    }
    await navigator.clipboard?.writeText(invite.inviteUrl);
    setCopiedInviteId(invite.inviteId);
    setMessage(`Invite link copied for ${invite.email}.`);
    window.setTimeout(() => setCopiedInviteId(null), 1800);
  }

  const movieNight = active?.movieNight;
  const currentShowtimes = active?.showtimes || [];
  const importedCandidates = currentShowtimes.filter((showtime) => showtime.status === "imported");
  const approvedCandidates = currentShowtimes.filter((showtime) => showtime.status === "approved" || !showtime.status);
  const rejectedCandidateCount = currentShowtimes.filter((showtime) => showtime.status === "rejected").length;
  const candidateCounts = {
    imported: importedCandidates.length,
    approved: approvedCandidates.length,
    rejected: rejectedCandidateCount,
    duplicates: movieNight?.lastShowtimeImportSummary?.duplicateCount || 0,
  };
  const visibleCandidates = filterShowtimeCandidates(
    currentShowtimes,
    candidateDateFilter,
    candidateTheaterFilter,
    candidateFormatFilter
  );
  const visibleCachedShowtimes = useMemo(
    () => filterCachedShowtimes(cachedShowtimes, selectedShowtimeDate, showtimeTimeBucket),
    [cachedShowtimes, selectedShowtimeDate, showtimeTimeBucket]
  );
  const selectedPoster = selectedMovie ? posterUrl(selectedMovie) : "";
  const groupedCurrentShowtimes = groupShowtimesByTheater(currentShowtimes, showtimeDateTime);
  const hasCompletedPointer = movieNight?.status === "completed";
  const canEditSetup = !movieNight || hasCompletedPointer || movieNight.status === "planning";
  const canCreate = Boolean(selectedMovie && targetDate && createState !== "saving" && canEditSetup);
  const setupDescription = !movieNight
    ? "Pick a movie and date to unlock showtime import."
    : hasCompletedPointer
      ? "This club is ready for its next movie night."
      : movieNight.status === "planning"
        ? "This active movie night is still in setup and can be updated before voting opens."
        : "Voting or confirmation has started, so the selected movie is locked.";
  const createButtonLabel = !movieNight || hasCompletedPointer ? "Create movie night" : movieNight.status === "planning" ? "Update active setup" : "Movie locked";
  const statusLabel = formatStatus(movieNight?.status);
  const nextAction = getNextAction({
    hasMovieNight: Boolean(movieNight),
    hasSelectedMovie: Boolean(selectedMovie),
    showtimeCount: approvedCandidates.length,
    status: movieNight?.status,
    resultCount: results?.standings?.length || 0,
  });
  const completedProgress = getCompletedProgress({
    hasMovieNight: Boolean(movieNight),
    hasSelectedMovie: Boolean(selectedMovie),
    showtimeCount: approvedCandidates.length,
    status: movieNight?.status,
    resultCount: results?.standings?.length || 0,
  });

  if (isWorkspaceLoading) {
    return (
      <AppShell>
        <div className="grid min-h-[60vh] place-items-center text-slate-300">
          <div className="flex items-center gap-3"><Loader2 className="size-5 animate-spin text-cyan-300" />Loading admin workspace...</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="mb-6 border-b border-white/10 pb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm text-cyan-300">
                <CalendarClock className="size-4" />
                <span>Club admin workspace</span>
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-white">Manage movie night</h1>
              <p className="mt-2 max-w-2xl text-slate-300">{nextAction}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[32rem]">
              <Metric label="Status" value={statusLabel} tone={statusTone(movieNight?.status)} />
              <Metric label="Selected movie" value={movieNight?.movie.title || selectedMovie?.title || "Choose a movie"} />
              <Metric label="Target date" value={formatDate(movieNight?.targetDate || targetDate)} />
              <Metric label="Showtimes" value={`${candidateCounts.approved} approved`} />
              <Metric label="Theaters" value={`${groupedCurrentShowtimes.length} listed`} />
              <Metric label="Ballots" value={results ? `${results.voteCount} submitted` : "Not open yet"} />
              <Metric label="Voting closes" value={movieNight?.votingClosesAt ? formatDate(movieNight.votingClosesAt) : "Backend controlled"} />
            </div>
          </div>
        </section>

        <ProgressStrip completedCount={completedProgress} />

        {error ? <StatusAlert tone="danger" className="mb-4">{error}</StatusAlert> : null}
        {message ? <StatusAlert tone="success" className="mb-4">{message}</StatusAlert> : null}

        <AdminStepCard
          step="Step 1"
          title="Movie"
          description="Choose the title members will vote showtimes for. Discovery supports theatrical releases and upcoming movies."
          status={movieNight || selectedMovie ? "complete" : "current"}
          className="mb-6"
        >
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <FilterChip isActive={movieDiscoveryMode === "now-playing"} onClick={() => setMovieDiscoveryMode("now-playing")}>
                Now Playing
              </FilterChip>
              <FilterChip isActive={movieDiscoveryMode === "coming-soon"} onClick={() => setMovieDiscoveryMode("coming-soon")}>
                Coming Soon
              </FilterChip>
            </div>
            <span className="text-sm text-slate-500">{nowPlayingMovies.length} discovered</span>
          </div>
            {isNowPlayingLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="size-4 animate-spin" />
                Loading current theatrical releases...
              </div>
            ) : (
              <MovieGrid movies={nowPlayingMovies} selectedMovie={selectedMovie} onSelect={canEditSetup ? setSelectedMovie : undefined} emptyText="No now-playing movies loaded yet. Use search or try again shortly." compact />
            )}
        </AdminStepCard>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="space-y-6 lg:col-span-8">
            <PlanningPanel
              form={planningForm}
              hasMovieNight={Boolean(movieNight)}
              isSaving={planningState === "saving"}
              canEdit={Boolean(movieNight?.status === "planning")}
              onChange={setPlanningForm}
              onSave={handleSavePlanning}
              usesAccountDefaults={usesAccountDefaults && !movieNight}
            />

            <CandidateShowtimesPanel
              counts={candidateCounts}
              filters={{
                date: candidateDateFilter,
                theater: candidateTheaterFilter,
                format: candidateFormatFilter,
              }}
              importState={importState}
              isCandidateSaving={candidateState === "saving"}
              movieNight={movieNight}
              onBulkApprove={handleBulkApproveCandidates}
              onFilterChange={(nextFilters) => {
                setCandidateDateFilter(nextFilters.date);
                setCandidateTheaterFilter(nextFilters.theater);
                setCandidateFormatFilter(nextFilters.format);
              }}
              onImport={handleBackendImportShowtimes}
              onStatusChange={handleCandidateStatus}
              onToggleSelected={(showtimeId) =>
                setSelectedCandidateIds((current) =>
                  current.includes(showtimeId)
                    ? current.filter((candidateId) => candidateId !== showtimeId)
                    : [...current, showtimeId]
                )
              }
              selectedIds={selectedCandidateIds}
              showtimes={currentShowtimes}
              visibleShowtimes={visibleCandidates}
            />

            <AdminShowtimes showtimes={approvedCandidates} />
          </section>

          <aside className="space-y-6 lg:col-span-4">
            <Card className="border-violet-400/20 bg-slate-900/90 py-6 shadow-2xl shadow-violet-950/20">
              <CardHeader>
                <h2 className="font-semibold text-white">Movie night setup</h2>
                <p className="text-sm text-slate-400">{setupDescription}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedMovie ? (
                  <div className="flex gap-3">
                    <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded bg-slate-950">
                      {selectedPoster ? (
                        <Image src={selectedPoster} alt={selectedMovie.title} fill sizes="80px" className="object-cover" />
                      ) : (
                        <div className="grid h-full place-items-center text-slate-500">
                          <Film className="size-8" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-white">{selectedMovie.title}</p>
                      <p className="mt-1 text-sm text-slate-400">{selectedMovie.releaseYear || selectedMovie.releaseDate || "Release date TBD"}</p>
                      {selectedMovie.overview ? <p className="mt-2 line-clamp-3 text-sm text-slate-300">{selectedMovie.overview}</p> : null}
                    </div>
                  </div>
                ) : (
                  <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-400">
                    Select a now-playing title above, or search the movie catalog below.
                  </p>
                )}
                <Field label="Target date">
                  <Input
                    type="date"
                    value={planningForm.targetDate}
                    onChange={(event) => {
                      setTargetDate(event.target.value);
                      setPlanningForm((current) => ({
                        ...current,
                        targetDate: event.target.value,
                        dateWindowStart: current.dateWindowStart || event.target.value,
                        dateWindowEnd: current.dateWindowEnd || event.target.value,
                      }));
                    }}
                    className="border-white/10 bg-white/5 text-white"
                  />
                </Field>
                <Button onClick={handleCreateMovieNight} disabled={!canCreate} className="w-full bg-violet-500 text-white hover:bg-violet-600">
                  {createState === "saving" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  {createButtonLabel}
                </Button>
              </CardContent>
            </Card>

            {movieNight?.status === "confirmed" ? (
              <Card className="border-green-400/20 bg-slate-900/80 py-6 shadow-2xl shadow-green-950/10">
                <CardHeader>
                  <h2 className="font-semibold text-white">End event</h2>
                  <p className="text-sm text-slate-400">
                    {canComplete
                      ? "The confirmed showtime has passed. End this event to save it to club history."
                      : "RSVP remains open until the confirmed showtime has passed."}
                  </p>
                </CardHeader>
                <CardContent>
                  {confirmedShowtime ? (
                    <p className="mb-4 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
                      {formatDate(showtimeDateTime(confirmedShowtime))} at {formatTime(showtimeDateTime(confirmedShowtime))}
                    </p>
                  ) : (
                    <p className="mb-4 rounded-lg border border-amber-300/20 bg-amber-400/10 p-3 text-sm text-amber-100">
                      A confirmed showtime is required before this event can be ended.
                    </p>
                  )}
                  <Button
                    type="button"
                    onClick={handleCompleteMovieNight}
                    disabled={!canComplete || completeState === "saving"}
                    className="w-full bg-green-500 text-slate-950 hover:bg-green-400"
                  >
                    {completeState === "saving" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                    End event
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            <Card className="border-white/10 bg-slate-900/80 py-6 shadow-2xl shadow-black/20">
              <CardHeader>
                <h2 className="font-semibold text-white">Movie search</h2>
                <p className="text-sm text-slate-400">Use catalog search when a title is missing from now playing.</p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSearch} className="flex flex-col gap-3">
                  <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search by movie title" className="border-white/10 bg-white/5 text-white" />
                  <Button type="submit" disabled={movieSearchState === "saving" || searchQuery.trim().length < 2} className="bg-violet-500 text-white hover:bg-violet-600">
                    {movieSearchState === "saving" ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                    Search movies
                  </Button>
                </form>
                <div className="mt-5">
                  <MovieGrid movies={movies} selectedMovie={selectedMovie} onSelect={canEditSetup ? setSelectedMovie : undefined} emptyText="Search results will appear here." compact />
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-900/80 py-6">
              <CardHeader>
                <h2 className="font-semibold text-white">Club members</h2>
                <p className="text-sm text-slate-400">Add existing platform users to this club as friends.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleAddMembers} className="space-y-3">
                  <Field label="Platform user emails">
                    <textarea
                      value={memberEmails}
                      onChange={(event) => setMemberEmails(event.target.value)}
                      placeholder="signed-in-user@example.com, friend@example.com"
                      className="min-h-24 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    />
                  </Field>
                  <Button type="submit" disabled={memberState === "saving" || !memberEmails.trim()} className="w-full bg-violet-500 text-white hover:bg-violet-600">
                    {memberState === "saving" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                    Add as friends
                  </Button>
                </form>
                <MemberList members={addedMembers} />
              </CardContent>
            </Card>

            {movieNight?.status === "confirmed" && movieNight.confirmedShowtime ? (
              <ConfirmedPlanCard showtime={movieNight.confirmedShowtime} />
            ) : null}
            <VotingControlCard
              movieNight={movieNight}
              showtimeCount={approvedCandidates.length}
              voteCount={results?.voteCount || 0}
              isSaving={votingState === "saving"}
              votingClosesAt={votingClosesAt}
              onVotingClosesAtChange={setVotingClosesAt}
              onCloseVoting={handleCloseVoting}
              onOpenVoting={handleOpenVoting}
            />
            <AdminResults
              results={results}
              onConfirm={handleConfirm}
              isSaving={confirmState === "saving"}
              canConfirm={Boolean(movieNight && movieNight.status === "voting" && isVotingClosed(movieNight))}
            />
            <AttendanceSummaryCard status={movieNight?.status} attendance={attendance} />
            {movieNight?.status === "confirmed" ? (
              <CompleteMovieNightCard
                movieTitle={movieNight.movie.title}
                isSaving={completeState === "saving"}
                onComplete={handleCompleteMovieNight}
              />
            ) : null}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function ProgressStrip({ completedCount }: { completedCount: number }) {
  return (
    <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
      {progressSteps.map((step, index) => {
        const Icon = step.icon;
        const isDone = index < completedCount;
        const isCurrent = index === completedCount;
        return (
          <div
            key={step.label}
            className={`rounded-lg border p-4 transition ${
              isDone
                ? "border-green-400/30 bg-green-500/10 text-green-100"
                : isCurrent
                  ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-100"
                  : "border-white/10 bg-slate-900/60 text-slate-400"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <Icon className="size-5" />
              <span className="font-mono text-xs opacity-70">0{index + 1}</span>
            </div>
            <p className="mt-4 font-semibold">{step.label}</p>
            <p className="mt-1 text-xs opacity-75">{isDone ? "Complete" : isCurrent ? "Next up" : "Waiting"}</p>
          </div>
        );
      })}
    </section>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: MetricTone }) {
  const toneClasses: Record<MetricTone, string> = {
    default: "text-white",
    green: "text-green-200",
    amber: "text-amber-200",
    cyan: "text-cyan-200",
    rose: "text-rose-200",
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 truncate text-sm font-semibold ${toneClasses[tone]}`}>{value}</p>
    </div>
  );
}

function MovieGrid({
  movies,
  selectedMovie,
  onSelect,
  emptyText,
  compact = false,
}: {
  movies: MovieSnapshot[];
  selectedMovie: MovieSnapshot | null;
  onSelect?: (movie: MovieSnapshot) => void;
  emptyText: string;
  compact?: boolean;
}) {
  if (!movies.length) {
    return <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-400">{emptyText}</p>;
  }

  return (
    <div className={compact ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-4" : "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"}>
      {movies.map((movie) => {
        const image = posterUrl(movie);
        const activeMovie = selectedMovie?.provider === movie.provider && selectedMovie?.externalId === movie.externalId;
        return (
          <button
            key={`${movie.provider}-${movie.externalId}`}
            type="button"
            onClick={() => onSelect?.(movie)}
            disabled={!onSelect}
            className={`overflow-hidden rounded-lg border bg-white/5 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${activeMovie ? "border-cyan-300/60 bg-cyan-400/10" : "border-white/10 hover:border-white/25 hover:bg-white/10"}`}
          >
            <div className={`relative bg-slate-950 ${compact ? "h-32" : "h-64"}`}>
              {image ? (
                <Image src={image} alt={movie.title} fill sizes={compact ? "180px" : "240px"} className="object-cover" />
              ) : (
                <div className="grid h-full place-items-center text-slate-500">
                  <Film className="size-10" />
                </div>
              )}
            </div>
            <div className="p-3">
              <p className={`font-semibold text-white ${compact ? "line-clamp-2 text-sm" : ""}`}>{movie.title}</p>
              <p className="mt-1 text-sm text-slate-400">{movie.releaseYear || movie.releaseDate || "Release date TBD"}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PlanningPanel({
  canEdit,
  form,
  hasMovieNight,
  isSaving,
  onChange,
  onSave,
  usesAccountDefaults,
}: {
  canEdit: boolean;
  form: MovieNightPlanningInput;
  hasMovieNight: boolean;
  isSaving: boolean;
  onChange: (form: MovieNightPlanningInput) => void;
  onSave: () => void;
  usesAccountDefaults: boolean;
}) {
  return (
    <AdminStepCard
      step="Step 2"
      title="Planning"
      description="Save the reusable criteria the backend uses for multi-day showtime imports."
      status={canEdit ? "current" : hasMovieNight ? "complete" : "blocked"}
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Target date">
            <Input type="date" value={form.targetDate} onChange={(event) => onChange({ ...form, targetDate: event.target.value })} className="border-white/10 bg-white/5 text-white" />
          </Field>
          <Field label="Window start">
            <Input type="date" value={form.dateWindowStart} onChange={(event) => onChange({ ...form, dateWindowStart: event.target.value })} className="border-white/10 bg-white/5 text-white" />
          </Field>
          <Field label="Window end">
            <Input type="date" value={form.dateWindowEnd} onChange={(event) => onChange({ ...form, dateWindowEnd: event.target.value })} className="border-white/10 bg-white/5 text-white" />
          </Field>
        </div>
        {usesAccountDefaults ? (
          <StatusAlert tone="info">Started from your account defaults. Changes here apply only to this movie night.</StatusAlert>
        ) : null}
        <PlanningPreferencesFields
          zipCode={form.zipCode}
          radiusMiles={form.radiusMiles}
          preferredFormats={form.preferredFormats || []}
          onZipCodeChange={(zipCode) => onChange({ ...form, zipCode })}
          onRadiusMilesChange={(radiusMiles) => onChange({ ...form, radiusMiles })}
          onPreferredFormatsChange={(preferredFormats) => onChange({ ...form, preferredFormats })}
          disabled={!canEdit && hasMovieNight}
        />
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <Field label="Timezone">
            <Input value={form.timezone || "America/Chicago"} onChange={(event) => onChange({ ...form, timezone: event.target.value })} className="border-white/10 bg-white/5 text-white" />
          </Field>
          <Button onClick={onSave} disabled={!canEdit || isSaving} className="bg-violet-500 text-white hover:bg-violet-600">
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Save planning
          </Button>
        </div>
        {!hasMovieNight ? (
          <StatusAlert tone="warning">Create the movie night first, then save planning updates and import showtimes.</StatusAlert>
        ) : !canEdit ? (
          <StatusAlert tone="warning">Planning criteria are locked after voting opens.</StatusAlert>
        ) : null}
      </div>
    </AdminStepCard>
  );
}

function CandidateShowtimesPanel({
  counts,
  filters,
  importState,
  isCandidateSaving,
  movieNight,
  onBulkApprove,
  onFilterChange,
  onImport,
  onStatusChange,
  onToggleSelected,
  selectedIds,
  showtimes,
  visibleShowtimes,
}: {
  counts: { imported: number; approved: number; rejected: number; duplicates: number };
  filters: { date: string; theater: string; format: string };
  importState: ActionState;
  isCandidateSaving: boolean;
  movieNight?: ActiveMovieNightResponse["movieNight"];
  onBulkApprove: () => void;
  onFilterChange: (filters: { date: string; theater: string; format: string }) => void;
  onImport: () => void;
  onStatusChange: (showtimeId: string, status: "approved" | "rejected") => void;
  onToggleSelected: (showtimeId: string) => void;
  selectedIds: string[];
  showtimes: Showtime[];
  visibleShowtimes: Showtime[];
}) {
  const dates = getAvailableCandidateValues(showtimes, (showtime) => showtime.localDate || getShowtimeDateKey(showtimeDateTime(showtime)));
  const theaters = getAvailableCandidateValues(showtimes, (showtime) => showtime.theaterName);
  const formats = getAvailableCandidateValues(showtimes, (showtime) => showtime.screenFormat || "Standard");
  const groupedShowtimes = groupShowtimesByTheater(visibleShowtimes, showtimeDateTime);
  const summary = movieNight?.lastShowtimeImportSummary;
  const importInProgress = ["queued", "running"].includes(movieNight?.showtimeImportStatus || "");

  return (
    <AdminStepCard
      step="Step 3"
      title="Showtimes"
      description="Import candidates from the saved planning window, then approve only the options members should rank."
      status={counts.approved ? "complete" : movieNight ? "current" : "blocked"}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-2 text-center text-xs md:grid-cols-4">
          <MiniStat value={`${counts.imported}`} label="imported" />
          <MiniStat value={`${counts.approved}`} label="approved" tone="green" />
          <MiniStat value={`${counts.rejected}`} label="rejected" />
          <MiniStat value={`${counts.duplicates}`} label="duplicates" tone="cyan" />
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-white">Backend import</p>
              <p className="mt-1 text-sm text-slate-400">
                Uses {movieNight?.dateWindowStart || "start TBD"} through {movieNight?.dateWindowEnd || "end TBD"} near {movieNight?.zipCode || "ZIP TBD"}.
              </p>
            </div>
            <Button onClick={onImport} disabled={!movieNight || importState === "saving" || importInProgress} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
              {importState === "saving" || importInProgress ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
              {importInProgress ? "Import in progress" : "Import showtimes"}
            </Button>
          </div>
          {summary?.requestedDates?.length ? (
            <p className="mt-3 text-xs text-slate-500">
              Last import checked {summary.requestedDates.join(", ")} and skipped {summary.duplicateCount || 0} duplicate{summary.duplicateCount === 1 ? "" : "s"}.
            </p>
          ) : null}
          {movieNight?.showtimeImportStatus === "failed" ? (
            <StatusAlert tone="danger" className="mt-3">{summary?.errorMessage || "The provider import failed. Try again shortly."}</StatusAlert>
          ) : null}
        </div>

        {showtimes.length ? (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Date">
                <NativeSelect value={filters.date} onChange={(value) => onFilterChange({ ...filters, date: value })} options={["all", ...dates]} />
              </Field>
              <Field label="Theater">
                <NativeSelect value={filters.theater} onChange={(value) => onFilterChange({ ...filters, theater: value })} options={["all", ...theaters]} />
              </Field>
              <Field label="Format">
                <NativeSelect value={filters.format} onChange={(value) => onFilterChange({ ...filters, format: value })} options={["all", ...formats]} />
              </Field>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/5 p-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-slate-300">{visibleShowtimes.length} visible / {selectedIds.length} selected</span>
              <Button type="button" size="sm" onClick={onBulkApprove} disabled={!selectedIds.length || isCandidateSaving} className="bg-green-500 text-slate-950 hover:bg-green-400">
                {isCandidateSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Approve selected
              </Button>
            </div>

            <div className="space-y-4">
              {groupedShowtimes.map((group) => (
                <TheaterShowtimeSection key={group.key} group={group}>
                  <div className="grid gap-3 md:grid-cols-2">
                    {group.showtimes.map((showtime) => {
                      const selected = selectedIds.includes(showtime.showtimeId);
                      return (
                        <div key={showtime.showtimeId} className="rounded-lg border border-white/10 bg-white/5 p-3">
                          <button type="button" onClick={() => onToggleSelected(showtime.showtimeId)} className="w-full text-left">
                            <ShowtimeCardBody checked={selected} dateTime={showtimeDateTime(showtime)} screenFormat={showtime.screenFormat} ticketURI={showtime.ticketURI} />
                          </button>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <span className={`rounded px-2 py-1 text-xs ${showtime.status === "approved" ? "bg-green-400/10 text-green-100" : showtime.status === "rejected" ? "bg-rose-400/10 text-rose-100" : "bg-amber-400/10 text-amber-100"}`}>
                              {showtime.status || "approved"}
                            </span>
                            <div className="flex gap-2">
                              <Button type="button" size="sm" variant="outline" onClick={() => onStatusChange(showtime.showtimeId, "approved")} disabled={isCandidateSaving || showtime.status === "approved"} className="border-white/10 text-slate-100 hover:bg-white/10">
                                Approve
                              </Button>
                              <Button type="button" size="sm" variant="ghost" onClick={() => onStatusChange(showtime.showtimeId, "rejected")} disabled={isCandidateSaving || showtime.status === "rejected"} className="text-rose-100 hover:bg-rose-400/10">
                                Reject
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TheaterShowtimeSection>
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            title="No imported candidates"
            description="Save planning criteria, then import showtimes. The backend will fetch each date in the saved window."
            className="bg-white/5"
          />
        )}
      </div>
    </AdminStepCard>
  );
}

function NativeSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-full rounded-md border border-white/10 bg-slate-950 px-3 text-sm text-white outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option === "all" ? "All" : option}
        </option>
      ))}
    </select>
  );
}

function GracenoteImportPanel({
  cachedShowtimes,
  form,
  gracenoteState,
  importState,
  importedCount,
  movieNightExists,
  onClearSelection,
  onImport,
  onRefresh,
  onSearch,
  onSelectAll,
  onSelectedDateChange,
  onTimeBucketChange,
  onToggle,
  refreshState,
  selectedDate,
  selectedKeys,
  setForm,
  timeBucket,
  visibleShowtimes,
}: {
  cachedShowtimes: CachedShowtime[];
  form: { zip: string; radius: number; numDays: number; units: "mi" | "km" };
  gracenoteState: LoadState;
  importState: ActionState;
  importedCount: number;
  movieNightExists: boolean;
  onClearSelection: () => void;
  onImport: () => void;
  onRefresh: () => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onSelectAll: () => void;
  onSelectedDateChange: (date: string) => void;
  onTimeBucketChange: (bucket: ShowtimeTimeBucket) => void;
  onToggle: (showtime: CachedShowtime) => void;
  refreshState: ActionState;
  selectedDate: string;
  selectedKeys: string[];
  setForm: (form: { zip: string; radius: number; numDays: number; units: "mi" | "km" }) => void;
  timeBucket: ShowtimeTimeBucket;
  visibleShowtimes: CachedShowtime[];
}) {
  const selectedCount = selectedKeys.length;
  const availableDates = getAvailableShowtimeDates(cachedShowtimes);
  const groupedShowtimes = groupShowtimesByTheater(visibleShowtimes, cachedShowtimeDateTime);
  const visibleKeys = visibleShowtimes.map(cacheKey);
  const visibleSelectedCount = visibleKeys.filter((key) => selectedKeys.includes(key)).length;
  const hiddenSelectedCount = selectedCount - visibleSelectedCount;
  const hasActiveFilters = selectedDate !== "all" || timeBucket !== "all";
  const allVisibleSelected = Boolean(visibleShowtimes.length) && visibleSelectedCount === visibleShowtimes.length;

  return (
    <AdminStepCard
      step="Step 2"
      title="Showtimes"
      description="Refresh provider data, search the local cache, then choose the showtimes members can rank."
      status={importedCount ? "complete" : movieNightExists ? "current" : "blocked"}
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid grid-cols-3 gap-2 text-center text-xs sm:min-w-72">
            <MiniStat value={`${cachedShowtimes.length}`} label="cached" />
            <MiniStat value={`${selectedCount}`} label="selected" tone="cyan" />
            <MiniStat value={`${importedCount}`} label="imported" tone="green" />
          </div>
        </div>

        <form onSubmit={onSearch} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="ZIP">
              <Input value={form.zip} onChange={(event) => setForm({ ...form, zip: event.target.value })} className="border-white/10 bg-white/5 text-white" />
            </Field>
            <Field label={`Radius (${form.units})`}>
              <Input type="number" min={1} value={form.radius} onChange={(event) => setForm({ ...form, radius: Number(event.target.value) })} className="border-white/10 bg-white/5 text-white" />
            </Field>
            <Field label="Days">
              <Input type="number" min={1} value={form.numDays} onChange={(event) => setForm({ ...form, numDays: Number(event.target.value) })} className="border-white/10 bg-white/5 text-white" />
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <ActionPanel
              title="1. Queue fresh showtimes"
              description="Ask Gracenote to refresh the cache for this area. This can run before you search."
              icon={<RefreshCcw className="size-4" />}
              disabled={!movieNightExists || refreshState === "saving"}
              isLoading={refreshState === "saving"}
              onClick={onRefresh}
              buttonText="Queue refresh"
              tone="cyan"
            />
            <ActionPanel
              title="2. Search cached matches"
              description="Find cached showtimes for the selected movie and current search window."
              icon={<Search className="size-4" />}
              disabled={!movieNightExists || gracenoteState === "loading"}
              isLoading={gracenoteState === "loading"}
              type="submit"
              buttonText="Search cache"
              tone="violet"
            />
          </div>
        </form>

        {!movieNightExists ? (
          <p className="rounded-lg border border-amber-300/20 bg-amber-400/10 p-3 text-sm text-amber-100">
            Create a movie night before importing showtimes. The import will use that movie title and provider ID.
          </p>
        ) : cachedShowtimes.length ? (
          <div className="space-y-3">
            <div className="space-y-3 rounded-lg border border-white/10 bg-slate-950/30 p-3">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase text-slate-500">Date</p>
                <div className="flex flex-wrap gap-2">
                  <FilterChip isActive={selectedDate === "all"} onClick={() => onSelectedDateChange("all")}>
                    All dates
                  </FilterChip>
                  {availableDates.map((date) => (
                    <FilterChip key={date} isActive={selectedDate === date} onClick={() => onSelectedDateChange(date)}>
                      {formatShowtimeDateChip(date)}
                    </FilterChip>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase text-slate-500">Time</p>
                <div className="flex flex-wrap gap-2">
                  {showtimeTimeBuckets.map((bucket) => (
                    <FilterChip key={bucket.value} isActive={timeBucket === bucket.value} onClick={() => onTimeBucketChange(bucket.value)}>
                      {bucket.label}
                    </FilterChip>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/5 p-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-slate-300">
                {hasActiveFilters
                  ? `${visibleShowtimes.length} of ${cachedShowtimes.length} cached showtime${cachedShowtimes.length === 1 ? "" : "s"} visible`
                  : `${cachedShowtimes.length} cached showtime${cachedShowtimes.length === 1 ? "" : "s"}`}{" "}
                across {groupedShowtimes.length} theater{groupedShowtimes.length === 1 ? "" : "s"}
                {hiddenSelectedCount > 0 ? ` / ${hiddenSelectedCount} selected hidden by filters` : ""}
              </span>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={onSelectAll} disabled={allVisibleSelected || !visibleShowtimes.length} className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10">
                  Select all visible
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={onClearSelection} disabled={!selectedCount} className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10">
                  Clear selected
                </Button>
              </div>
            </div>

            {visibleShowtimes.length ? (
              <div className="max-h-[34rem] space-y-4 overflow-y-auto pr-1">
                {groupedShowtimes.map((group) => (
                  <TheaterShowtimeSection key={group.key} group={group}>
                    <div className="grid gap-2 md:grid-cols-2">
                      {group.showtimes.map((showtime) => {
                        const key = cacheKey(showtime);
                        const dateTime = cachedShowtimeDateTime(showtime);
                        const isSelected = selectedKeys.includes(key);
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => onToggle(showtime)}
                            className={`w-full rounded-lg border p-3 text-left transition ${isSelected ? "border-cyan-300/60 bg-cyan-400/10" : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10"}`}
                          >
                            <ShowtimeCardBody checked={isSelected} dateTime={dateTime} screenFormat={showtime.screenFormat} ticketURI={showtime.ticketURI} />
                          </button>
                        );
                      })}
                    </div>
                  </TheaterShowtimeSection>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-400">
                No cached showtimes match these date and time filters. Adjust the filters above to show more options.
              </p>
            )}
            <Button onClick={onImport} disabled={!selectedCount || importState === "saving"} className="w-full bg-green-500 text-slate-950 hover:bg-green-400">
              {importState === "saving" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Import {selectedCount || ""} selected showtime{selectedCount === 1 ? "" : "s"}
            </Button>
          </div>
        ) : (
          <EmptyState
            title="No cached showtimes loaded"
            description="Queue a refresh if needed, then search the cache for this movie."
            className="bg-white/5"
          />
        )}
      </div>
    </AdminStepCard>
  );
}

function ActionPanel({
  title,
  description,
  buttonText,
  disabled,
  icon,
  isLoading,
  onClick,
  tone,
  type = "button",
}: {
  title: string;
  description: string;
  buttonText: string;
  disabled: boolean;
  icon: React.ReactNode;
  isLoading: boolean;
  onClick?: () => void;
  tone: "cyan" | "violet";
  type?: "button" | "submit";
}) {
  const buttonClass = tone === "cyan" ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : "bg-violet-500 text-white hover:bg-violet-600";

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-1 min-h-10 text-sm text-slate-400">{description}</p>
      <Button type={type} onClick={onClick} disabled={disabled} className={`mt-4 w-full ${buttonClass}`}>
        {isLoading ? <Loader2 className="size-4 animate-spin" /> : icon}
        {buttonText}
      </Button>
    </div>
  );
}

function MiniStat({ value, label, tone = "default" }: { value: string; label: string; tone?: "default" | "cyan" | "green" }) {
  const toneClass = tone === "cyan" ? "text-cyan-200" : tone === "green" ? "text-green-200" : "text-white";
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-2">
      <p className={`font-semibold ${toneClass}`}>{value}</p>
      <p className="mt-0.5 text-slate-500">{label}</p>
    </div>
  );
}

function FilterChip({
  children,
  isActive,
  onClick,
}: {
  children: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-9 rounded border px-3 py-1.5 text-sm transition ${
        isActive
          ? "border-cyan-300/60 bg-cyan-400/15 text-cyan-50"
          : "border-white/10 bg-white/5 text-slate-300 hover:border-white/25 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function AdminShowtimes({ showtimes }: { showtimes: Showtime[] }) {
  const groupedShowtimes = groupShowtimesByTheater(showtimes, showtimeDateTime);

  return (
    <AdminStepCard
      step="Step 3"
      title="Voting ballot"
      description={
        showtimes.length
          ? `${showtimes.length} member-votable slot${showtimes.length === 1 ? "" : "s"} across ${groupedShowtimes.length} theater${groupedShowtimes.length === 1 ? "" : "s"}.`
          : "Imported showtimes will appear here as the ballot options members rank."
      }
      status={showtimes.length ? "complete" : "current"}
    >
      <div className="space-y-3">
        {showtimes.length ? (
          groupedShowtimes.map((group) => (
            <TheaterShowtimeSection key={group.key} group={group}>
              <div className="grid gap-3 md:grid-cols-2">
                {group.showtimes.map((showtime) => (
                  <ShowtimeCard
                    key={showtime.showtimeId}
                    theaterName={showtime.theaterName}
                    theaterLocation={showtime.theaterLocation}
                    dateTime={showtimeDateTime(showtime)}
                    screenFormat={showtime.screenFormat}
                    ticketURI={showtime.ticketURI}
                    compact
                  />
                ))}
              </div>
            </TheaterShowtimeSection>
          ))
        ) : (
          <EmptyState
            title="No ballot options yet"
            description="Search cached showtimes above, select the best options, then import them for the member ballot."
            className="bg-white/5"
          />
        )}
      </div>
    </AdminStepCard>
  );
}

function ShowtimeCardBody({
  checked,
  dateTime,
  screenFormat,
  ticketURI,
}: {
  checked?: boolean;
  dateTime: string;
  screenFormat?: string;
  ticketURI?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      {typeof checked === "boolean" ? <input type="checkbox" checked={checked} readOnly className="mt-1 size-4 accent-cyan-300" /> : null}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-white">{formatDate(dateTime)}</p>
          <span className="rounded bg-cyan-400/10 px-2 py-1 text-xs font-medium text-cyan-100">{screenFormat || "Standard"}</span>
        </div>
        <p className="mt-2 flex items-center gap-2 text-sm text-slate-300">
          <Clock className="size-4 text-amber-300" />
          {formatTime(dateTime)}
        </p>
        {ticketURI ? <p className="mt-2 truncate text-xs text-slate-500">Tickets linked</p> : null}
      </div>
    </div>
  );
}

function TheaterShowtimeSection<T extends TheaterLikeShowtime>({
  group,
  children,
}: {
  group: TheaterShowtimeGroup<T>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-slate-950/30 p-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-semibold text-white">{group.theaterName}</h3>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-400">
            <MapPin className="size-4 shrink-0" />
            <span className="truncate">{group.theaterLocation || "Chicago area theater"}</span>
          </p>
        </div>
        <span className="w-fit rounded bg-white/5 px-2 py-1 text-xs text-slate-300">
          {group.showtimes.length} slot{group.showtimes.length === 1 ? "" : "s"}
        </span>
      </div>
      {children}
    </section>
  );
}

function groupShowtimesByTheater<T extends TheaterLikeShowtime>(
  showtimes: T[],
  getDateTime: (showtime: T) => string
): TheaterShowtimeGroup<T>[] {
  const groups = new Map<string, TheaterShowtimeGroup<T>>();

  for (const showtime of showtimes) {
    const key = showtime.providerTheaterId || normalizeTheaterName(showtime.theaterName);
    const existing = groups.get(key);

    if (existing) {
      existing.showtimes.push(showtime);
    } else {
      groups.set(key, {
        key,
        theaterName: showtime.theaterName,
        theaterLocation: showtime.theaterLocation,
        showtimes: [showtime],
      });
    }
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      showtimes: [...group.showtimes].sort((first, second) => compareDateTime(getDateTime(first), getDateTime(second))),
    }))
    .sort((first, second) => first.theaterName.localeCompare(second.theaterName));
}

function discoveryToMovieSnapshot(movie: MovieDiscoveryResult): MovieSnapshot {
  return {
    provider: movie.externalProvider,
    externalProvider: movie.externalProvider,
    externalId: movie.externalMovieId,
    externalMovieId: movie.externalMovieId,
    title: movie.title,
    overview: movie.overview || "",
    posterUrl: movie.posterUrl || "",
    releaseDate: movie.releaseDate || "",
    releaseYear: movie.releaseDate?.slice(0, 4) || "",
    runtime: movie.runtimeMinutes,
    genres: movie.genres || [],
    status: movie.status,
    metadataSnapshot: movie.metadataSnapshot,
  };
}

function getAvailableCandidateValues(showtimes: Showtime[], getter: (showtime: Showtime) => string | undefined) {
  return Array.from(
    showtimes.reduce<Set<string>>((values, showtime) => {
      const value = getter(showtime);
      if (value) {
        values.add(value);
      }
      return values;
    }, new Set())
  ).sort();
}

function filterShowtimeCandidates(showtimes: Showtime[], date: string, theater: string, format: string) {
  return showtimes.filter((showtime) => {
    if (date !== "all" && (showtime.localDate || getShowtimeDateKey(showtimeDateTime(showtime))) !== date) {
      return false;
    }
    if (theater !== "all" && showtime.theaterName !== theater) {
      return false;
    }
    if (format !== "all" && (showtime.screenFormat || "Standard") !== format) {
      return false;
    }
    return true;
  });
}

function isVotingClosed(movieNight: ActiveMovieNightResponse["movieNight"]) {
  if (movieNight.votingClosedAt) return true;
  return Boolean(movieNight.votingClosesAt && Date.parse(movieNight.votingClosesAt) <= Date.now());
}

function toLocalDateTimeInput(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function defaultVotingDeadline(targetDate: string) {
  const date = new Date(`${targetDate}T12:00:00`);
  date.setDate(date.getDate() - 1);
  date.setHours(20, 0, 0, 0);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function normalizeTheaterName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ") || "unknown-theater";
}

function compareDateTime(first?: string, second?: string) {
  return (Date.parse(first || "") || 0) - (Date.parse(second || "") || 0);
}

function filterCachedShowtimes(showtimes: CachedShowtime[], selectedDate: string, timeBucket: ShowtimeTimeBucket) {
  return showtimes.filter((showtime) => {
    const dateTime = cachedShowtimeDateTime(showtime);
    if (selectedDate !== "all" && getShowtimeDateKey(dateTime) !== selectedDate) {
      return false;
    }
    return timeBucket === "all" || getShowtimeTimeBucket(dateTime) === timeBucket;
  });
}

function getAvailableShowtimeDates(showtimes: CachedShowtime[]) {
  return Array.from(
    showtimes.reduce<Set<string>>((dates, showtime) => {
      const dateKey = getShowtimeDateKey(cachedShowtimeDateTime(showtime));
      if (dateKey) {
        dates.add(dateKey);
      }
      return dates;
    }, new Set())
  ).sort();
}

function getShowtimeDateKey(value?: string) {
  const date = parseShowtimeDate(value);
  if (!date) {
    return "";
  }

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function getShowtimeTimeBucket(value?: string): ShowtimeTimeBucket | null {
  const date = parseShowtimeDate(value);
  if (!date) {
    return null;
  }

  const hour = date.getHours();
  if (hour < 12) {
    return "morning";
  }
  if (hour < 17) {
    return "afternoon";
  }
  if (hour < 22) {
    return "evening";
  }
  return "late";
}

function parseShowtimeDate(value?: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatShowtimeDateChip(date: string) {
  return formatDate(`${date}T00:00:00`);
}

function cacheKey(showtime: CachedShowtime) {
  return `${showtime.PK}::${showtime.SK}`;
}

function inclusiveDateCount(startDate: string, endDate: string) {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return 1;
  }
  return Math.floor((end - start) / 86_400_000) + 1;
}

function cachedShowtimeDateTime(showtime: CachedShowtime) {
  return showtime.localDateTime || showtime.startsAtUtc;
}

function AdminResults({
  results,
  onConfirm,
  isSaving,
  canConfirm,
}: {
  results: VoteResults | null;
  onConfirm: (showtimeId: string) => void;
  isSaving: boolean;
  canConfirm: boolean;
}) {
  const winner = results?.standings?.[0];

  return (
    <AdminStepCard
      step="Step 4"
      title="Results and confirmation"
      description={results ? `${results.voteCount} ballots submitted` : "Results appear after voting opens and members rank showtimes."}
      status={winner ? "current" : "waiting"}
    >
      <div className="space-y-3">
        {winner ? (
          <div className="rounded-lg border border-green-400/30 bg-green-500/10 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-green-100">
              <ClipboardCheck className="size-4" />
              Current leader
            </p>
            <p className="mt-2 font-semibold text-white">{showtimeLabel(winner.showtime)}</p>
            <p className="mt-1 text-xs text-green-100/80">
              {winner.points} pts / {winner.firstChoiceVotes} first-choice / {winner.rankedVotes} total rankings
            </p>
            {canConfirm ? (
              <StatusAlert tone="warning" className="mt-4">
                Confirming makes this the final club plan and switches members from voting to RSVP and ticket tracking.
              </StatusAlert>
            ) : null}
            {canConfirm ? (
              <Button size="sm" onClick={() => onConfirm(winner.showtimeId)} disabled={isSaving} className="mt-4 bg-green-500 text-slate-950 hover:bg-green-400">
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Confirm leader
              </Button>
            ) : null}
          </div>
        ) : null}

        {results?.standings?.length ? (
          results.standings.map((standing, index) => (
            <div key={standing.showtimeId} className={`rounded-lg border p-4 ${index === 0 ? "border-green-400/20 bg-green-500/5" : "border-white/10 bg-white/5"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-cyan-200">#{index + 1} / {standing.points} pts</p>
                  <p className="mt-1 font-semibold text-white">{showtimeLabel(standing.showtime)}</p>
                  <p className="mt-1 text-xs text-slate-400">{standing.firstChoiceVotes} first-choice votes / {standing.rankedVotes} total rankings</p>
                </div>
                {canConfirm ? (
                  <Button size="sm" variant={index === 0 ? "outline" : "ghost"} onClick={() => onConfirm(standing.showtimeId)} disabled={isSaving} className="shrink-0 border-white/10 text-slate-100 hover:bg-white/10">
                    Confirm
                  </Button>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <EmptyState
            title="No votes yet"
            description="Once members submit ballots, standings will show ranked-choice points and a confirm action for the final showtime."
            className="bg-white/5"
          />
        )}
      </div>
    </AdminStepCard>
  );
}

function VotingControlCard({
  movieNight,
  showtimeCount,
  voteCount,
  isSaving,
  votingClosesAt,
  onVotingClosesAtChange,
  onCloseVoting,
  onOpenVoting,
}: {
  movieNight?: ActiveMovieNightResponse["movieNight"];
  showtimeCount: number;
  voteCount: number;
  isSaving: boolean;
  votingClosesAt: string;
  onVotingClosesAtChange: (value: string) => void;
  onCloseVoting: () => void;
  onOpenVoting: () => void;
}) {
  const status = movieNight?.status;
  const votingOpen = status === "voting";
  const votingClosed = Boolean(movieNight && isVotingClosed(movieNight));
  const blocked = !movieNight || showtimeCount < 2;

  return (
    <AdminStepCard
      step="Voting"
      title="Voting status"
      description="Backend status controls whether member ballots are editable. This panel makes that state explicit for admins."
      status={votingOpen && !votingClosed ? "current" : blocked ? "blocked" : "waiting"}
    >
      <div className="space-y-3">
        <Metric label="Current state" value={formatStatus(status)} tone={statusTone(status)} />
        <Metric label="Close time" value={movieNight?.votingClosesAt ? formatDate(movieNight.votingClosesAt) : "Not scheduled"} />
        <Metric label="Ballots" value={`${voteCount} submitted`} />
        {blocked ? (
          <StatusAlert tone="warning">
            Create the movie night and approve at least 2 showtimes before members can vote.
          </StatusAlert>
        ) : votingOpen && !votingClosed ? (
          <>
            <StatusAlert tone="info">Members can save and edit ranked ballots until the scheduled deadline.</StatusAlert>
            <Button onClick={onCloseVoting} disabled={isSaving} variant="outline" className="w-full border-amber-300/30 text-amber-100 hover:bg-amber-400/10">
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Clock className="size-4" />}Close voting early
            </Button>
          </>
        ) : votingOpen && votingClosed ? (
          <StatusAlert tone="success">Voting is closed. Review standings and confirm the final showtime.</StatusAlert>
        ) : (
          <>
            <StatusAlert tone="warning">
              Voting is not open yet. Only approved showtimes will appear on the member ballot.
            </StatusAlert>
            <Field label="Voting deadline">
              <Input type="datetime-local" value={votingClosesAt} onChange={(event) => onVotingClosesAtChange(event.target.value)} className="border-white/10 bg-white/5 text-white" />
            </Field>
            <Button onClick={onOpenVoting} disabled={isSaving || !movieNight || showtimeCount < 2 || !votingClosesAt} className="w-full bg-violet-500 text-white hover:bg-violet-600">
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Vote className="size-4" />}
              Open voting
            </Button>
          </>
        )}
      </div>
    </AdminStepCard>
  );
}

function AttendanceSummaryCard({ status, attendance }: { status?: MovieNightStatus; attendance: AttendanceResponse | null }) {
  const isConfirmed = status === "confirmed";

  return (
    <AdminStepCard
      step="Attendance"
      title="RSVP and tickets"
      description="Member RSVP and ticket details appear after a final showtime is confirmed."
      status={isConfirmed ? "current" : "waiting"}
    >
      {isConfirmed ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <MiniStat value={`${attendance?.summary.going ?? 0}`} label="going" tone="green" />
            <MiniStat value={`${attendance?.summary.pending ?? 0}`} label="pending" tone="cyan" />
            <MiniStat value={`${attendance?.summary.purchased ?? 0}`} label="tickets purchased" tone="green" />
            <MiniStat value={`${attendance?.summary.maybe ?? 0}`} label="maybe" />
          </div>
          {attendance?.members.map((member) => (
            <div key={member.userId} className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="font-medium text-white">{member.name || member.email || "Club member"}</p>
              {member.email ? <p className="text-xs text-slate-400">{member.email}</p> : null}
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded bg-cyan-400/10 px-2 py-1 text-cyan-100">{member.rsvpStatus.replace("_", " ")}</span>
                <span className="rounded bg-green-400/10 px-2 py-1 text-green-100">{member.ticketStatus.replace("_", " ")}</span>
              </div>
            </div>
          ))}
          {!attendance ? <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="size-4 animate-spin" />Loading attendance...</div> : null}
        </div>
      ) : (
        <EmptyState
          title="Attendance opens after confirmation"
          description="Confirm the final showtime first. Members will then see RSVP and ticket controls on the active night page."
          className="bg-white/5"
        />
      )}
    </AdminStepCard>
  );
}

function CompleteMovieNightCard({
  movieTitle,
  isSaving,
  onComplete,
}: {
  movieTitle: string;
  isSaving: boolean;
  onComplete: () => void;
}) {
  return (
    <Card className="border-green-400/20 bg-slate-900/80 py-6 shadow-2xl shadow-black/20">
      <CardHeader>
        <h2 className="text-xl font-semibold text-white">Complete movie night</h2>
        <p className="text-sm text-slate-400">
          Move {movieTitle} to history so the club can start planning the next movie night.
        </p>
      </CardHeader>
      <CardContent>
        <Button onClick={onComplete} disabled={isSaving} className="w-full bg-green-500 text-slate-950 hover:bg-green-400">
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          Complete and view history
        </Button>
      </CardContent>
    </Card>
  );
}

function InviteList({
  invites,
  copiedInviteId,
  onCopy,
}: {
  invites: ClubInvite[];
  copiedInviteId: string | null;
  onCopy: (invite: ClubInvite) => void;
}) {
  if (!invites.length) {
    return (
      <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-400">
        Added users will appear here after the backend creates their club memberships.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {members.map((member) => (
        <div key={`${member.clubId}-${member.userId}`} className="rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="truncate font-medium text-white">{member.email || member.userId}</p>
                <span className="rounded border border-green-300/20 bg-green-400/10 px-2 py-0.5 text-xs capitalize text-green-100">
                  {member.role}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{member.status || "active"} membership</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function normalizeEmails(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\s,;]+/)
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.includes("@"))
    )
  );
}

function formatStatus(status?: MovieNightStatus) {
  if (!status) {
    return "No active night";
  }
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status?: MovieNightStatus): MetricTone {
  if (status === "confirmed" || status === "completed") {
    return "green";
  }
  if (status === "voting") {
    return "cyan";
  }
  if (status === "cancelled") {
    return "rose";
  }
  if (status === "planning") {
    return "amber";
  }
  return "default";
}

function getCompletedProgress({
  hasMovieNight,
  hasSelectedMovie,
  showtimeCount,
  status,
  resultCount,
}: {
  hasMovieNight: boolean;
  hasSelectedMovie: boolean;
  showtimeCount: number;
  status?: MovieNightStatus;
  resultCount: number;
}) {
  if (status === "confirmed" || status === "completed") {
    return 4;
  }
  if (resultCount || status === "voting") {
    return 3;
  }
  if (showtimeCount) {
    return 2;
  }
  if (hasMovieNight || hasSelectedMovie) {
    return 1;
  }
  return 0;
}

function getNextAction({
  hasMovieNight,
  hasSelectedMovie,
  showtimeCount,
  status,
  resultCount,
}: {
  hasMovieNight: boolean;
  hasSelectedMovie: boolean;
  showtimeCount: number;
  status?: MovieNightStatus;
  resultCount: number;
}) {
  if (status === "completed") {
    return "This movie night is complete and available in club history.";
  }
  if (status === "confirmed") {
    return "The final showtime is set. RSVP remains open until the showtime has passed.";
  }
  if (resultCount) {
    return "Voting results are ready. Review the current leader and confirm the final showtime.";
  }
  if (status === "voting") {
    return "Voting is open. Monitor results as ballots come in, then confirm the winner.";
  }
  if (showtimeCount) {
    return "Candidate showtimes are imported. Members can rank the available options once voting is open.";
  }
  if (hasMovieNight) {
    return "Movie night created. Refresh or search cached showtimes, then import the best options for voting.";
  }
  if (hasSelectedMovie) {
    return "Movie selected. Set the target date and create the movie night to unlock showtime import.";
  }
  return "Start by choosing the movie for the next club screening.";
}
