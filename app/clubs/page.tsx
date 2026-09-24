"use client";

import { ArrowRight, CalendarDays, Loader2, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/movie-club/app-shell";
import { PageSkeleton } from "@/components/movie-club/page-skeleton";
import { EmptyState } from "@/components/movie-club/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { createClub, listClubs, MovieClubApiError } from "@/lib/movie-club-api";
import type { Club } from "@/lib/movie-club-types";

export default function ClubsPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isLoadingClubs, setIsLoadingClubs] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [clubId, setClubId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    const authToken = token;
    let cancelled = false;
    async function loadClubs() {
      setIsLoadingClubs(true);
      setError(null);
      try {
        const result = await listClubs(authToken);
        if (!cancelled) {
          setClubs(result.clubs);
          setIsPlatformAdmin(result.isPlatformAdmin);
        }
      } catch (clubsError) {
        if (!cancelled) {
          setError(errorMessage(clubsError, "Unable to load your clubs."));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingClubs(false);
        }
      }
    }

    loadClubs();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleCreateClub(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !name.trim()) {
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      const result = await createClub(token, {
        name: name.trim(),
        ...(clubId.trim() ? { clubId: clubId.trim() } : {}),
      });
      router.push(`/clubs/${encodeURIComponent(result.club.clubId)}`);
    } catch (createError) {
      setError(errorMessage(createError, "Unable to create club."));
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <AppShell>
      <div className="mc-page">
        <section className="mb-8 flex flex-col gap-6 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm text-cyan-300">
              <Users className="size-4" />
              Your clubs
            </p>
            <h1 className="mc-title">Choose a movie club</h1>
            <p className="mt-2 max-w-2xl text-slate-400">
              Your groups, their next plans, and the people going with you.
            </p>
          </div>

          {isPlatformAdmin ? (
            <form onSubmit={handleCreateClub} className="grid gap-3 rounded-lg border border-white/10 bg-slate-900/80 p-4 sm:min-w-[420px] sm:grid-cols-[1fr_0.8fr_auto]">
              <Field label="Club name">
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Friday Night Films"
                  required
                  className="border-white/10 bg-white/5 text-white"
                />
              </Field>
              <Field label="Club ID">
                <Input
                  value={clubId}
                  onChange={(event) => setClubId(event.target.value)}
                  placeholder="optional"
                  className="border-white/10 bg-white/5 text-white"
                />
              </Field>
              <Button type="submit" disabled={isCreating || !name.trim()} className="self-end bg-violet-400 text-slate-950 hover:bg-violet-300">
                {isCreating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Create
              </Button>
            </form>
          ) : null}
        </section>

        {error ? <Alert>{error}</Alert> : null}

        {isLoadingClubs ? (
          <PageSkeleton label="Loading clubs" />
        ) : clubs.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {clubs.map((club) => (
              <Link
                key={club.clubId}
                href={`/clubs/${encodeURIComponent(club.clubId)}`}
                className="group flex flex-col justify-between rounded-xl border border-white/10 bg-[#141b29] p-6 transition hover:-translate-y-0.5 hover:border-violet-300/40 hover:bg-[#192235] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-white">{club.name}</h2>
                    <p className="mt-2 text-sm text-slate-400">
                      {club.role ? `${club.role.charAt(0).toUpperCase()}${club.role.slice(1)}` : "Member"}
                      {club.memberCount !== undefined ? ` · ${club.memberCount} members` : ""}
                    </p>
                    {club.activeStatus ? <p className="mt-5 text-xs font-semibold uppercase tracking-[.12em] text-violet-200">{club.activeStatus === "voting" ? "Voting open" : club.activeStatus === "confirmed" ? "Plan confirmed" : club.activeStatus === "planning" ? "Planning" : club.activeStatus}</p> : null}
                  </div>
                  <div className="rounded-md bg-violet-400/10 p-2 text-violet-200">
                    <CalendarDays className="size-5" />
                  </div>
                </div>
                <span className="mt-8 flex items-center gap-2 text-sm font-semibold text-violet-200 transition group-hover:gap-3">Open club <ArrowRight className="size-4" /></span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="No clubs yet" description="Ask a club admin for an invite link, or create a club if your account has platform admin access." />
        )}
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">{children}</div>;
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof MovieClubApiError) {
    if (error.status === 401) {
      return "Sign in is required.";
    }
    if (error.status === 403) {
      return error.message || "You do not have permission to do that.";
    }
    if (error.status === 409) {
      return "That club ID is already in use.";
    }
    return error.message;
  }

  return error instanceof Error ? error.message : fallback;
}
