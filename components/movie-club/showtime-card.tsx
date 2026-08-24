"use client";

import { CheckCircle2, Clock, ExternalLink, MapPin } from "lucide-react";
import { formatDate, formatTime } from "@/lib/movie-club-format";

export function ShowtimeCard({
  theaterName,
  theaterLocation,
  dateTime,
  screenFormat,
  ticketURI,
  selected = false,
  rank,
  compact = false,
}: {
  theaterName?: string;
  theaterLocation?: string;
  dateTime: string;
  screenFormat?: string;
  ticketURI?: string;
  selected?: boolean;
  rank?: number;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        selected ? "border-cyan-300/50 bg-cyan-400/10" : "border-white/10 bg-white/5"
      }`}
    >
      <div className="flex items-start gap-3">
        {rank ? (
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-cyan-300/15 text-sm font-semibold text-cyan-100">
            {rank}
          </div>
        ) : selected ? (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-cyan-200" />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-white">{formatDate(dateTime)}</p>
              <p className="mt-1 flex items-center gap-2 text-sm text-slate-300">
                <Clock className="size-4 text-amber-300" />
                {formatTime(dateTime)}
              </p>
            </div>
            <span className="rounded bg-cyan-400/10 px-2 py-1 text-xs font-medium text-cyan-100">
              {screenFormat || "Standard"}
            </span>
          </div>
          {theaterName ? <p className="mt-3 truncate text-sm font-medium text-slate-100">{theaterName}</p> : null}
          {theaterLocation && !compact ? (
            <p className="mt-1 flex items-center gap-2 text-xs text-slate-400">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">{theaterLocation}</span>
            </p>
          ) : null}
          {ticketURI ? (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-cyan-200">
              <ExternalLink className="size-3.5" />
              Tickets linked
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
