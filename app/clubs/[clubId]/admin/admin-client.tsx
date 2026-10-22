"use client";

import {
  BellRing,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Film,
  Loader2,
  MailPlus,
  MapPin,
  RefreshCcw,
  Search,
  Share2,
  Trash2,
  Vote,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { cloneElement, FocusEvent, FormEvent, ReactElement, useEffect, useId, useMemo, useRef, useState } from "react";
import { AdminStepCard } from "@/components/movie-club/admin-step-card";
import { AppShell } from "@/components/movie-club/app-shell";
import { AdminSectionNav, type AdminSection } from "@/components/movie-club/admin-section-nav";
import { PageSkeleton } from "@/components/movie-club/page-skeleton";
import { ConfirmedPlanCard } from "@/components/movie-club/confirmed-plan-card";
import { EmptyState } from "@/components/movie-club/empty-state";
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
  cancelMovieNight,
  completeMovieNight,
  closeVoting,
  confirmShowtime,
  createClubInvites,
  createShareableClubInvite,
  createMovieNight,
  discoverMovies,
  getMovieNight,
  getAttendance,
  getUserPlanningPreferences,
  getVoteResults,
  importShowtimesForMovieNight,
  listClubInvites,
  listMovieNights,
  listClubMembers,
  MovieClubApiError,
  openVoting,
  revokeAllClubInvites,
  revokeClubInvite,
  refreshGracenote,
  rejectShowtimeCandidate,
  searchGracenoteShowtimes,
  searchMovies,
  sendTestNotification,
  updateMovieNight,
  updateMovieNightSetup,
} from "@/lib/movie-club-api";
import { formatDate, formatTime, posterUrl, showtimeDateTime, showtimeLabel } from "@/lib/movie-club-format";
import { movieNightConflicts } from "@/lib/movie-night-conflicts";
import { localDateValue, validatePlanningWindow } from "@/lib/movie-club-planning";
import type { ActiveMovieNightResponse, AttendanceResponse, CachedShowtime, ClubInvite, ClubMembership, MovieDiscoveryResult, MovieNightPlanningInput, MovieNightStatus, MovieSnapshot, Showtime, VoteResults } from "@/lib/movie-club-types";

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

const showtimeTimeBuckets: { value: ShowtimeTimeBucket; label: string }[] = [
  { value: "all", label: "All" },
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "late", label: "Late" },
];

export default function ClubAdminPage() {
  const { clubId, movieNightId: routeMovieNightId } = useParams<{ clubId: string; movieNightId?: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const retryKeys = useRef(new Map<string, string>());
  const lifecyclePending = useRef(false);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);
  const [changeReason, setChangeReason] = useState("");
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const [copyFallback, setCopyFallback] = useState<ClubInvite | null>(null);
  const [feedback, setFeedback] = useState<Record<string, { error?: string | null; message?: string | null }>>({});
  function feedbackFor(target: string) {
    return {
      setError: (error: string | null) => setFeedback(current => ({ ...current, [target]: { ...current[target], error, ...(error ? { message: null } : {}) } })),
      setMessage: (message: string | null) => setFeedback(current => ({ ...current, [target]: { ...current[target], message, ...(message ? { error: null } : {}) } })),
    };
  }
  function actionFeedback(target: string) {
    return <ActionFeedback feedback={feedback[target]} />;
  }
  function keepFocusVisible(event: FocusEvent<HTMLDivElement>) {
    const control = event.target;
    if (!control.matches("a, button, input, select, textarea, summary")) return;
    window.requestAnimationFrame(() => {
      if (!control.isConnected || !control.getClientRects().length) return;
      const bounds = control.getBoundingClientRect();
      const top = document.querySelector("header.sticky")?.getBoundingClientRect().bottom || 0;
      const bottomBars = [
        document.querySelector('nav[aria-label="Club navigation"]'),
        document.querySelector('[aria-label="Showtime review actions"]'),
      ].filter((bar): bar is Element => Boolean(bar?.getClientRects().length && !bar.contains(control)));
      const bottom = Math.min(window.innerHeight, ...bottomBars.map(bar => bar.getBoundingClientRect().top));
      const offset = bounds.bottom > bottom - 12 ? bounds.bottom - bottom + 12 : bounds.top < top + 12 ? bounds.top - top - 12 : 0;
      if (offset) window.scrollBy({ top: offset, behavior: "instant" });
    });
  }
  function retryKey(action: string, payload: unknown) {
    const fingerprint = JSON.stringify([action, routeMovieNightId, payload]);
    if (!retryKeys.current.has(fingerprint)) retryKeys.current.set(fingerprint, crypto.randomUUID());
    return retryKeys.current.get(fingerprint)!;
  }
  const today = useMemo(() => localDateValue(), []);
  const [active, setActive] = useState<ActiveMovieNightResponse | null>(null);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(true);
  const [attendance, setAttendance] = useState<AttendanceResponse | null>(null);
  const [invites, setInvites] = useState<ClubInvite[]>([]);
  const [inviteEmails, setInviteEmails] = useState("");
  const [members, setMembers] = useState<ClubMembership[]>([]);
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
  const [candidateStatusFilter, setCandidateStatusFilter] = useState("all");
  const [candidateDateFilter, setCandidateDateFilter] = useState("all");
  const [candidateTheaterFilter, setCandidateTheaterFilter] = useState("all");
  const [candidateFormatFilter, setCandidateFormatFilter] = useState("all");
  const refreshForm: GracenoteSearchForm = { zip: planningForm.zipCode, radius: planningForm.radiusMiles, numDays: inclusiveDateCount(planningForm.dateWindowStart, planningForm.dateWindowEnd), units: "mi" };
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
  const [candidateFeedbackId, setCandidateFeedbackId] = useState<string | null>(null);
  const [candidateState, setCandidateState] = useState<ActionState>("idle");
  const [votingState, setVotingState] = useState<ActionState>("idle");
  const [votingClosesAt, setVotingClosesAt] = useState("");
  const [inviteState, setInviteState] = useState<ActionState>("idle");
  const [shareInviteState, setShareInviteState] = useState<ActionState>("idle");
  const [inviteClearState, setInviteClearState] = useState<ActionState>("idle");
  const [confirmingShowtimeId, setConfirmingShowtimeId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ActionState>("idle");
  const [completeState, setCompleteState] = useState<ActionState>("idle");
  const [cancelState, setCancelState] = useState<ActionState>("idle");
  const [testNotificationState, setTestNotificationState] = useState<ActionState>("idle");
  const [activeSection, setActiveSection] = useState<AdminSection>("setup");
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [supportsNativeShare, setSupportsNativeShare] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupportsNativeShare(typeof navigator.share === "function");
  }, []);

  async function loadActive() {
    if (!token) {
      return;
    }
    try {
      setError(null);
      if (!routeMovieNightId) throw new MovieClubApiError("Choose an event from the schedule or create a new movie night.", 404);
      const nextActive = await getMovieNight(token, routeMovieNightId);
      if (nextActive.movieNight.clubId !== clubId) throw new MovieClubApiError("Movie night does not belong to this club.", 403);
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
        try {
          setResults(await getVoteResults(token, nextActive.movieNight.movieNightId));
        } catch (resultsError) {
          setResults(null);
          feedbackFor("results").setError(resultsError instanceof Error ? resultsError.message : "Unable to load vote results.");
        }
      } else {
        setResults(null);
      }
      return true;
    } catch (activeError) {
      setActive(null);
      setResults(null);
      if (!routeMovieNightId && activeError instanceof MovieClubApiError && activeError.status === 404 && token) {
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
      } else {
        setError(activeError instanceof Error ? activeError.message : "Unable to load movie night.");
      }
      return false;
    }
  }

  async function loadInvites() {
    const { setError } = feedbackFor("invites");
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

  async function loadMembers() {
    const { setError } = feedbackFor("members");
    if (!token) return;
    try {
      const result = await listClubMembers(token, clubId);
      setMembers(result.members);
    } catch (memberError) {
      setMembers([]);
      if (memberError instanceof MovieClubApiError) {
        setError(memberError.message);
      }
    }
  }

  async function loadAttendance(movieNightId: string) {
    const { setError } = feedbackFor("attendance");
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
    const { setError } = feedbackFor("discovery");
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
    Promise.all([loadActive(), loadInvites(), loadMembers()]).finally(() => {
      if (!cancelled) setIsWorkspaceLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, routeMovieNightId, token]);

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
    if (active?.movieNight.status === "confirmed" || active?.movieNight.status === "completed") void loadAttendance(active.movieNight.movieNightId);
    else setAttendance(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.movieNight.movieNightId, active?.movieNight.status, token]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    const { setError, setMessage } = feedbackFor("search");
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
    const { setError, setMessage } = feedbackFor("setup");
    if (!token || !selectedMovie || !targetDate) {
      return;
    }
    if (routeMovieNightId && movieNight?.status !== "planning") {
      setError("Only planning nights can have their setup edited.");
      return;
    }
    if (movieNight && movieNight.status !== "planning" && movieNight.status !== "completed") {
      setError("Movie night setup can only be replaced while it is still in planning.");
      return;
    }
    const validationError = validatePlanningLocation(planningForm.zipCode, planningForm.radiusMiles) || validatePlanningWindow(planningForm, today);
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
          version: movieNight.version ?? 0,
        });
        setCachedShowtimes([]);
        setSelectedCachedKeys([]);
        setSelectedCandidateIds([]);
        setSelectedShowtimeDate("all");
        setShowtimeTimeBucket("all");
      } else {
        const input = {
          ...planningForm,
          targetDate: planningForm.targetDate || targetDate,
          movieSelectionMode: "admin_selected",
          movie: selectedMovie,
        } as const;
        const created = await createMovieNight(token, clubId, { ...input, idempotencyKey: retryKey("create", input) });
        setCreateState("saved");
        router.push(`/clubs/${encodeURIComponent(clubId)}/movie-nights/${encodeURIComponent(created.movieNight.movieNightId)}/admin`);
        return;
      }
      setCreateState("saved");
      setMessage(`${selectedMovie.title} is ready for showtime import.`);
      await loadActive();
    } catch (createError) {
      setCreateState("error");
      setError(createError instanceof Error ? createError.message : "Unable to create movie night.");
      if (createError instanceof MovieClubApiError && createError.status === 409) await loadActive();
    }
  }

  async function handleRefreshGracenote() {
    const { setError, setMessage } = feedbackFor("recovery");
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
      setMessage("Theater listings refresh requested. Searching for new matches…");
      await searchCachedShowtimesWithRetry(15);
    } catch (refreshError) {
      setRefreshState("error");
      setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh theater listings. Try again.");
    }
  }

  async function handleSearchGracenote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await searchCachedShowtimesWithRetry(1);
  }

  async function searchCachedShowtimesWithRetry(attempts: number) {
    const { setError, setMessage } = feedbackFor("recovery");
    if (!token || !movieNight?.movie) {
      setError("Create a movie night before searching available showtimes.");
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
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        if (attempt > 0) await delay(3000);
        const isGracenoteMovie = movieNight.movie.provider.toLowerCase() === "gracenote";
        const result = await searchGracenoteShowtimes(token, {
          title: movieNight.movie.title,
          provider: isGracenoteMovie ? movieNight.movie.provider : undefined,
          providerMovieId: isGracenoteMovie ? movieNight.movie.externalId : undefined,
          zip: planningForm.zipCode,
          radius: planningForm.radiusMiles,
          numDays: inclusiveDateCount(planningForm.dateWindowStart, planningForm.dateWindowEnd),
          units: refreshForm.units,
          startDate: planningForm.dateWindowStart,
        });
        if (result.showtimes.length) {
          setCachedShowtimes(result.showtimes);
          setGracenoteState("idle");
          setMessage(`${result.showtimes.length} available showtime${result.showtimes.length === 1 ? "" : "s"} found for ${movieNight.movie.title}.`);
          return;
        }
      }
      setGracenoteState("idle");
      setMessage(`No matches are ready for ${movieNight.movie.title}. Theater listings may still be updating; use Search again shortly.`);
    } catch (searchError) {
      setGracenoteState("error");
      setError(searchError instanceof Error ? searchError.message : "Unable to search theater listings. Try again.");
    }
  }

  async function handleImportShowtimes() {
    const { setError, setMessage } = feedbackFor("recovery");
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
      const result = await addShowtimes(token, movieNight.movieNightId, { cachedShowtimeKeys });
      setImportState("saved");
      setSelectedCachedKeys([]);
      setMessage(`${result.showtimes.length} showtime${result.showtimes.length === 1 ? "" : "s"} imported for admin review.`);
      await loadActive();
    } catch (importError) {
      setImportState("error");
      setError(importError instanceof Error ? importError.message : "Unable to import selected showtimes.");
    }
  }

  async function handleSavePlanning() {
    const { setError, setMessage } = feedbackFor("planning");
    if (!token || !movieNight) {
      return;
    }
    if (movieNight.status !== "planning") {
      setError("Planning criteria are locked after voting opens.");
      return;
    }
    const validationError = validatePlanningLocation(planningForm.zipCode, planningForm.radiusMiles) || validatePlanningWindow(planningForm, today);
    if (validationError) {
      setError(validationError);
      return;
    }
    setPlanningState("saving");
    setError(null);
    setMessage(null);
    try {
      await updateMovieNight(token, movieNight.movieNightId, { ...planningForm, version: movieNight.version ?? 0 });
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
    const { setError, setMessage } = feedbackFor("import");
    if (!token || !movieNight) {
      return;
    }
    const validationError = validatePlanningLocation(planningForm.zipCode, planningForm.radiusMiles) || validatePlanningWindow(planningForm, today);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (hasUnsavedPlanning) {
      setError("Save the planning changes before importing showtimes.");
      return;
    }
    setImportState("saving");
    setError(null);
    setMessage(null);
    try {
      const result = await importShowtimesForMovieNight(token, movieNight.movieNightId);
      setImportState("saved");
      setMessage(`Showtime search queued for ${result.importJob.requestedDates.length} day${result.importJob.requestedDates.length === 1 ? "" : "s"}. Results will update automatically.`);
      setSelectedCandidateIds([]);
      await loadActive();
    } catch (importError) {
      setImportState("error");
      setError(importError instanceof Error ? importError.message : "Unable to import showtimes.");
    }
  }

  async function handleCandidateStatus(showtimeId: string, status: "approved" | "rejected") {
    setCandidateFeedbackId(showtimeId);
    const { setError, setMessage } = feedbackFor("candidates");
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
    setCandidateFeedbackId(null);
    const { setError, setMessage } = feedbackFor("candidates");
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
    const { setError, setMessage } = feedbackFor("voting");
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
    const { setError, setMessage } = feedbackFor("voting");
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
    const { setError, setMessage } = feedbackFor("results");
    if (!token || !active?.movieNight) {
      return;
    }
    setConfirmingShowtimeId(showtimeId);
    const isChangingConfirmedShowtime = active.movieNight.status === "confirmed";
    let confirmationMessage = isChangingConfirmedShowtime
      ? "Change the confirmed club plan to this showtime? Members will be notified of the update and may need to update their RSVP."
      : "Confirm this showtime as the final club plan? Members will be notified and can RSVP or track tickets.";
    setConfirmState("saving");
    try {
      const selected = active.showtimes.find(s => s.showtimeId === showtimeId);
      if (selected) confirmationMessage = `${active.movieNight.movie.title}\n${selected.theaterName}\n${formatVotingDeadline(selected.startsAtUtc, active.movieNight.timezone)}\n${selected.screenFormat || "Standard"}\n\n${confirmationMessage}`;
      if (selected) {
        const others = [];
        let cursor: string | undefined;
        do {
          const page = await listMovieNights(token, clubId, { cursor });
          others.push(...page.movieNights); cursor = page.nextCursor || undefined;
        } while (cursor);
        const overlaps = movieNightConflicts(active.movieNight, selected, others);
        if (overlaps.length) confirmationMessage += "\n\n" + overlaps.map(({ movieNight, uncertain }) => `${uncertain ? "Possible overlap (end time unknown)" : "Overlaps"}: ${movieNight.movie.title}.`).join("\n") + "\nContinue with this showtime?";
      }
    } catch {
      confirmationMessage += "\n\nThe overlap check is unavailable. Continue with this showtime?";
    }
    if (!window.confirm(confirmationMessage)) { setConfirmState("idle"); return; }
    setError(null);
    setMessage(null);
    try {
      await confirmShowtime(token, active.movieNight.movieNightId, showtimeId, { expectedVersion: active.movieNight.version ?? 0, changeReason, idempotencyKey: retryKey("confirm", [showtimeId, active.movieNight.version ?? 0, changeReason]) });
      setConfirmState("saved");
      setIsChangingPlan(false);
      setChangeReason("");
      setMessage(isChangingConfirmedShowtime ? "Confirmed showtime updated. Members have been notified of the change." : "Final showtime confirmed. Members can RSVP and track tickets now.");
      await loadActive();
    } catch (confirmError) {
      setConfirmState("error");
      setError(confirmError instanceof Error ? confirmError.message : "Unable to confirm showtime.");
      if (confirmError instanceof MovieClubApiError && confirmError.status === 409) await loadActive();
    }
  }

  async function handleCompleteMovieNight() {
    if (!token || active?.movieNight.status !== "confirmed" || lifecyclePending.current) return;
    if (!window.confirm("End this movie night? It will move to club history, and voting and RSVP will close.")) return;
    lifecyclePending.current = true;
    setCompleteState("saving");
    setLifecycleError(null);
    setError(null);
    setMessage(null);
    try {
      const result = await completeMovieNight(token, active.movieNight.movieNightId, { expectedVersion: active.movieNight.version ?? 0, idempotencyKey: retryKey("complete", active.movieNight.version ?? 0) });
      setActive(current => current ? { ...current, movieNight: result.movieNight } : current);
      setCompleteState("saved");
      router.push(`/clubs/${encodeURIComponent(clubId)}/history`);
    } catch (completeError) {
      setLifecycleError(completeError instanceof Error ? completeError.message : "Unable to complete movie night. Please try again.");
      if (completeError instanceof MovieClubApiError && completeError.status === 409) {
        const refreshed = await loadActive();
        setLifecycleError(refreshed ? "The movie night changed. Its details have been refreshed; review them before trying again." : "The movie night changed and could not be refreshed. Reload this page before trying again.");
      }
      setCompleteState("error");
    } finally {
      lifecyclePending.current = false;
    }
  }

  async function handleCancelMovieNight() {
    if (!token || !active?.movieNight || !["planning", "voting", "confirmed"].includes(active.movieNight.status) || lifecyclePending.current) return;
    if (!window.confirm("Cancel this movie night? Voting and RSVP will close, and all club members will be notified.")) return;
    lifecyclePending.current = true;
    setCancelState("saving");
    setLifecycleError(null);
    setError(null);
    setMessage(null);
    try {
      const result = await cancelMovieNight(token, active.movieNight.movieNightId, { expectedVersion: active.movieNight.version ?? 0, idempotencyKey: retryKey("cancel", active.movieNight.version ?? 0) });
      setActive(current => current ? { ...current, movieNight: result.movieNight } : current);
      setCancelState("saved");
      setMessage("Movie night cancelled and members notified.");
      await loadActive();
    } catch (cancelError) {
      setLifecycleError(cancelError instanceof Error ? cancelError.message : "Unable to cancel movie night. Please try again.");
      if (cancelError instanceof MovieClubApiError && cancelError.status === 409) {
        const refreshed = await loadActive();
        setLifecycleError(refreshed ? "The movie night changed. Its details have been refreshed; review them before trying again." : "The movie night changed and could not be refreshed. Reload this page before trying again.");
      }
      setCancelState("error");
    } finally {
      lifecyclePending.current = false;
    }
  }

  async function handleTestNotification() {
    const { setError, setMessage } = feedbackFor("notification");
    if (!token) return;
    setTestNotificationState("saving");
    setError(null);
    setMessage(null);
    try {
      const result = await sendTestNotification(token, clubId);
      setTestNotificationState("saved");
      setMessage(`${result.message} Check your activity inbox, email, and enabled browser notifications.`);
    } catch (testError) {
      setTestNotificationState("error");
      setError(testError instanceof MovieClubApiError && testError.status === 404
        ? "Test notifications are temporarily unavailable. Try again later."
        : testError instanceof Error ? testError.message : "Unable to queue a test notification.");
    }
  }

  async function handleCreateInvites(event: FormEvent<HTMLFormElement>) {
    const { setError, setMessage } = feedbackFor("invites");
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

  function handleSelectMovie(movie: MovieSnapshot) {
    setSelectedMovie(movie);
    if (!movie.releaseDate || movie.releaseDate < today) {
      return;
    }
    setTargetDate(movie.releaseDate);
    setPlanningForm((current) => ({
      ...current,
      targetDate: movie.releaseDate!,
      dateWindowStart: movie.releaseDate!,
      dateWindowEnd: movie.releaseDate!,
    }));
  }

  async function handleCreateShareableInvite() {
    const { setError, setMessage } = feedbackFor("invites");
    if (!token) return;

    setShareInviteState("saving");
    setError(null);
    setMessage(null);
    try {
      const result = await createShareableClubInvite(token, clubId);
      const invite = result.invites[0];
      setInvites((current) => [invite, ...current]);
      setShareInviteState("saved");
      await loadInvites();
      let wasShared = false;
      try {
        wasShared = await shareInviteNatively(invite);
      } catch {
        // Safari can reject a share call after the network round trip that created the link.
        // Copying still leaves the link ready to paste into Messages.
      }
      if (wasShared) {
        setMessage("Share link ready.");
      } else {
        await handleCopyInvite(invite);
      }
    } catch (inviteError) {
      setShareInviteState("error");
      setError(inviteError instanceof Error ? inviteError.message : "Unable to create a share link.");
    }
  }

  async function handleCopyInvite(invite: ClubInvite) {
    if (!invite.inviteUrl) return;
    const { setError, setMessage } = feedbackFor("invites");
    setError(null);
    setMessage(null);
    setCopiedInviteId(null);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Copy unavailable");
      await navigator.clipboard.writeText(invite.inviteUrl);
      setCopyFallback(null);
      setCopiedInviteId(invite.inviteId);
      setMessage(invite.email ? `Invite link copied for ${invite.email}.` : "Share link copied.");
      window.setTimeout(() => setCopiedInviteId(null), 1800);
    } catch {
      setCopyFallback(invite);
      setError("Automatic copying is unavailable. Select and copy the invite link below.");
    }
  }

  async function handleShareInvite(invite: ClubInvite) {
    const { setError, setMessage } = feedbackFor("invites");
    if (!invite.inviteUrl || typeof navigator.share !== "function") {
      return;
    }

    setError(null);
    setMessage(null);
    try {
      const wasShared = await shareInviteNatively(invite);
      if (wasShared) {
        setMessage(invite.email ? `Invite shared for ${invite.email}.` : "Share link shared.");
      }
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : "Unable to share invite.");
    }
  }

  async function handleRevokeInvite(invite: ClubInvite) {
    const { setError, setMessage } = feedbackFor("invites");
    if (!token || !window.confirm(`Revoke the invite for ${invite.email || "this shareable link"}? Anyone with this link will no longer be able to join.`)) return;

    setInviteClearState("saving");
    setError(null);
    setMessage(null);
    try {
      await revokeClubInvite(token, clubId, invite.inviteId);
      setInvites((current) => current.filter((currentInvite) => currentInvite.inviteId !== invite.inviteId));
      if (copyFallback?.inviteId === invite.inviteId) setCopyFallback(null);
      setInviteClearState("saved");
      setMessage("Invite revoked.");
    } catch (inviteError) {
      setInviteClearState("error");
      setError(inviteError instanceof Error ? inviteError.message : "Unable to revoke invite.");
    }
  }

  async function handleClearAllInvites() {
    const { setError, setMessage } = feedbackFor("invites");
    if (!token || !invites.length || !window.confirm(`Clear all ${invites.length} pending invite${invites.length === 1 ? "" : "s"}? Existing links will stop working.`)) return;

    setInviteClearState("saving");
    setError(null);
    setMessage(null);
    try {
      const { revokedCount } = await revokeAllClubInvites(token, clubId);
      setInvites([]);
      setCopyFallback(null);
      setInviteClearState("saved");
      setMessage(`${revokedCount} pending invite${revokedCount === 1 ? "" : "s"} cleared.`);
    } catch (inviteError) {
      setInviteClearState("error");
      setError(inviteError instanceof Error ? inviteError.message : "Unable to clear pending invites.");
    }
  }

  const movieNight = active?.movieNight;
  const [clockTick, setClockTick] = useState(0);
  useEffect(() => {
    if (movieNight?.status !== "voting" || movieNight.votingClosedAt || !movieNight.votingClosesAt) return;
    const remaining = Date.parse(movieNight.votingClosesAt) - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) return;
    const timer = window.setTimeout(() => setClockTick(tick => tick + 1), Math.min(remaining + 50, 2_147_000_000));
    return () => window.clearTimeout(timer);
  }, [movieNight?.status, movieNight?.votingClosedAt, movieNight?.votingClosesAt, clockTick]);
  const hasUnsavedPlanning = Boolean(movieNight && (
    planningForm.targetDate !== (movieNight.targetDate || "") ||
    planningForm.dateWindowStart !== (movieNight.dateWindowStart || "") ||
    planningForm.dateWindowEnd !== (movieNight.dateWindowEnd || "") ||
    planningForm.zipCode !== (movieNight.zipCode || "") ||
    planningForm.radiusMiles !== (movieNight.radiusMiles || DEFAULT_PLANNING_RADIUS) ||
    (planningForm.timezone || "America/Chicago") !== (movieNight.timezone || "America/Chicago") ||
    JSON.stringify(planningForm.preferredFormats || []) !== JSON.stringify(movieNight.preferredFormats || [])
  ));
  const currentShowtimes = active?.showtimes || [];
  const lifecycleBusy = completeState === "saving" || cancelState === "saving";
  const planningValidationError = validatePlanningLocation(planningForm.zipCode, planningForm.radiusMiles) || validatePlanningWindow(planningForm, today);
  const showImportRecovery = Boolean(movieNight && !["completed", "cancelled"].includes(movieNight.status) && (
    movieNight.showtimeImportStatus === "failed" ||
    (movieNight.showtimeImportStatus === "completed" && currentShowtimes.length === 0)
  ));
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
  ).filter(showtime => candidateStatusFilter === "all" || (showtime.status || "approved") === candidateStatusFilter);
  const visibleCachedShowtimes = useMemo(
    () => filterCachedShowtimes(cachedShowtimes, selectedShowtimeDate, showtimeTimeBucket),
    [cachedShowtimes, selectedShowtimeDate, showtimeTimeBucket]
  );
  const selectedPoster = selectedMovie ? posterUrl(selectedMovie) : "";
  const hasCompletedPointer = movieNight?.status === "completed";
  const canEditSetup = (!routeMovieNightId && !movieNight) || movieNight?.status === "planning";
  const canCreate = Boolean(selectedMovie && targetDate && createState !== "saving" && canEditSetup);
  const setupDescription = !movieNight
    ? "Pick a movie and date to unlock showtime import."
    : hasCompletedPointer
      ? "This movie night is complete. Create a new night from the schedule."
      : movieNight.status === "planning"
        ? "This movie night can be updated before voting opens."
        : "Voting or confirmation has started, so the selected movie is locked.";
  const createButtonLabel = !movieNight ? "Create movie night" : movieNight.status === "planning" ? "Update this event" : "Movie locked";
  const statusLabel = formatStatus(movieNight?.status);
  const nextAction = getNextAction({
    hasMovieNight: Boolean(movieNight),
    hasSelectedMovie: Boolean(selectedMovie),
    showtimeCount: approvedCandidates.length,
    status: movieNight?.status,
    votingClosed: Boolean(movieNight && isVotingClosed(movieNight)),
  });

  useEffect(() => {
    if (isWorkspaceLoading) return;
    if (movieNight?.status === "completed" || movieNight?.status === "cancelled" || movieNight?.status === "confirmed" || movieNight?.status === "voting" || (movieNight?.status === "planning" && approvedCandidates.length >= 2)) setActiveSection("voting");
    else if (approvedCandidates.length || movieNight) setActiveSection("showtimes");
  // The opening section is chosen once after the initial workspace load.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWorkspaceLoading]);

  const eventLinks = (
    <nav aria-label="Movie night navigation" className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 border-t border-white/5 px-4 text-sm text-cyan-200 sm:px-6 lg:px-8">
      <Link className="inline-flex min-h-11 items-center" href={`/clubs/${encodeURIComponent(clubId)}`}>Club schedule</Link>
      {routeMovieNightId ? <Link className="inline-flex min-h-11 items-center" href={`/clubs/${encodeURIComponent(clubId)}/movie-nights/${encodeURIComponent(routeMovieNightId)}`}>View movie night</Link> : null}
      <Link className="inline-flex min-h-11 items-center text-slate-300 sm:ml-auto" href={`/clubs/${encodeURIComponent(clubId)}/movie-nights/new`}>Create a new movie night</Link>
    </nav>
  );

  if (isWorkspaceLoading) {
    return (
      <AppShell movieNightNavigation={eventLinks}>
        <div className="mc-page mc-admin-page" onFocusCapture={keepFocusVisible}>
          <PageSkeleton variant="admin" label="Loading admin workspace" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell movieNightNavigation={eventLinks}>
      <div className="mc-page mc-admin-page" onFocusCapture={keepFocusVisible}>
        <header className="mb-5 border-b border-white/10 pb-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 basis-48">
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Manage movie night</h1>
              <p className="mt-2 break-words text-lg font-medium text-white">{movieNight?.movie.title || selectedMovie?.title || "Choose your next movie"}</p>
            </div>
            {movieNight && ["planning", "voting", "confirmed"].includes(movieNight.status) ? (
              <details className="group w-full rounded-lg border border-white/10 bg-slate-900/80 sm:w-auto sm:max-w-sm">
                <summary className="min-h-11 cursor-pointer rounded-lg px-4 py-3 text-sm font-medium text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300">Event actions</summary>
                <section aria-label="Event actions" className="space-y-3 border-t border-white/10 p-4">
                  <p className="text-sm text-slate-300">{movieNight.status === "confirmed" ? "Ending this night moves it to club history and closes voting and RSVP. You can end it at any time." : "Cancel this night to close planning and voting. Club members will be notified."}</p>
                  {lifecycleError ? <StatusAlert tone="danger">{lifecycleError}</StatusAlert> : null}
                  <div className="flex flex-wrap gap-2">
                    {movieNight.status === "confirmed" ? <Button type="button" onClick={handleCompleteMovieNight} disabled={lifecycleBusy} variant="outline" className="min-h-11 border-white/20 text-slate-100">
                      {completeState === "saving" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}End event
                    </Button> : null}
                    <Button type="button" variant="outline" onClick={handleCancelMovieNight} disabled={lifecycleBusy} className="min-h-11 border-rose-400/40 text-rose-200 hover:bg-rose-500/10">
                      {cancelState === "saving" ? <Loader2 className="size-4 animate-spin" /> : null}Cancel movie night
                    </Button>
                  </div>
                </section>
              </details>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm tabular-nums text-slate-300">
            <span className={`rounded border border-white/15 px-2 py-1 font-medium ${statusTone(movieNight?.status) === "green" ? "text-green-200" : movieNight?.status === "cancelled" ? "text-rose-200" : "text-cyan-200"}`}>{movieNight?.status === "voting" && isVotingClosed(movieNight) ? "Voting closed" : statusLabel}</span>
            <span>{formatDate(movieNight?.targetDate || targetDate)}</span>
            <span>{candidateCounts.approved} approved showtime{candidateCounts.approved === 1 ? "" : "s"}</span>
            {movieNight?.updatedAt ? <span className="text-xs text-slate-400">Updated {formatDate(movieNight.updatedAt)}</span> : null}
          </div>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-slate-300">{nextAction}</p>
        </header>

        <AdminSectionNav active={activeSection} onChange={setActiveSection} summaries={{
          setup: movieNight ? (canEditSetup ? "Ready to edit" : "Locked") : "Choose a movie",
          showtimes: `${candidateCounts.approved} approved`,
          voting: movieNight?.status === "voting" ? (isVotingClosed(movieNight) ? "Ready to confirm" : `${results?.voteCount || 0} ballots`) : statusLabel,
          people: `${members.length} member${members.length === 1 ? "" : "s"} · ${invites.length} invite${invites.length === 1 ? "" : "s"}`,
        }} />

        {lifecycleError && !movieNight ? <StatusAlert tone="danger" className="mb-4">{lifecycleError}</StatusAlert> : null}
        {error ? <StatusAlert tone="danger" className="mb-4">{error}</StatusAlert> : null}
        {message ? <StatusAlert tone="success" className="mb-4">{message}</StatusAlert> : null}

        <section id="admin-panel-setup" role="tabpanel" aria-labelledby="admin-tab-setup" tabIndex={0} hidden={activeSection !== "setup"} className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-violet-300">
        <div className={activeSection === "setup" ? "mb-6 grid gap-6 lg:grid-cols-12 lg:items-start" : "hidden"}>
        <AdminStepCard
              title="Movie"
          description="Choose the title members will vote showtimes for. Discovery supports theatrical releases and upcoming movies."
          status={movieNight || selectedMovie ? "complete" : "current"}
          className="lg:col-span-8"
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
            <span className="text-sm text-slate-400">{nowPlayingMovies.length} discovered</span>
          </div>
            {isNowPlayingLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="size-4 animate-spin" />
                Loading current theatrical releases...
              </div>
            ) : (
              <MovieGrid movies={nowPlayingMovies} selectedMovie={selectedMovie} onSelect={canEditSetup ? handleSelectMovie : undefined} emptyText="No movies loaded yet. Use search or try again shortly." compact />
            )}
            {actionFeedback("discovery")}
            <div className="mt-6 border-t border-white/10 pt-5">
              <h3 className="font-semibold text-white">Search the movie catalog</h3>
              <p className="mt-1 text-sm text-slate-400">Use search when a title is missing from the current theatrical lists.</p>
              <form onSubmit={handleSearch} className="mt-4 grid items-end gap-3 sm:grid-cols-[1fr_auto]">
                <Field label="Movie title"><Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search by movie title" className="border-white/10 bg-white/5 text-white" /></Field>
                <Button type="submit" disabled={movieSearchState === "saving" || searchQuery.trim().length < 2} className="bg-violet-400 text-slate-950 hover:bg-violet-300">
                  {movieSearchState === "saving" ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                  Search movies
                </Button>
              </form>
              {actionFeedback("search")}
              {movies.length ? (
                <div className="mt-5">
                  <MovieGrid movies={movies} selectedMovie={selectedMovie} onSelect={canEditSetup ? handleSelectMovie : undefined} emptyText="Search results will appear here." compact />
                </div>
              ) : null}
            </div>
        </AdminStepCard>

        <Card className="border-violet-400/20 bg-slate-900/90 py-6  lg:col-span-4">
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
                    <div className="grid h-full place-items-center text-slate-400">
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
                Select a theatrical title or search the movie catalog.
              </p>
            )}
            <Field label="Target date">
              <Input
                type="date"
                disabled={!canEditSetup}
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
            <Button onClick={handleCreateMovieNight} disabled={!canCreate} className="w-full bg-violet-400 text-slate-950 hover:bg-violet-300">
              {createState === "saving" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              {createButtonLabel}
            </Button>
            {actionFeedback("setup")}
          </CardContent>
        </Card>
        </div>

            <PlanningPanel
              feedback={actionFeedback("planning")}
              form={planningForm}
              hasMovieNight={Boolean(movieNight)}
              isSaving={planningState === "saving"}
              canEdit={Boolean(movieNight?.status === "planning")}
              onChange={form => { setPlanningForm(form); setTargetDate(form.targetDate); }}
              onSave={handleSavePlanning}
              today={today}
              validationError={planningValidationError}
              usesAccountDefaults={usesAccountDefaults && !movieNight}
            />
        </section>

        <section id="admin-panel-showtimes" role="tabpanel" aria-labelledby="admin-tab-showtimes" tabIndex={0} hidden={activeSection !== "showtimes"} className="space-y-6 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-violet-300">
            {activeSection === "showtimes" ? (<>
            <CandidateShowtimesPanel
              importFeedback={actionFeedback("import")}
              reviewFeedback={actionFeedback("candidates")}
              reviewFeedbackId={candidateFeedbackId}
              counts={candidateCounts}
              filters={{
                status: candidateStatusFilter,
                date: candidateDateFilter,
                theater: candidateTheaterFilter,
                format: candidateFormatFilter,
              }}
              importState={importState}
              hasUnsavedPlanning={hasUnsavedPlanning}
              isCandidateSaving={candidateState === "saving"}
              movieNight={movieNight}
              onBulkApprove={handleBulkApproveCandidates}
              onFilterChange={(nextFilters) => {
                setCandidateStatusFilter(nextFilters.status);
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
              onSelectVisible={() => setSelectedCandidateIds(current => Array.from(new Set([...current, ...visibleCandidates.map(showtime => showtime.showtimeId)])))}
              onClearSelected={() => setSelectedCandidateIds([])}
              selectedIds={selectedCandidateIds}
              showtimes={currentShowtimes}
              visibleShowtimes={visibleCandidates}
            />

            {showImportRecovery ? (
              <GracenoteImportPanel
                feedback={actionFeedback("recovery")}
                cachedShowtimes={cachedShowtimes}
                gracenoteState={gracenoteState}
                importState={importState}
                onClearSelection={clearCachedShowtimes}
                onImport={handleImportShowtimes}
                onRefresh={handleRefreshGracenote}
                onSearch={handleSearchGracenote}
                onSelectAll={selectAllCachedShowtimes}
                onSelectedDateChange={setSelectedShowtimeDate}
                onTimeBucketChange={setShowtimeTimeBucket}
                onToggle={toggleCachedShowtime}
                planning={planningForm}
                refreshState={refreshState}
                selectedDate={selectedShowtimeDate}
                selectedKeys={selectedCachedKeys}
                timeBucket={showtimeTimeBucket}
                visibleShowtimes={visibleCachedShowtimes}
              />
            ) : null}

            </>) : null}
          </section>

        <section id="admin-panel-people" role="tabpanel" aria-labelledby="admin-tab-people" tabIndex={0} hidden={activeSection !== "people"} className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-violet-300">
          <div className="grid min-w-0 gap-6 lg:grid-cols-2 lg:items-start">
            <Card className={`${activeSection === "people" ? "" : "hidden"} border-white/10 bg-slate-900/80 py-6`}>
              <CardHeader>
                <h2 className="font-semibold text-white">Club invites</h2>
                <p className="text-sm text-slate-400">Share a reusable invite link in any app, or create an email-specific invite below.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  type="button"
                  onClick={handleCreateShareableInvite}
                  disabled={shareInviteState === "saving"}
                  className="w-full bg-violet-400 text-slate-950 hover:bg-violet-300"
                >
                  {shareInviteState === "saving" ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
                  Share invite link
                </Button>
                <div className="flex items-center gap-3 text-xs text-slate-400 before:h-px before:flex-1 before:bg-white/10 after:h-px after:flex-1 after:bg-white/10">or invite by email</div>
                <form onSubmit={handleCreateInvites} className="space-y-3">
                  <Field label="Email addresses">
                    <textarea
                      value={inviteEmails}
                      onChange={(event) => setInviteEmails(event.target.value)}
                      placeholder="name@example.com, friend@example.com"
                      className="min-h-24 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-base text-white outline-none transition placeholder:text-slate-400 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
                    />
                  </Field>
                  <Button type="submit" disabled={inviteState === "saving" || !inviteEmails.trim()} className="w-full bg-violet-400 text-slate-950 hover:bg-violet-300">
                    {inviteState === "saving" ? <Loader2 className="size-4 animate-spin" /> : <MailPlus className="size-4" />}
                    Create invites
                  </Button>
                </form>
                {invites.length ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClearAllInvites}
                    disabled={inviteClearState === "saving"}
                    className="w-full border-rose-300/30 text-rose-100 hover:bg-rose-400/10 hover:text-rose-50"
                  >
                    {inviteClearState === "saving" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                    Clear all pending invites
                  </Button>
                ) : null}
                {actionFeedback("invites")}
                {copyFallback?.inviteUrl ? <Field label="Invite link to copy"><Input readOnly value={copyFallback.inviteUrl} onFocus={event => event.target.select()} /></Field> : null}
                <InviteList
                  invites={invites}
                  copiedInviteId={copiedInviteId}
                  supportsNativeShare={supportsNativeShare}
                  onCopy={handleCopyInvite}
                  onShare={handleShareInvite}
                  onRevoke={handleRevokeInvite}
                  isRevoking={inviteClearState === "saving"}
                />
              </CardContent>
            </Card>

            <Card className={`${activeSection === "people" ? "" : "hidden"} border-white/10 bg-slate-900/80 py-6`}>
              <CardHeader>
                <h2 className="font-semibold text-white">Club members</h2>
                <p className="text-sm text-slate-400">See who receives email deadline reminders and browser push alerts.</p>
              </CardHeader>
              <CardContent>{actionFeedback("members")}<MemberList members={members} /></CardContent>
            </Card>

            <div className="mc-panel p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" onClick={handleTestNotification} disabled={testNotificationState === "saving"} className="border-cyan-400/40 text-cyan-200 hover:bg-cyan-400/10">
              {testNotificationState === "saving" ? <Loader2 className="size-4 animate-spin" /> : <BellRing className="size-4" />}Send test notification
            </Button>
            <p className="text-xs text-slate-400">Sends a real test only to your admin account through the activity inbox, email, and enabled browser push.</p>
          </div>
          {actionFeedback("notification")}
              </div>

          </div>
        </section>

        <section id="admin-panel-voting" role="tabpanel" aria-labelledby="admin-tab-voting" tabIndex={0} hidden={activeSection !== "voting"} className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-violet-300">
          <div className="grid min-w-0 gap-6 lg:grid-cols-2 lg:items-start">
            {movieNight?.confirmedShowtime ? <ConfirmedPlanCard showtime={movieNight.confirmedShowtime} /> : null}
            {movieNight?.status === "confirmed" || movieNight?.status === "completed" ? <div>{actionFeedback("attendance")}<AttendanceSummaryCard status={movieNight.status} attendance={attendance} error={Boolean(feedback.attendance?.error)} /></div> : null}
            <VotingControlCard
              movieNight={movieNight}
              showtimeCount={approvedCandidates.length}
              voteCount={results?.voteCount || 0}
              isSaving={votingState === "saving"}
              votingClosesAt={votingClosesAt}
              onVotingClosesAtChange={setVotingClosesAt}
              onCloseVoting={handleCloseVoting}
              onOpenVoting={handleOpenVoting}
              onShowtimes={() => { setActiveSection("showtimes"); document.getElementById("admin-tab-showtimes")?.focus(); }}
              feedback={actionFeedback("voting")}
            />
            <div className="min-w-0 space-y-4">
              {movieNight?.status === "confirmed" ? (
                <div className="space-y-3">
                  <Button type="button" variant="outline" aria-expanded={isChangingPlan} aria-controls="change-plan" disabled={confirmState === "saving"} onClick={() => { setIsChangingPlan(current => !current); setChangeReason(""); }}>
                    {isChangingPlan ? "Keep current plan" : "Change confirmed plan"}
                  </Button>
                  {isChangingPlan ? <div id="change-plan" className="space-y-3">
                    <StatusAlert tone="warning">Changing the plan notifies members and asks them to review their RSVP and tickets.</StatusAlert>
                    <Field label="Reason for changing the plan (optional)"><Input autoFocus maxLength={1000} value={changeReason} onChange={event => setChangeReason(event.target.value)} /></Field>
                  </div> : null}
                </div>
              ) : null}
              <AdminResults
                results={results}
                alternatives={approvedCandidates}
                feedbackShowtimeId={confirmingShowtimeId}
                onConfirm={handleConfirm}
                isSaving={confirmState === "saving"}
                canConfirm={Boolean(movieNight && ((movieNight.status === "confirmed" && isChangingPlan) || (movieNight.status === "voting" && isVotingClosed(movieNight))))}
                isChangingConfirmedShowtime={movieNight?.status === "confirmed" && isChangingPlan}
                feedback={actionFeedback("results")}
              />
            </div>
          </div>
        </section>
      </div>
    </AppShell>
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
    <div className={compact ? "grid grid-cols-2 gap-3 xl:grid-cols-4" : "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"}>
      {movies.map((movie) => {
        const image = posterUrl(movie);
        const activeMovie = selectedMovie?.provider === movie.provider && selectedMovie?.externalId === movie.externalId;
        return (
          <button
            key={`${movie.provider}-${movie.externalId}`}
            type="button"
            onClick={() => onSelect?.(movie)}
            disabled={!onSelect}
            aria-pressed={activeMovie}
            className={`overflow-hidden rounded-lg border bg-white/5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-60 ${activeMovie ? "border-cyan-300/60 bg-cyan-400/10" : "border-white/10 hover:border-white/25 hover:bg-white/10"}`}
          >
            <div className={`relative bg-slate-950 ${compact ? "h-32" : "h-64"}`}>
              {image ? (
                <Image src={image} alt={movie.title} fill sizes={compact ? "180px" : "240px"} className="object-cover" />
              ) : (
                <div className="grid h-full place-items-center text-slate-400">
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
  feedback,
  canEdit,
  form,
  hasMovieNight,
  isSaving,
  onChange,
  onSave,
  today,
  usesAccountDefaults,
  validationError,
}: {
  feedback?: React.ReactNode;
  canEdit: boolean;
  form: MovieNightPlanningInput;
  hasMovieNight: boolean;
  isSaving: boolean;
  onChange: (form: MovieNightPlanningInput) => void;
  onSave: () => void;
  today: string;
  usesAccountDefaults: boolean;
  validationError: string | null;
}) {
  return (
    <AdminStepCard
      title="Planning"
      description="Choose nearby theaters, formats, and the dates to search for showtimes."
      status={canEdit ? "current" : hasMovieNight ? "complete" : "blocked"}
    >
      <div className="space-y-4">
        {hasMovieNight && !canEdit ? <StatusAlert tone="info">Planning is read-only because voting has started or this night has ended.</StatusAlert> : null}
        <fieldset disabled={!canEdit && hasMovieNight} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Target date">
            <Input type="date" min={today} value={form.targetDate} onChange={(event) => onChange({ ...form, targetDate: event.target.value })} className="border-white/10 bg-white/5 text-white" />
          </Field>
          <Field label="Window start">
            <Input type="date" min={today} value={form.dateWindowStart} onChange={(event) => onChange({ ...form, dateWindowStart: event.target.value })} className="border-white/10 bg-white/5 text-white" />
          </Field>
          <Field label="Window end">
            <Input type="date" min={form.dateWindowStart || today} value={form.dateWindowEnd} onChange={(event) => onChange({ ...form, dateWindowEnd: event.target.value })} className="border-white/10 bg-white/5 text-white" />
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
        {canEdit && validationError ? <StatusAlert tone="warning">{validationError}</StatusAlert> : null}
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <Field label="Timezone">
            <Input value={form.timezone || "America/Chicago"} onChange={(event) => onChange({ ...form, timezone: event.target.value })} className="border-white/10 bg-white/5 text-white" />
          </Field>
          <Button onClick={onSave} disabled={!canEdit || isSaving || Boolean(validationError)} className="bg-violet-400 text-slate-950 hover:bg-violet-300">
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Save planning
          </Button>
        </div>
        </fieldset>
        {feedback}
        {!hasMovieNight ? (
          <StatusAlert tone="warning">Create the movie night first, then save planning updates and import showtimes.</StatusAlert>
        ) : null}
      </div>
    </AdminStepCard>
  );
}

function CandidateShowtimesPanel({
  importFeedback,
  reviewFeedback,
  reviewFeedbackId,
  onSelectVisible,
  onClearSelected,
  counts,
  filters,
  hasUnsavedPlanning,
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
  importFeedback?: React.ReactNode;
  reviewFeedback?: React.ReactNode;
  reviewFeedbackId: string | null;
  onSelectVisible: () => void;
  onClearSelected: () => void;
  counts: { imported: number; approved: number; rejected: number; duplicates: number };
  filters: { date: string; theater: string; format: string; status: string };
  hasUnsavedPlanning: boolean;
  importState: ActionState;
  isCandidateSaving: boolean;
  movieNight?: ActiveMovieNightResponse["movieNight"];
  onBulkApprove: () => void;
  onFilterChange: (filters: { date: string; theater: string; format: string; status: string }) => void;
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
  const readOnly = Boolean(movieNight && ["completed", "cancelled"].includes(movieNight.status));
  const completedEmpty = movieNight?.showtimeImportStatus === "completed" && !showtimes.length;

  return (
    <AdminStepCard
      title="Showtimes"
      description="Import candidates from the saved planning window, then approve only the options members should rank."
      status={counts.approved ? "complete" : movieNight ? "current" : "blocked"}
    >
      <div className="space-y-5">
        {reviewFeedbackId && !visibleShowtimes.some(showtime => showtime.showtimeId === reviewFeedbackId) ? reviewFeedback : null}
        {readOnly ? <StatusAlert tone="info">This night has ended. Showtimes are available for review only.</StatusAlert> : null}
        <div className="grid grid-cols-2 gap-2 text-center text-xs md:grid-cols-4">
          <MiniStat value={`${counts.imported}`} label="imported" />
          <MiniStat value={`${counts.approved}`} label="approved" tone="green" />
          <MiniStat value={`${counts.rejected}`} label="rejected" />
          <MiniStat value={`${counts.duplicates}`} label="duplicates" tone="cyan" />
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-white">Find showtimes</p>
              <p className="mt-1 text-sm text-slate-400">
                Uses {movieNight?.dateWindowStart || "start TBD"} through {movieNight?.dateWindowEnd || "end TBD"} near {movieNight?.zipCode || "ZIP TBD"}.
              </p>
            </div>
            <Button onClick={onImport} disabled={readOnly || !movieNight || importState === "saving" || importInProgress || hasUnsavedPlanning} className="bg-violet-400 text-slate-950 hover:bg-violet-300">
              {importState === "saving" || importInProgress ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
              {importInProgress ? "Import in progress" : "Import showtimes"}
            </Button>
          </div>
          {importFeedback}
          {summary?.requestedDates?.length ? (
            <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
              <MiniStat value={`${summary.requestedDates.length}`} label="days checked" />
              <MiniStat value={`${summary.resultCount || 0}`} label="matches found" tone="cyan" />
              <MiniStat value={`${summary.importedCount || 0}`} label="new candidates" tone="green" />
              <MiniStat value={`${summary.duplicateCount || 0}`} label="duplicates" />
            </div>
          ) : null}
          {hasUnsavedPlanning ? <StatusAlert tone="warning" className="mt-3">Save your planning changes before searching for showtimes.</StatusAlert> : null}
          {completedEmpty ? <StatusAlert tone="warning" className="mt-3">No showtimes were found. Try refreshing theater listings in the section below.</StatusAlert> : null}
          {movieNight?.showtimeImportStatus === "failed" ? (
            <StatusAlert tone="danger" className="mt-3">{summary?.errorMessage || "Showtime search failed. Try again shortly."}</StatusAlert>
          ) : null}
        </div>

        {movieNight?.showtimeMonitoring?.status === "active" ? (
          <StatusAlert tone="info">
            Watching for tickets and showtimes automatically. {movieNight.showtimeMonitoring.lastCheckedAt ? `Last checked ${formatDate(movieNight.showtimeMonitoring.lastCheckedAt)}. ` : ""}
            {movieNight.showtimeMonitoring.nextCheckAt ? `Next check ${formatDate(movieNight.showtimeMonitoring.nextCheckAt)}.` : "The next check will run within a day."}
          </StatusAlert>
        ) : movieNight?.showtimeMonitoring?.status === "found" ? (
          <StatusAlert tone="success">
            Showtimes are available. Review and approve the imported candidates before opening voting.
          </StatusAlert>
        ) : null}

        {showtimes.length ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Status"><NativeSelect value={filters.status} onChange={value => onFilterChange({ ...filters, status: value })} options={["all", "imported", "approved", "rejected"]} /></Field>
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

            <div className="flex flex-wrap items-center justify-between gap-3 border-y border-white/10 py-3">
              <span className="text-sm text-slate-300">{visibleShowtimes.length} visible · {selectedIds.length} selected</span>
              <Button type="button" size="sm" variant="outline" onClick={onSelectVisible} disabled={readOnly || isCandidateSaving || !visibleShowtimes.length || visibleShowtimes.every(showtime => selectedIds.includes(showtime.showtimeId))}>Select all visible</Button>
            </div>
            {!visibleShowtimes.length ? <p className="text-sm text-slate-300">No showtimes match these filters. Choose All to see more options.</p> : null}
            <div className="space-y-4">
              {groupedShowtimes.map((group) => (
                <TheaterShowtimeSection key={group.key} group={group}>
                  <div className="grid gap-3 md:grid-cols-2">
                    {group.showtimes.map((showtime) => {
                      const selected = selectedIds.includes(showtime.showtimeId);
                      return (
                        <div key={showtime.showtimeId} className="rounded-lg border border-white/10 bg-white/5 p-3">
                          <button type="button" aria-pressed={selected} aria-label={`Select ${showtimeLabel(showtime)}`} disabled={readOnly || isCandidateSaving} onClick={() => onToggleSelected(showtime.showtimeId)} className="w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                            <ShowtimeCardBody selected={selected} dateTime={showtimeDateTime(showtime)} screenFormat={showtime.screenFormat} ticketURI={showtime.ticketURI} />
                          </button>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <span className={`rounded px-2 py-1 text-xs ${showtime.status === "approved" ? "bg-green-400/10 text-green-100" : showtime.status === "rejected" ? "bg-rose-400/10 text-rose-100" : "bg-amber-400/10 text-amber-100"}`}>
                              {showtime.status || "approved"}
                            </span>
                            <div className="flex gap-2">
                              <Button type="button" size="sm" aria-label={`Approve ${showtimeLabel(showtime)}`} variant="outline" onClick={() => onStatusChange(showtime.showtimeId, "approved")} disabled={readOnly || isCandidateSaving || !showtime.status || showtime.status === "approved"} className="border-white/10 text-slate-100 hover:bg-white/10">
                                Approve
                              </Button>
                              <Button type="button" size="sm" aria-label={`Reject ${showtimeLabel(showtime)}`} variant="ghost" onClick={() => onStatusChange(showtime.showtimeId, "rejected")} disabled={readOnly || isCandidateSaving || showtime.status === "rejected"} className="text-rose-100 hover:bg-rose-400/10">
                                Reject
                              </Button>
                            </div>
                          </div>
                          {reviewFeedbackId === showtime.showtimeId ? reviewFeedback : null}
                        </div>
                      );
                    })}
                  </div>
                </TheaterShowtimeSection>
              ))}
            </div>
            {selectedIds.length ? (
              <div role="region" aria-label="Showtime review actions" className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 space-y-3 rounded-lg border border-white/20 bg-slate-900 p-3 lg:bottom-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm font-medium text-white">{selectedIds.length} selected</span>
                  <Button type="button" size="sm" variant="outline" onClick={onClearSelected} disabled={readOnly || isCandidateSaving}>Clear selected</Button>
                  <Button type="button" size="sm" onClick={onBulkApprove} disabled={readOnly || isCandidateSaving} className="w-full bg-violet-400 text-slate-950 hover:bg-violet-300 sm:w-auto">
                    {isCandidateSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Approve selected
                  </Button>
                </div>
                {!reviewFeedbackId ? reviewFeedback : null}
              </div>
            ) : !reviewFeedbackId ? reviewFeedback : null}

          </>
        ) : (
          <EmptyState
      title="No imported candidates"
            description="Save your planning preferences, then find showtimes across your selected dates."
            className="bg-white/5"
          />
        )}
      </div>
    </AdminStepCard>
  );
}

function NativeSelect({
  id,
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  id?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 w-full rounded-md border border-white/10 bg-slate-950 px-3 text-base text-white outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:h-9 md:text-sm"
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
  feedback,
  cachedShowtimes,
  gracenoteState,
  importState,
  onClearSelection,
  onImport,
  onRefresh,
  onSearch,
  onSelectAll,
  onSelectedDateChange,
  onTimeBucketChange,
  onToggle,
  planning,
  refreshState,
  selectedDate,
  selectedKeys,
  timeBucket,
  visibleShowtimes,
}: {
  feedback?: React.ReactNode;
  cachedShowtimes: CachedShowtime[];
  gracenoteState: LoadState;
  importState: ActionState;
  onClearSelection: () => void;
  onImport: () => void;
  onRefresh: () => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onSelectAll: () => void;
  onSelectedDateChange: (date: string) => void;
  onTimeBucketChange: (bucket: ShowtimeTimeBucket) => void;
  onToggle: (showtime: CachedShowtime) => void;
  planning: MovieNightPlanningInput;
  refreshState: ActionState;
  selectedDate: string;
  selectedKeys: string[];
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
    <section className="rounded-lg border border-amber-300/20 bg-slate-900/80 p-5 ">
      <div className="space-y-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-amber-200">Showtime recovery</p>
          <h3 className="mt-1 text-xl font-semibold text-white">Refresh theater listings</h3>
          <p className="mt-1 text-sm text-slate-400">The automatic search could not find showtimes. Refresh theater listings, review matches, and add the options you want.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid grid-cols-2 gap-2 text-center text-xs sm:min-w-48">
            <MiniStat value={`${cachedShowtimes.length}`} label="available" />
            <MiniStat value={`${selectedCount}`} label="selected" tone="cyan" />
          </div>
        </div>

        <form onSubmit={onSearch} className="space-y-4">
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
            Searching {planning.dateWindowStart} through {planning.dateWindowEnd} within {planning.radiusMiles} miles of {planning.zipCode}.
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <ActionPanel
        title="1. Queue fresh showtimes"
              description="Request the latest listings for this area before searching again."
              icon={<RefreshCcw className="size-4" />}
              disabled={refreshState === "saving" || gracenoteState === "loading"}
              isLoading={refreshState === "saving"}
              onClick={onRefresh}
              buttonText="Refresh and search"
              tone="cyan"
            />
            <ActionPanel
        title="2. Search available listings"
              description="Find available showtimes for this movie across your selected dates."
              icon={<Search className="size-4" />}
              disabled={gracenoteState === "loading"}
              isLoading={gracenoteState === "loading"}
              type="submit"
              buttonText="Search again"
              tone="violet"
            />
          </div>
        </form>

        {feedback}
        {cachedShowtimes.length ? (
          <div className="space-y-3">
            <div className="space-y-3 rounded-lg border border-white/10 bg-slate-950/30 p-3">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase text-slate-400">Date</p>
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
                <p className="text-xs font-medium uppercase text-slate-400">Time</p>
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
                  ? `${visibleShowtimes.length} of ${cachedShowtimes.length} available showtime${cachedShowtimes.length === 1 ? "" : "s"} visible`
                  : `${cachedShowtimes.length} available showtime${cachedShowtimes.length === 1 ? "" : "s"}`}{" "}
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
              <div className="space-y-4 md:max-h-[34rem] md:overflow-y-auto md:pr-1">
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
                            aria-pressed={isSelected}
                            aria-label={`Select ${showtime.theaterName}, ${formatDate(dateTime)}, ${formatTime(dateTime)}, ${showtime.screenFormat || "Standard"}`}
                            className={`w-full rounded-lg border p-3 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 active:scale-[0.99] ${isSelected ? "border-cyan-300/60 bg-cyan-400/10" : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10"}`}
                          >
                            <ShowtimeCardBody selected={isSelected} dateTime={dateTime} screenFormat={showtime.screenFormat} ticketURI={showtime.ticketURI} />
                          </button>
                        );
                      })}
                    </div>
                  </TheaterShowtimeSection>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-400">
                No available showtimes match these date and time filters. Adjust the filters above to show more options.
              </p>
            )}
            <Button onClick={onImport} disabled={!selectedCount || importState === "saving"} className="w-full bg-violet-400 text-slate-950 hover:bg-violet-300">
              {importState === "saving" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Import {selectedCount || ""} selected showtime{selectedCount === 1 ? "" : "s"}
            </Button>
          </div>
        ) : (
          <EmptyState
      title="No theater listings loaded"
            description="Refresh listings if needed, then search again for this movie."
            className="bg-white/5"
          />
        )}
      </div>
    </section>
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
  const buttonClass = tone === "cyan" ? "bg-violet-400 text-slate-950 hover:bg-violet-300" : "bg-violet-400 text-slate-950 hover:bg-violet-300";

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
      <p className="mt-0.5 text-slate-400">{label}</p>
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
      aria-pressed={isActive}
      className={`min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 rounded border px-3 py-1.5 text-sm transition md:min-h-9 ${
        isActive
          ? "border-cyan-300/60 bg-cyan-400/15 text-cyan-50"
          : "border-white/10 bg-white/5 text-slate-300 hover:border-white/25 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function ShowtimeCardBody({
  selected,
  dateTime,
  screenFormat,
  ticketURI,
}: {
  selected?: boolean;
  dateTime: string;
  screenFormat?: string;
  ticketURI?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      {typeof selected === "boolean" ? <span aria-hidden="true" className={`mt-1 grid size-4 shrink-0 place-items-center rounded-sm border ${selected ? "border-cyan-300 bg-cyan-300 text-slate-950" : "border-slate-500"}`}>{selected ? <Check className="size-3" /> : null}</span> : null}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-white">{formatDate(dateTime)}</p>
          <span className="rounded bg-cyan-400/10 px-2 py-1 text-xs font-medium text-cyan-100">{screenFormat || "Standard"}</span>
        </div>
        <p className="mt-2 flex items-center gap-2 text-sm text-slate-300">
          <Clock className="size-4 text-amber-300" />
          {formatTime(dateTime)}
        </p>
        {ticketURI ? <p className="mt-2 truncate text-xs text-slate-400">Tickets linked</p> : null}
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

function delay(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function cachedShowtimeDateTime(showtime: CachedShowtime) {
  return showtime.localDateTime || showtime.startsAtUtc;
}

function AdminResults({ results, alternatives, onConfirm, isSaving, canConfirm, isChangingConfirmedShowtime, feedback, feedbackShowtimeId }: {
  results: VoteResults | null;
  alternatives: Showtime[];
  feedbackShowtimeId: string | null;
  onConfirm: (showtimeId: string) => Promise<void>;
  isSaving: boolean;
  canConfirm: boolean;
  isChangingConfirmedShowtime: boolean;
  feedback?: React.ReactNode;
}) {
  const standings = results?.standings || [];
  const unranked = isChangingConfirmedShowtime ? alternatives.filter(showtime => !standings.some(standing => standing.showtimeId === showtime.showtimeId)) : [];
  return (
    <AdminStepCard
      title={isChangingConfirmedShowtime ? "Choose a replacement showtime" : "Voting results"}
      description={isChangingConfirmedShowtime ? "Choose an approved showtime. You will review the details before saving." : results ? `${results.voteCount} ballots submitted. Standings show points and first-choice votes.` : "Standings appear after members rank showtimes."}
      status={canConfirm ? "current" : "waiting"}
    >
      <div className="space-y-3">
        {canConfirm && !isChangingConfirmedShowtime ? <StatusAlert tone="info">Review the standings, then confirm the final showtime to open RSVP and ticket tracking.</StatusAlert> : null}
        {!feedbackShowtimeId || !standings.some(standing => standing.showtimeId === feedbackShowtimeId) && !unranked.some(showtime => showtime.showtimeId === feedbackShowtimeId) ? feedback : null}
        {standings.map((standing, index) => (
          <div key={standing.showtimeId} className={`rounded-lg border p-4 ${index === 0 ? "border-green-400/25 bg-green-500/5" : "border-white/10"}`}>
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
              <div className="min-w-0 break-words">
                <p className="text-sm font-medium text-cyan-200">#{index + 1} · {standing.points} points{index === 0 ? " · Current leader" : ""}</p>
                <p className="mt-1 font-semibold text-white">{showtimeLabel(standing.showtime)}</p>
                <p className="mt-1 text-xs text-slate-300">{standing.firstChoiceVotes} first-choice votes · {standing.rankedVotes} total rankings</p>
              </div>
              {canConfirm ? <Button size="sm" aria-label={`${isChangingConfirmedShowtime ? "Change to" : "Confirm"} ${showtimeLabel(standing.showtime)}`} onClick={() => onConfirm(standing.showtimeId)} disabled={isSaving} className="shrink-0 bg-violet-400 text-slate-950 hover:bg-violet-300">
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}{isChangingConfirmedShowtime ? "Choose showtime" : "Confirm"}
              </Button> : null}
            </div>
            {feedbackShowtimeId === standing.showtimeId ? feedback : null}
          </div>
        ))}
        {unranked.map(showtime => <div key={showtime.showtimeId} className="space-y-3 rounded-lg border border-white/10 p-4">
          <p className="break-words font-medium text-white">{showtimeLabel(showtime)}</p>
          <Button size="sm" disabled={isSaving} onClick={() => onConfirm(showtime.showtimeId)} aria-label={`Change to ${showtimeLabel(showtime)}`} className="bg-violet-400 text-slate-950 hover:bg-violet-300">{isSaving ? <Loader2 className="size-4 animate-spin" /> : null}Choose showtime</Button>
          {feedbackShowtimeId === showtime.showtimeId ? feedback : null}
        </div>)}
        {!standings.length && !unranked.length ? <p className="text-sm text-slate-300">{isChangingConfirmedShowtime ? "No approved alternatives are available. Review showtimes before changing the plan." : "No ballots have been submitted yet."}</p> : null}
      </div>
    </AdminStepCard>
  );
}

function VotingControlCard({ movieNight, showtimeCount, voteCount, isSaving, votingClosesAt, onVotingClosesAtChange, onCloseVoting, onOpenVoting, onShowtimes, feedback }: {
  movieNight?: ActiveMovieNightResponse["movieNight"];
  showtimeCount: number;
  voteCount: number;
  isSaving: boolean;
  votingClosesAt: string;
  onVotingClosesAtChange: (value: string) => void;
  onCloseVoting: () => void;
  onOpenVoting: () => void;
  onShowtimes: () => void;
  feedback?: React.ReactNode;
}) {
  const status = movieNight?.status;
  const closed = Boolean(movieNight && isVotingClosed(movieNight));
  const isPlanning = status === "planning";
  const label = status === "voting" ? (closed ? "Voting closed" : "Voting open") : formatStatus(status);
  const description = status === "confirmed" ? "The final plan is set. Voting is locked; members can RSVP and track tickets."
    : status === "completed" ? "This movie night has ended. Voting and RSVP are closed."
    : status === "cancelled" ? "This movie night was cancelled. Voting and RSVP are closed."
    : status === "voting" ? (closed ? "Ballots are locked. Review the standings and confirm a showtime." : "Members can save and edit their rankings until the deadline.")
    : movieNight ? "Approve at least two showtimes, then choose a deadline and open voting." : "Create a movie night before opening voting.";
  return (
    <AdminStepCard title="Voting status" description={description} status={status === "voting" ? "current" : "waiting"}>
      <div className="space-y-4">
        <p className="font-medium text-cyan-200">{label}</p>
        <dl className="space-y-2 text-sm text-slate-300">
          {movieNight?.votingClosesAt ? <div><dt className="font-medium text-slate-200">Voting deadline</dt><dd className="mt-1 tabular-nums">{formatVotingDeadline(movieNight.votingClosesAt, movieNight.timezone)}</dd></div> : null}
          {status !== "planning" && movieNight ? <div className="flex gap-2"><dt>Ballots submitted</dt><dd className="font-medium text-white">{voteCount}</dd></div> : null}
        </dl>
        {isPlanning && showtimeCount < 2 ? <div className="space-y-3"><StatusAlert tone="info">Approve at least two showtimes to give members a choice.</StatusAlert><Button type="button" variant="outline" onClick={onShowtimes}>Review showtimes</Button></div> : null}
        {isPlanning && showtimeCount >= 2 ? <>
          <Field label="Voting deadline" htmlFor="voting-deadline"><Input id="voting-deadline" type="datetime-local" value={votingClosesAt} onChange={event => onVotingClosesAtChange(event.target.value)} /></Field>
          <p className="text-xs text-slate-300">Enter the deadline in your device timezone. The saved deadline is displayed in {movieNight?.timezone || "America/Chicago"}.</p>
          <Button onClick={onOpenVoting} disabled={isSaving || !votingClosesAt} className="w-full bg-violet-400 text-slate-950 hover:bg-violet-300">{isSaving ? <Loader2 className="size-4 animate-spin" /> : <Vote className="size-4" />}Open voting</Button>
        </> : null}
        {status === "voting" && !closed ? <Button onClick={onCloseVoting} disabled={isSaving} variant="outline" className="w-full border-amber-300/30 text-amber-100 hover:bg-amber-400/10">{isSaving ? <Loader2 className="size-4 animate-spin" /> : <Clock className="size-4" />}Close voting early</Button> : null}
        {feedback}
      </div>
    </AdminStepCard>
  );
}

function formatVotingDeadline(value: string, timezone = "America/Chicago") {
  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(value)) + ` (${timezone})`;
  } catch {
    return `Deadline unavailable. Check the date and timezone in Setup.`;
  }
}

function ActionFeedback({ feedback }: { feedback?: { error?: string | null; message?: string | null } }) {
  if (!feedback?.error && !feedback?.message) return null;
  return <StatusAlert tone={feedback.error ? "danger" : "success"} className="mt-3 break-words">{feedback.error || feedback.message}</StatusAlert>;
}

function AttendanceSummaryCard({ status, attendance, error }: { status?: MovieNightStatus; attendance: AttendanceResponse | null; error?: boolean }) {
  const isConfirmed = status === "confirmed" || status === "completed";

  return (
    <AdminStepCard
      title="RSVP and tickets"
      description={status === "completed" ? "Final RSVP and ticket responses for this movie night." : "Member responses to the confirmed plan."}
      status={isConfirmed ? "current" : "waiting"}
    >
      {isConfirmed && error ? <p className="text-sm text-slate-300">Attendance could not be loaded. Reload this page to try again.</p> : isConfirmed ? (
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
                <span className="rounded bg-cyan-400/10 px-2 py-1 text-cyan-100">{member.needsReconfirmation ? `Needs reconfirmation · Previous: ${member.priorRsvpStatus?.replaceAll("_", " ")}` : member.rsvpStatus.replace("_", " ")}</span>
                <span className="rounded bg-green-400/10 px-2 py-1 text-green-100">{member.ticketsNeedReview ? `Needs review · Previous: ${member.priorTicketStatus?.replaceAll("_", " ")}` : member.ticketStatus.replace("_", " ")}</span>
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

export function inviteShareData(invite: ClubInvite): ShareData {
  const clubName = invite.clubName || "this movie club";
  return {
    title: `Join ${clubName}`,
    text: `You're invited to join ${clubName} for movie nights.`,
    url: invite.inviteUrl,
  };
}

export async function shareInviteNatively(invite: ClubInvite): Promise<boolean> {
  if (!invite.inviteUrl || typeof navigator.share !== "function") {
    return false;
  }

  try {
    await navigator.share(inviteShareData(invite));
    return true;
  } catch (shareError) {
    if (shareError instanceof DOMException && shareError.name === "AbortError") {
      return false;
    }
    throw shareError;
  }
}

export function InviteList({
  invites,
  copiedInviteId,
  supportsNativeShare,
  onCopy,
  onShare,
  onRevoke,
  isRevoking,
}: {
  invites: ClubInvite[];
  copiedInviteId: string | null;
  supportsNativeShare: boolean;
  onCopy: (invite: ClubInvite) => void;
  onShare: (invite: ClubInvite) => void;
  onRevoke: (invite: ClubInvite) => void;
  isRevoking: boolean;
}) {
  if (!invites.length) {
    return (
      <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-400">
        No invites yet. Add one or more email addresses to create shareable invite links.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {invites.map((invite) => (
        <div key={invite.inviteId} className="rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="truncate font-medium text-white">{invite.email || "Shareable link"}</p>
                <InviteBadge status={invite.status} />
              </div>
              <p className="mt-1 text-xs text-slate-400">Expires {formatDate(invite.expiresAt)}</p>
            </div>
            {invite.inviteUrl ? (
              <div className="flex shrink-0 items-center gap-1">
                {supportsNativeShare ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Share invite for ${invite.email || "this link"}`}
                    onClick={() => onShare(invite)}
                    className="min-h-11 text-cyan-200 hover:bg-white/10"
                  >
                    <Share2 className="size-4" />
                    Share
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
            title="Copy invite link"
                  aria-label={`Copy invite link for ${invite.email || "this link"}`}
                  onClick={() => onCopy(invite)}
                  className="size-11 text-slate-200 hover:bg-white/10"
                >
                  {copiedInviteId === invite.inviteId ? <Check className="size-4 text-green-300" /> : <Copy className="size-4" />}
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
            title="Revoke invite"
                  aria-label={`Revoke invite for ${invite.email || "this link"}`}
                  onClick={() => onRevoke(invite)}
                  disabled={isRevoking}
                  className="size-11 text-rose-200 hover:bg-rose-400/10 hover:text-rose-100"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ) : null}
          </div>
          {invite.inviteUrl ? <p className="mt-2 break-all text-xs text-cyan-200">{invite.inviteUrl}</p> : null}
        </div>
      ))}
    </div>
  );
}

function InviteBadge({ status }: { status: ClubInvite["status"] }) {
  const classes: Record<ClubInvite["status"], string> = {
    pending: "border-amber-300/20 bg-amber-400/10 text-amber-100",
    accepted: "border-green-300/20 bg-green-400/10 text-green-100",
    expired: "border-rose-300/20 bg-rose-400/10 text-rose-100",
    revoked: "border-slate-300/20 bg-slate-400/10 text-slate-200",
  };
  return <span className={`rounded border px-2 py-0.5 text-xs capitalize ${classes[status]}`}>{status}</span>;
}

export function MemberList({ members }: { members: ClubMembership[] }) {
  if (!members.length) {
    return <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-400">No active members found for this club.</p>;
  }

  return (
    <div className="space-y-3">
      {members.map((member) => (
        <div key={`${member.clubId}-${member.userId}`} className="rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="truncate font-medium text-white">{member.name || member.email || member.userId}</p>
            <span className="rounded border border-green-300/20 bg-green-400/10 px-2 py-0.5 text-xs capitalize text-green-100">{member.role}</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">{member.name && member.email ? member.email : ""}{member.name && member.email ? " · " : ""}{member.status || "active"} membership</p>
          <div className="mt-3 flex flex-wrap gap-2" aria-label={`Alert preferences for ${member.name || member.email || member.userId}`}>
            <PreferenceBadge label="Email reminders" enabled={member.reminderEmailsEnabled !== false} />
            <PreferenceBadge label="Browser push" enabled={member.pushNotificationsEnabled === true} />
          </div>
        </div>
      ))}
    </div>
  );
}

function PreferenceBadge({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <span className={`rounded border px-2 py-1 text-xs ${enabled ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-100" : "border-slate-300/15 bg-slate-400/5 text-slate-400"}`}>
      {label}: {enabled ? "On" : "Off"}
    </span>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactElement<{ id?: string }> }) {
  const generatedId = useId();
  const id = htmlFor || children.props.id || generatedId;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {cloneElement(children, { id })}
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

function getNextAction({
  hasMovieNight,
  hasSelectedMovie,
  showtimeCount,
  status,
  votingClosed,
}: {
  hasMovieNight: boolean;
  hasSelectedMovie: boolean;
  showtimeCount: number;
  status?: MovieNightStatus;
  votingClosed: boolean;
}) {
  if (status === "completed") {
    return "This movie night is complete and available in club history.";
  }
  if (status === "confirmed") {
    return "The final showtime is set. RSVP remains open until the showtime has passed.";
  }
  if (status === "cancelled") return "This movie night was cancelled. Create a new night when you are ready.";
  if (status === "voting") {
    return votingClosed ? "Voting is closed. Review the standings and confirm the final showtime." : "Voting is open. Monitor ballots and wait for voting to close before confirming the plan.";
  }
  if (showtimeCount) {
    return "Candidate showtimes are imported. Members can rank the available options once voting is open.";
  }
  if (hasMovieNight) {
    return "Movie night created. Refresh or search available showtimes, then import the best options for voting.";
  }
  if (hasSelectedMovie) {
    return "Movie selected. Set the target date and create the movie night to unlock showtime import.";
  }
  return "Start by choosing the movie for the next club screening.";
}
