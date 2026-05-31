"use client";

import { ArrowRight, CalendarDays, Users } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/movie-club/app-shell";
import { Button } from "@/components/ui/button";

export default function ClubsPage() {
  const clubId = process.env.NEXT_PUBLIC_DEFAULT_CLUB_ID || "the-cinephiles";
  const clubName = process.env.NEXT_PUBLIC_DEFAULT_CLUB_NAME || "The Cinephiles";

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-8 border-b border-white/10 pb-6">
          <p className="mb-2 flex items-center gap-2 text-sm text-cyan-300">
            <Users className="size-4" />
            Your clubs
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-white">Choose a movie club</h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            The MVP uses the seeded club membership records from DynamoDB. Add more clubs when the backend exposes a club list endpoint.
          </p>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Link
            href={`/clubs/${clubId}`}
            className="rounded-lg border border-violet-400/25 bg-slate-900/80 p-5 shadow-2xl shadow-black/20 transition hover:border-cyan-300/40"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">{clubName}</h2>
                <p className="mt-2 text-sm text-slate-400">Seeded MVP club</p>
              </div>
              <div className="rounded-full bg-violet-400/15 p-2 text-violet-200">
                <CalendarDays className="size-5" />
              </div>
            </div>
            <Button className="mt-8 w-full bg-violet-500 text-white hover:bg-violet-600">
              Open active night
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
