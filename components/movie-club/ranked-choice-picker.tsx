"use client";

import { Loader2, Vote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showtimeLabel } from "@/lib/movie-club-format";
import type { Showtime } from "@/lib/movie-club-types";

const rankLabels = [
  { label: "First choice", points: "3 pts" },
  { label: "Second choice", points: "2 pts" },
  { label: "Third choice", points: "1 pt" },
];

export function RankedChoicePicker({
  showtimes,
  rankings,
  disabled,
  isSaving,
  hasSavedVote,
  onChange,
  onSave,
}: {
  showtimes: Showtime[];
  rankings: string[];
  disabled: boolean;
  isSaving: boolean;
  hasSavedVote: boolean;
  onChange: (rankIndex: number, showtimeId: string) => void;
  onSave: () => void;
}) {
  const selectedCount = rankings.filter(Boolean).length;
  const selectedShowtimes = rankings
    .map((ranking) => showtimes.find((showtime) => showtime.showtimeId === ranking))
    .filter(Boolean) as Showtime[];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-violet-400/20 bg-violet-500/10 p-3 text-sm text-violet-50">
        Pick up to three different showtimes. You can edit your saved vote while voting is open.
      </div>
      {rankLabels.map((rank, index) => {
        const unavailable = rankings.filter((value, valueIndex) => value && valueIndex !== index);
        return (
          <div key={rank.label} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium text-slate-200">{rank.label}</label>
              <span className="text-xs text-slate-500">{rank.points}</span>
            </div>
            <Select value={rankings[index] || "none"} onValueChange={(value) => onChange(index, value)} disabled={disabled}>
              <SelectTrigger className="w-full border-white/10 bg-white/5 text-slate-100">
                <SelectValue placeholder="Choose a showtime" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No selection</SelectItem>
                {showtimes.map((showtime) => (
                  <SelectItem key={showtime.showtimeId} value={showtime.showtimeId} disabled={unavailable.includes(showtime.showtimeId)}>
                    {showtimeLabel(showtime)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}
      {selectedShowtimes.length ? (
        <ol className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          {selectedShowtimes.map((showtime, index) => (
            <li key={showtime.showtimeId} className="flex gap-2 py-1">
              <span className="text-cyan-300">{index + 1}.</span>
              <span>{showtimeLabel(showtime)}</span>
            </li>
          ))}
        </ol>
      ) : null}
      <Button className="w-full bg-violet-500 text-white hover:bg-violet-600" disabled={disabled || !selectedCount || isSaving} onClick={onSave}>
        {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Vote className="size-4" />}
        {hasSavedVote ? "Update ranked vote" : "Save ranked vote"}
      </Button>
      {disabled ? <p className="text-xs text-slate-500">Voting is locked until the event is open for member ballots.</p> : null}
    </div>
  );
}
