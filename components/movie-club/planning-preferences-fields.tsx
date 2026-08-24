"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export const PLANNING_FORMATS = ["Standard", "IMAX", "Dolby Cinema", "3D", "4DX", "70mm"] as const;
export const DEFAULT_PLANNING_ZIP = "60422";
export const DEFAULT_PLANNING_RADIUS = 30;

export function validatePlanningLocation(zipCode: string, radiusMiles: number) {
  if (!/^\d{5}(?:-\d{4})?$/.test(zipCode.trim())) {
    return "Enter a valid 5-digit ZIP code or ZIP+4.";
  }
  if (!Number.isFinite(radiusMiles) || radiusMiles < 1 || radiusMiles > 100) {
    return "Search radius must be between 1 and 100 miles.";
  }
  return null;
}

export function PlanningPreferencesFields({
  zipCode,
  radiusMiles,
  preferredFormats,
  onZipCodeChange,
  onRadiusMilesChange,
  onPreferredFormatsChange,
  disabled = false,
}: {
  zipCode: string;
  radiusMiles: number;
  preferredFormats: string[];
  onZipCodeChange: (value: string) => void;
  onRadiusMilesChange: (value: number) => void;
  onPreferredFormatsChange: (value: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="planning-zip">ZIP code</Label>
          <Input
            id="planning-zip"
            inputMode="numeric"
            autoComplete="postal-code"
            value={zipCode}
            onChange={(event) => onZipCodeChange(event.target.value)}
            disabled={disabled}
            placeholder="60601"
            className="border-white/10 bg-white/5 text-white"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="planning-radius">Search radius (miles)</Label>
          <Input
            id="planning-radius"
            type="number"
            min={1}
            max={100}
            value={radiusMiles}
            onChange={(event) => onRadiusMilesChange(Number(event.target.value))}
            disabled={disabled}
            className="border-white/10 bg-white/5 text-white"
          />
        </div>
      </div>
      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="text-sm font-medium text-slate-200">Preferred formats</legend>
        <ToggleGroup value={preferredFormats} onValueChange={onPreferredFormatsChange}>
          {PLANNING_FORMATS.map((format) => (
            <ToggleGroupItem
              key={format}
              value={format}
              disabled={disabled}
              className="border-white/10 bg-white/5 text-slate-200 data-[state=on]:bg-violet-500"
            >
              {format}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="text-xs text-slate-400">These prefill new movie nights and can be changed for each night.</p>
      </fieldset>
    </div>
  );
}
