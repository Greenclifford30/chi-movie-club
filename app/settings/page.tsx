"use client";

import { BellRing, Check, Loader2, MapPin, Settings } from "lucide-react";
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
import type { PushSubscriptionPayload, UserPlanningPreferences } from "@/lib/movie-club-types";

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
  const [isEnablingPush, setIsEnablingPush] = useState(false);

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
        reminderEmailsEnabled: preferences.reminderEmailsEnabled !== false,
        pushNotificationsEnabled: preferences.pushNotificationsEnabled === true,
      });
      setPreferences(result.preferences);
      setMessage("Planning defaults saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save planning defaults.");
    } finally {
      setIsSaving(false);
    }
  }

  async function enablePushNotifications() {
    if (!token) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setError("This browser does not support push notifications.");
      return;
    }
    const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      setError("Push notifications are not configured for this environment.");
      return;
    }
    setIsEnablingPush(true);
    setError(null);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notification permission was not granted.");
      const registration = await navigator.serviceWorker.register("/push-notifications.js");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(publicKey),
      });
      const subscriptionJson = subscription.toJSON();
      if (!subscriptionJson.endpoint || !subscriptionJson.keys?.p256dh || !subscriptionJson.keys.auth) {
        throw new Error("The browser returned an incomplete push subscription.");
      }
      const pushSubscription: PushSubscriptionPayload = {
        endpoint: subscriptionJson.endpoint,
        keys: { p256dh: subscriptionJson.keys.p256dh, auth: subscriptionJson.keys.auth },
      };
      const result = await updateUserPlanningPreferences(token, {
        defaultZipCode: preferences.defaultZipCode.trim(),
        defaultRadiusMiles: preferences.defaultRadiusMiles,
        preferredFormats: preferences.preferredFormats,
        reminderEmailsEnabled: preferences.reminderEmailsEnabled !== false,
        pushNotificationsEnabled: true,
        pushSubscription,
      });
      setPreferences(result.preferences);
      setMessage("Push notifications enabled for this browser.");
    } catch (pushError) {
      setError(pushError instanceof Error ? pushError.message : "Unable to enable push notifications.");
    } finally {
      setIsEnablingPush(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2 text-sm text-cyan-300"><Settings className="size-4" />Account settings</div>
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">Planning defaults</h1>
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
            <Button onClick={handleSave} disabled={isLoading || isSaving} className="w-full bg-violet-500 text-white hover:bg-violet-600 sm:w-auto">
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Save defaults
            </Button>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              <input type="checkbox" checked={preferences.reminderEmailsEnabled !== false} onChange={(event) => setPreferences((current) => ({ ...current, reminderEmailsEnabled: event.target.checked }))} className="mt-0.5 size-4 accent-cyan-400" />
              <span><span className="block font-medium text-white">Email deadline reminders</span>Receive vote and RSVP reminders. Important plan changes always remain in your activity inbox.</span>
            </label>
            <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-slate-300 sm:flex-row sm:items-center sm:justify-between">
              <span><span className="block font-medium text-white">Browser push notifications</span>{preferences.pushNotificationsEnabled ? "Enabled for this browser. Plan updates will also appear as device notifications." : "Get movie-night updates even when this tab is closed."}</span>
              <Button type="button" variant="outline" onClick={enablePushNotifications} disabled={isLoading || isEnablingPush} className="border-cyan-400/40 text-cyan-200 hover:bg-cyan-400/10">
                {isEnablingPush ? <Loader2 className="size-4 animate-spin" /> : <BellRing className="size-4" />}{preferences.pushNotificationsEnabled ? "Refresh push" : "Enable push"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function base64UrlToUint8Array(value: string) {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = window.atob(padded);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}
