"use client";

import { CalendarDays, CheckCircle2, Clock, ExternalLink, MapPin, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";
import { formatDate, formatTime, showtimeDateTime } from "@/lib/movie-club-format";
import type { Showtime } from "@/lib/movie-club-types";

export function ConfirmedPlanCard({
  showtime,
  onPrimaryAction,
  secondaryAction,
  showTicketAction = true,
}: {
  showtime: Showtime;
  onPrimaryAction?: () => void;
  secondaryAction?: ReactNode;
  showTicketAction?: boolean;
}) {
  const dateTime = showtimeDateTime(showtime);

  return (
    <section aria-label="Final movie night plan" className="min-w-0 rounded-xl border border-green-400/20 bg-[#142128] p-4 sm:p-6">
      <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.13em] text-green-200">
        <CheckCircle2 className="size-5" />
        Final plan
      </p>
      <div className="grid min-w-0 gap-6">
        <div className="min-w-0">
          <h2 className="break-words text-2xl font-semibold tracking-tight text-white sm:text-3xl">{showtime.theaterName}</h2>
          {showtime.theaterLocation ? (
            <p className="mt-2 flex items-start gap-2 text-sm text-slate-300">
              <MapPin className="mt-0.5 size-4 shrink-0 text-cyan-200" />
              <span className="min-w-0 break-words">{showtime.theaterLocation}</span>
            </p>
          ) : null}
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <PlanStat icon={<CalendarDays className="size-5 text-amber-300" />} label="Date" value={formatDate(dateTime, "EEEE, MMMM d")} />
            <PlanStat icon={<Clock className="size-5 text-cyan-300" />} label="Time" value={formatTime(dateTime)} />
            <PlanStat icon={<Ticket className="size-5 text-green-300" />} label="Format" value={showtime.screenFormat || "Standard"} />
          </div>
        </div>
        {((showTicketAction && showtime.ticketURI) || secondaryAction || onPrimaryAction) ? <div className="flex min-w-0 flex-col items-stretch gap-3 border-t border-white/10 pt-5">
          {showTicketAction && showtime.ticketURI ? (
            <Button asChild className="h-auto min-h-11 w-full whitespace-normal bg-violet-400 text-slate-950 hover:bg-violet-300">
              <a href={showtime.ticketURI} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                Buy tickets
              </a>
            </Button>
          ) : null}
          {secondaryAction}
          {onPrimaryAction ? <Button onClick={onPrimaryAction} className="h-auto min-h-11 whitespace-normal bg-violet-400 text-slate-950 hover:bg-violet-300">RSVP and ticket</Button> : null}
        </div> : null}
      </div>
    </section>
  );
}

function PlanStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 break-words border-l border-white/10 pl-4">
      <div className="mb-2">{icon}</div>
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-white">{value}</p>
    </div>
  );
}
