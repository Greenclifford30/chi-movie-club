"use client";

import { Bell, CheckCheck, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { listNotifications, markAllNotificationsRead } from "@/lib/movie-club-api";
import { useAuth } from "@/lib/auth-context";
import type { Notification } from "@/lib/movie-club-types";

export function NotificationBell() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { notifications: items } = await listNotifications(token);
      setNotifications(items);
    } catch {
      // Notification availability should not block the rest of the app shell.
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  function toggleOpen() {
    setOpen((wasOpen) => {
      if (!wasOpen) void loadNotifications();
      return !wasOpen;
    });
  }

  const unread = notifications.filter((notification) => !notification.readAt).length;
  async function markAllRead() {
    if (!token) return;
    await markAllNotificationsRead(token);
    setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
  }
  return <div className="relative">
    <Button variant="ghost" size="icon" title="Notifications" onClick={toggleOpen}>
      <Bell className="size-4" /><span className="sr-only">Notifications</span>
      {unread ? <span className="absolute right-0 top-0 grid size-4 place-items-center rounded-full bg-cyan-400 text-[10px] font-bold text-slate-950">{unread > 9 ? "9+" : unread}</span> : null}
    </Button>
    {open ? <section className="absolute right-0 top-11 z-[70] w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-white/10 bg-slate-950 shadow-2xl shadow-black/40">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><div><p className="font-semibold text-white">Activity</p><p className="text-xs text-slate-400">Planning updates for your clubs</p></div><Button variant="ghost" size="sm" disabled={!unread} onClick={markAllRead}><CheckCheck className="size-4" />Read all</Button></div>
      <div className="max-h-96 overflow-y-auto">{loading ? <div className="flex items-center gap-2 p-4 text-sm text-slate-400"><Loader2 className="size-4 animate-spin" />Loading updates...</div> : notifications.length ? notifications.slice(0, 8).map((notification) => <Link key={`${notification.notificationId}-${notification.createdAt}`} href={notification.href} onClick={() => setOpen(false)} className={`block border-b border-white/5 px-4 py-3 transition hover:bg-white/5 ${notification.readAt ? "" : "bg-cyan-400/5"}`}><p className="text-sm font-medium text-white">{notification.title}</p><p className="mt-1 text-sm text-slate-400">{notification.body}</p></Link>) : <p className="p-4 text-sm text-slate-400">No planning activity yet.</p>}</div>
      <Link href="/notifications" onClick={() => setOpen(false)} className="block px-4 py-3 text-center text-sm font-medium text-cyan-300 hover:bg-white/5">View all activity</Link>
    </section> : null}
  </div>;
}
