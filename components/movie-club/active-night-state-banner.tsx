"use client";

import { CalendarClock, CheckCircle2, Clock, History, Ticket, Vote } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/movie-club-format";
import type { MovieNightStatus } from "@/lib/movie-club-types";

type BannerTone = "violet" | "cyan" | "green" | "amber" | "rose" | "slate";

const toneClasses: Record<BannerTone, string> = {
  violet: "border-violet-400/30 bg-violet-500/10 shadow-violet-950/20",
  cyan: "border-cyan-300/30 bg-cyan-400/10 shadow-cyan-950/20",
  green: "border-green-400/30 bg-green-500/10 shadow-green-950/20",
  amber: "border-amber-300/30 bg-amber-400/10 shadow-amber-950/20",
  rose: "border-rose-400/30 bg-rose-500/10 shadow-rose-950/20",
  slate: "border-white/10 bg-slate-900/70 shadow-black/20",
};

export function ActiveNightStateBanner({
  status,
  showtimeCount,
  hasVote,
  confirmed,
  votingClosesAt,
  historyHref,
}: {
  status: MovieNightStatus;
  showtimeCount: number;
  hasVote: boolean;
  confirmed: boolean;
  votingClosesAt?: string;
  historyHref: string;
}) {
  const state = getState(status, showtimeCount, hasVote, confirmed);
  const Icon = state.icon;

  return (
    <section className={`mb-6 rounded-lg border p-5 shadow-2xl ${toneClasses[state.tone]}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
            <Icon className="size-5" />
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded bg-white/10 px-2 py-1 text-xs font-medium uppercase tracking-wide text-slate-100">
                {status}
              </span>
              {votingClosesAt && status === "voting" ? (
                <span className="rounded bg-rose-400/10 px-2 py-1 text-xs font-medium text-rose-100">
                  Closes {formatDate(votingClosesAt)}
                </span>
              ) : null}
            </div>
            <h2 className="text-xl font-semibold text-white">{state.title}</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-300">{state.description}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
          <Button asChild className={state.primaryClass}>
            <a href={state.anchor}>{state.action}</a>
          </Button>
          {(status === "completed" || status === "cancelled") && (
            <Button asChild variant="outline" className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10">
              <Link href={historyHref}>
                <History className="size-4" />
                View history
              </Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function getState(status: MovieNightStatus, showtimeCount: number, hasVote: boolean, confirmed: boolean) {
  if (status === "confirmed" || confirmed) {
    return {
      tone: "green" as const,
      icon: CheckCircle2,
      title: "Final plan is set",
      description: "Check the theater, date, time, and format, then update your RSVP and ticket status.",
      action: "RSVP and ticket",
      anchor: "#rsvp",
      primaryClass: "bg-green-500 text-slate-950 hover:bg-green-400",
    };
  }
  if (status === "voting") {
    return {
      tone: hasVote ? ("cyan" as const) : ("violet" as const),
      icon: Vote,
      title: hasVote ? "Your ranked vote is saved" : "Voting is open",
      description: hasVote
        ? "You can still edit your top three showtimes while voting remains open."
        : "Rank up to three unique showtimes. Your first choice carries the most weight.",
      action: hasVote ? "Edit vote" : "Rank showtimes",
      anchor: "#vote",
      primaryClass: "bg-violet-500 text-white hover:bg-violet-600",
    };
  }
  if (status === "planning" && showtimeCount) {
    return {
      tone: "amber" as const,
      icon: Clock,
      title: "Showtimes are being prepared",
      description: "The admin has candidate showtimes ready. Voting will open when setup is complete.",
      action: "Review options",
      anchor: "#showtimes",
      primaryClass: "bg-amber-400 text-slate-950 hover:bg-amber-300",
    };
  }
  if (status === "cancelled") {
    return {
      tone: "rose" as const,
      icon: CalendarClock,
      title: "This movie night was cancelled",
      description: "There is no action needed for this event. You can review past confirmed nights in history.",
      action: "See details",
      anchor: "#details",
      primaryClass: "bg-rose-500 text-white hover:bg-rose-600",
    };
  }
  if (status === "completed") {
    return {
      tone: "slate" as const,
      icon: History,
      title: "This movie night is complete",
      description: "The active event has moved into club history.",
      action: "See details",
      anchor: "#details",
      primaryClass: "bg-slate-700 text-white hover:bg-slate-600",
    };
  }
  return {
    tone: "amber" as const,
    icon: Ticket,
    title: "Movie night is in setup",
    description: "No vote is needed yet. Check back once the admin imports showtime options.",
    action: "View movie",
    anchor: "#details",
    primaryClass: "bg-amber-400 text-slate-950 hover:bg-amber-300",
  };
}
