"use client";

import { Bell, CheckCheck, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/movie-club/app-shell";
import { StatusAlert } from "@/components/movie-club/status-alert";
import { Button } from "@/components/ui/button";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/movie-club-api";
import { useAuth } from "@/lib/auth-context";
import type { Notification } from "@/lib/movie-club-types";

export default function NotificationsPage() {
  const { token } = useAuth(); const [items, setItems] = useState<Notification[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (!token) return; listNotifications(token).then(({ notifications }) => setItems(notifications)).catch((err) => setError(err instanceof Error ? err.message : "Unable to load activity.")).finally(() => setLoading(false)); }, [token]);
  async function markRead(item: Notification) { if (!token || item.readAt) return; await markNotificationRead(token, item.notificationId); setItems((all) => all.map((current) => current === item ? { ...current, readAt: new Date().toISOString() } : current)); }
  async function markAll() { if (!token) return; await markAllNotificationsRead(token); setItems((all) => all.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() }))); }
  return <AppShell><div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8"><div className="mb-6 flex items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-sm text-cyan-300"><Bell className="size-4" />Activity</div><h1 className="text-2xl font-semibold text-white sm:text-3xl">Planning updates</h1><p className="mt-2 text-slate-300">Your club’s voting, plan, and RSVP activity.</p></div><Button variant="outline" onClick={markAll} disabled={!items.some((item) => !item.readAt)}><CheckCheck className="size-4" />Read all</Button></div>{error ? <StatusAlert tone="danger">{error}</StatusAlert> : null}{loading ? <div className="flex gap-2 text-slate-400"><Loader2 className="size-4 animate-spin" />Loading activity...</div> : <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/70">{items.length ? items.map((item) => <Link key={`${item.notificationId}-${item.createdAt}`} href={item.href} onClick={() => markRead(item)} className={`block border-b border-white/10 p-4 last:border-0 hover:bg-white/5 ${item.readAt ? "" : "bg-cyan-400/5"}`}><p className="font-medium text-white">{item.title}</p><p className="mt-1 text-sm text-slate-400">{item.body}</p><p className="mt-2 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</p></Link>) : <p className="p-6 text-center text-slate-400">No planning activity yet.</p>}</div>}</div></AppShell>;
}
