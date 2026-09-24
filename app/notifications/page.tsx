"use client";

import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/movie-club/app-shell";
import { EmptyState } from "@/components/movie-club/empty-state";
import { PageSkeleton } from "@/components/movie-club/page-skeleton";
import { StatusAlert } from "@/components/movie-club/status-alert";
import { Button } from "@/components/ui/button";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/movie-club-api";
import { useAuth } from "@/lib/auth-context";
import type { Notification } from "@/lib/movie-club-types";

export default function NotificationsPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    listNotifications(token)
      .then(({ notifications }) => { if (!cancelled) setItems(notifications); })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load activity."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  async function markRead(item: Notification) {
    if (!token || item.readAt) return;
    try {
      await markNotificationRead(token, item.notificationId);
      setItems((all) => all.map((current) => current.notificationId === item.notificationId ? { ...current, readAt: new Date().toISOString() } : current));
    } catch {
      // The destination can still open when recording a read receipt fails.
    }
  }

  async function markAll() {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await markAllNotificationsRead(token);
      setItems((all) => all.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to mark activity as read.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="mc-page mc-page-narrow">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="mc-eyebrow mb-2 flex items-center gap-2"><Bell className="size-4" /> Activity</p>
            <h1 className="mc-title">Planning updates</h1>
            <p className="mt-3 text-slate-300">Voting, plans, and RSVP updates from your clubs.</p>
          </div>
          <Button variant="outline" onClick={markAll} disabled={saving || !items.some((item) => !item.readAt)}><CheckCheck className="size-4" />Read all</Button>
        </div>
        {error ? <StatusAlert tone="danger" className="mb-5">{error}</StatusAlert> : null}
        {loading ? <PageSkeleton variant="form" label="Loading activity" /> : items.length ? (
          <div className="mc-panel overflow-hidden">
            {items.map((item) => (
              <Link key={`${item.notificationId}-${item.createdAt}`} href={item.href} onClick={() => { void markRead(item); }} className={`flex gap-4 border-b border-white/[.07] p-5 transition last:border-0 hover:bg-white/[.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-300 ${item.readAt ? "" : "bg-violet-400/[.05]"}`}>
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${item.readAt ? "bg-transparent" : "bg-violet-300"}`} aria-hidden="true" />
                <span className="min-w-0"><span className="block font-semibold text-white">{item.title}</span><span className="mt-1 block text-sm leading-6 text-slate-300">{item.body}</span><span className="mt-2 block text-xs tabular-nums text-slate-500">{new Date(item.createdAt).toLocaleString()}</span></span>
              </Link>
            ))}
          </div>
        ) : <EmptyState title="No activity yet" description="Movie night updates will appear here when your clubs start planning." action={{ label: "Browse clubs", href: "/clubs" }} />}
      </div>
    </AppShell>
  );
}
