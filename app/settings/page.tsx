"use client";

import { Check, Loader2, MapPin, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/movie-club/app-shell";
import {
  DEFAULT_PLANNING_RADIUS,
  DEFAULT_PLANNING_ZIP,
  PlanningPreferencesFields,
  validatePlanningLocation,
} from "@/components/movie-club/planning-preferences-fields";
import { StatusAlert } from "@/components/movie-club/status-alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getUserPlanningPreferences, MovieClubApiError, updateUserPlanningPreferences } from "@/lib/movie-club-api";
import { useAuth } from "@/lib/auth-context";
import type { UserPlanningPreferences } from "@/lib/movie-club-types";

const fallbackPreferences: UserPlanningPreferences = {
  defaultZipCode: DEFAULT_PLANNING_ZIP,
  defaultRadiusMiles: DEFAULT_PLANNING_RADIUS,
  preferredFormats: [],
};

export default function SettingsPage() {
  const { email, token } = useAuth();
  const [preferences, setPreferences] = useState(fallbackPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setIsLoading(true);
    getUserPlanningPreferences(token)
      .then(({ preferences: saved }) => {
        if (!cancelled) setPreferences(saved);
      })
      .catch((loadError) => {
        if (!cancelled && (!(loadError instanceof MovieClubApiError) || loadError.status !== 404)) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load planning defaults.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [token]);

  async function handleSave() {
    if (!token) return;
    const validationError = validatePlanningLocation(preferences.defaultZipCode, preferences.defaultRadiusMiles);
    if (validationError) {
      setError(validationError);
      setMessage(null);
      return;
    }
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await updateUserPlanningPreferences(token, {
        defaultZipCode: preferences.defaultZipCode.trim(),
        defaultRadiusMiles: preferences.defaultRadiusMiles,
        preferredFormats: preferences.preferredFormats,
      });
      setPreferences(result.preferences);
      setMessage("Planning defaults saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save planning defaults.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2 text-sm text-cyan-300"><Settings className="size-4" />Account settings</div>
          <h1 className="text-3xl font-semibold text-white">Planning defaults</h1>
          <p className="mt-2 text-slate-300">Set reusable starting values for every club you administer.</p>
        </div>
        {error ? <StatusAlert tone="danger" className="mb-4">{error}</StatusAlert> : null}
        {message ? <StatusAlert tone="success" className="mb-4">{message}</StatusAlert> : null}
        <Card className="border-white/10 bg-slate-900/80 py-6">
          <CardHeader>
            <div className="flex items-center gap-2"><MapPin className="size-5 text-violet-300" /><h2 className="font-semibold text-white">Showtime search</h2></div>
            <p className="text-sm text-slate-400">Signed in as {email || "your account"}. Existing movie nights keep their saved criteria.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="size-4 animate-spin" />Loading preferences...</div>
            ) : (
              <PlanningPreferencesFields
                zipCode={preferences.defaultZipCode}
                radiusMiles={preferences.defaultRadiusMiles}
                preferredFormats={preferences.preferredFormats}
                onZipCodeChange={(defaultZipCode) => setPreferences((current) => ({ ...current, defaultZipCode }))}
                onRadiusMilesChange={(defaultRadiusMiles) => setPreferences((current) => ({ ...current, defaultRadiusMiles }))}
                onPreferredFormatsChange={(preferredFormats) => setPreferences((current) => ({ ...current, preferredFormats }))}
              />
            )}
            <Button onClick={handleSave} disabled={isLoading || isSaving} className="bg-violet-500 text-white hover:bg-violet-600">
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Save defaults
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
