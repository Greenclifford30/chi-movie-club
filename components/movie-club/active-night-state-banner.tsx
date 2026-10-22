import { CalendarClock, CheckCircle2, Clock, History, Ticket, Vote } from "lucide-react";
import Link from "next/link";
import { formatDate, formatTime } from "@/lib/movie-club-format";
import type { MovieNightStatus } from "@/lib/movie-club-types";

export function ActiveNightStateBanner({
  status,
  showtimeCount,
  hasVote,
  votingOpen,
  votingClosesAt,
  historyHref,
}: {
  status: MovieNightStatus;
  showtimeCount: number;
  hasVote: boolean;
  votingOpen: boolean;
  votingClosesAt?: string;
  historyHref: string;
}) {
  const state = getState(status, showtimeCount, hasVote, votingOpen);
  const Icon = state.icon;

  return (
    <section aria-label="Movie night status" className={`min-w-0 rounded-lg border p-4 ${state.tone}`}>
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0 space-y-1">
          <h2 className="font-semibold text-white">{state.title}</h2>
          <p className="text-sm leading-6 text-slate-300">{state.description}</p>
          {votingClosesAt && status === "voting" && votingOpen ? (
            <p className="text-sm text-violet-100">Voting closes {formatDate(votingClosesAt)} at {formatTime(votingClosesAt)}.</p>
          ) : null}
          {status === "completed" || status === "cancelled" ? (
            <Link href={historyHref} className="inline-flex min-h-11 items-center text-sm text-violet-200 underline underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-300">View club history</Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function getState(status: MovieNightStatus, showtimeCount: number, hasVote: boolean, votingOpen: boolean) {
  if (status === "confirmed") {
    return { icon: CheckCircle2, tone: "border-green-400/20 bg-green-400/5 text-green-200", title: "Final plan is set", description: "Review the plan, then update your RSVP and ticket status." };
  }
  if (status === "voting" && !votingOpen) {
    return { icon: Clock, tone: "border-amber-300/20 bg-amber-300/5 text-amber-200", title: "Voting is closed", description: "Your ballot is locked while the admin confirms the final plan." };
  }
  if (status === "voting") {
    return { icon: Vote, tone: "border-violet-300/20 bg-violet-300/5 text-violet-200", title: hasVote ? "Your ranked vote is saved" : "Voting is open", description: hasVote ? "You can edit your choices until voting closes." : "Rank up to three different showtimes. Your first choice counts most." };
  }
  if (status === "cancelled") {
    return { icon: CalendarClock, tone: "border-rose-400/20 bg-rose-400/5 text-rose-200", title: "Movie night cancelled", description: "This movie night was cancelled. Voting and RSVP are closed." };
  }
  if (status === "completed") {
    return { icon: History, tone: "border-white/10 bg-white/5 text-slate-300", title: "This movie night is complete", description: "The plan and event details remain available below." };
  }
  return { icon: showtimeCount ? Clock : Ticket, tone: "border-amber-300/20 bg-amber-300/5 text-amber-200", title: showtimeCount ? "Showtimes are being prepared" : "Movie night is in setup", description: "No vote is needed yet. Check back when the admin opens voting." };
}
