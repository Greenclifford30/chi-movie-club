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
  hideMobileSave = false,
  onChange,
  onSave,
}: {
  showtimes: Showtime[];
  rankings: string[];
  disabled: boolean;
  isSaving: boolean;
  hasSavedVote: boolean;
  hideMobileSave?: boolean;
  onChange: (rankIndex: number, showtimeId: string) => void;
  onSave: () => void;
}) {
  const selectedCount = rankings.filter(Boolean).length;

  return (
    <div className="space-y-4">
      {rankLabels.map((rank, index) => {
        const unavailable = rankings.filter((value, valueIndex) => value && valueIndex !== index);
        return (
          <div key={rank.label} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span id={`rank-${index}-label`} className="text-sm font-medium text-slate-200">{rank.label}</span>
              <span className="text-xs text-slate-500">{rank.points}</span>
            </div>
            <Select value={rankings[index] || "none"} onValueChange={(value) => onChange(index, value)} disabled={disabled || isSaving}>
              <SelectTrigger aria-labelledby={`rank-${index}-label`} className="min-h-11 w-full min-w-0 border-white/10 bg-white/5 text-left whitespace-normal text-slate-100 data-[size=default]:h-auto md:data-[size=default]:h-auto [&_[data-slot=select-value]]:line-clamp-none [&_[data-slot=select-value]]:block [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:flex-1 [&_[data-slot=select-value]]:[overflow-wrap:anywhere]">
                <SelectValue placeholder="Choose a showtime" />
              </SelectTrigger>
              <SelectContent className="w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)]">
                <SelectItem value="none">No selection</SelectItem>
                {showtimes.map((showtime) => (
                  <SelectItem className="min-h-11 whitespace-normal [overflow-wrap:anywhere] [&>span:last-child]:min-w-0" key={showtime.showtimeId} value={showtime.showtimeId} disabled={unavailable.includes(showtime.showtimeId)}>
                    {showtimeLabel(showtime)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}
      <Button className={`${hideMobileSave ? "hidden lg:flex" : ""} min-h-11 w-full bg-violet-400 text-slate-950 hover:bg-violet-300`} disabled={disabled || !selectedCount || isSaving} onClick={onSave}>
        {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Vote className="size-4" />}
        {hasSavedVote ? "Update ranked vote" : "Save ranked vote"}
      </Button>
    </div>
  );
}
