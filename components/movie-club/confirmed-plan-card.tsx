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
}: {
  showtime: Showtime;
  onPrimaryAction?: () => void;
  secondaryAction?: ReactNode;
}) {
  const dateTime = showtimeDateTime(showtime);

  return (
    <section className="rounded-lg border border-green-400/30 bg-green-500/10 p-5 shadow-2xl shadow-green-950/20">
      <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-green-100">
        <CheckCircle2 className="size-5" />
        Confirmed final plan
      </p>
      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{showtime.theaterName}</h2>
          {showtime.theaterLocation ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-300">
              <MapPin className="size-4 text-cyan-200" />
              {showtime.theaterLocation}
            </p>
          ) : null}
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <PlanStat icon={<CalendarDays className="size-5 text-amber-300" />} label="Date" value={formatDate(dateTime, "EEEE, MMMM d")} />
            <PlanStat icon={<Clock className="size-5 text-cyan-300" />} label="Time" value={formatTime(dateTime)} />
            <PlanStat icon={<Ticket className="size-5 text-green-300" />} label="Format" value={showtime.screenFormat || "Standard"} />
          </div>
        </div>
        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:flex-wrap md:justify-end">
          {showtime.ticketURI ? (
            <Button asChild className="w-full bg-green-500 text-slate-950 hover:bg-green-400 md:w-auto">
              <a href={showtime.ticketURI} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                Buy tickets
              </a>
            </Button>
          ) : null}
          {secondaryAction}
          {onPrimaryAction ? <Button onClick={onPrimaryAction} className="bg-green-500 text-slate-950 hover:bg-green-400">RSVP and ticket</Button> : null}
        </div>
      </div>
    </section>
  );
}

function PlanStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="mb-3">{icon}</div>
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-white">{value}</p>
    </div>
  );
}
