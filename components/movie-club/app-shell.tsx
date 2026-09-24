"use client";

import { ArrowLeft, CalendarDays, Film, History, Loader2, LogOut, Settings, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { NotificationBell } from "@/components/movie-club/notification-bell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { listClubs } from "@/lib/movie-club-api";
import type { Club } from "@/lib/movie-club-types";

export function ProtectedPage({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/sign-in");
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <main className="mc-page mx-auto max-w-5xl" aria-busy="true">
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <Loader2 className="size-4 animate-spin text-violet-300" aria-hidden="true" />
          Loading Movie Club
        </div>
        <div className="mc-skeleton mt-8 h-32 w-full" />
        <div className="mc-skeleton mt-5 h-72 w-full" />
      </main>
    );
  }

  return <>{children}</>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const params = useParams<{ clubId?: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { email, token, signOut } = useAuth();
  const clubId = params.clubId || process.env.NEXT_PUBLIC_DEFAULT_CLUB_ID;
  const [club, setClub] = useState<Club | null>(null);

  useEffect(() => {
    if (!token || !clubId) return;
    let cancelled = false;
    setClub(null);
    listClubs(token)
      .then(({ clubs }) => {
        if (!cancelled) setClub(clubs.find((item) => item.clubId === clubId) || null);
      })
      .catch(() => {
        // Club pages still work when the optional navigation lookup fails.
      });
    return () => { cancelled = true; };
  }, [token, clubId]);

  const navigation = clubId ? [
    { href: `/clubs/${clubId}`, label: "Active night", shortLabel: "Active", icon: CalendarDays },
    { href: `/clubs/${clubId}/history`, label: "History", shortLabel: "History", icon: History },
    ...(club?.role === "admin" || !club ? [{ href: `/clubs/${clubId}/admin`, label: "Manage", shortLabel: "Manage", icon: ShieldCheck }] : []),
  ] : [];

  return (
    <ProtectedPage>
      <a href="#main-content" className="sr-only fixed left-4 top-4 z-[60] rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-950 focus:not-sr-only">
        Skip to content
      </a>
      <div className="min-h-dvh pb-[calc(4.5rem+env(safe-area-inset-bottom))] text-slate-50 md:pb-0">
        <header className="sticky top-0 z-50 border-b border-white/[.08] bg-[#0b101c]/95 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-5">
              <Link href="/clubs" className="flex shrink-0 items-center gap-2 text-sm font-semibold tracking-tight text-white transition hover:text-violet-200" aria-label="Movie Club, all clubs">
                <span className="grid size-8 place-items-center rounded-md bg-violet-400/15 text-violet-200"><Film className="size-4" /></span>
                <span className="hidden sm:inline">Movie Club</span>
              </Link>
              {clubId ? (
                <Link href="/clubs" className="flex min-w-0 items-center gap-2 border-l border-white/10 pl-4 text-sm text-slate-300 transition hover:text-white" title="Switch club">
                  <ArrowLeft className="size-3.5 shrink-0 text-slate-500" />
                  <span className="truncate font-medium">{club?.name || "All clubs"}</span>
                </Link>
              ) : null}
              {navigation.length ? (
                <nav aria-label="Club pages" className="ml-2 hidden items-center gap-1 lg:flex">
                  {navigation.map((item) => {
                    const active = pathname === item.href;
                    return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`rounded-md px-3 py-2 text-sm font-medium transition ${active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>{item.label}</Link>;
                  })}
                </nav>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <NotificationBell />
              <Button asChild variant="ghost" size="icon" title="Account settings" className={pathname === "/settings" ? "bg-white/10 text-white" : "text-slate-300"}>
                <Link href="/settings"><Settings className="size-4" /><span className="sr-only">Account settings</span></Link>
              </Button>
              <Button variant="ghost" size="icon" title={email ? `Sign out ${email}` : "Sign out"} className="text-slate-300" onClick={() => { signOut(); router.replace("/sign-in"); }}>
                <LogOut className="size-4" /><span className="sr-only">Sign out</span>
              </Button>
            </div>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="outline-none">{children}</main>
        {navigation.length ? (
          <nav aria-label="Club navigation" className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0b101c]/97 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
            <div className="mx-auto grid h-[4.5rem] max-w-lg grid-flow-col auto-cols-fr px-2">
              <MobileLink href="/clubs" label="Clubs" icon={Film} active={pathname === "/clubs"} />
              {navigation.map((item) => <MobileLink key={item.href} href={item.href} label={item.shortLabel} icon={item.icon} active={pathname === item.href} />)}
            </div>
          </nav>
        ) : null}
      </div>
    </ProtectedPage>
  );
}

function MobileLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof Film; active: boolean }) {
  return <Link href={href} aria-current={active ? "page" : undefined} className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg text-xs font-medium transition ${active ? "text-violet-200" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
    <Icon className="size-5" /><span>{label}</span>
  </Link>;
}
