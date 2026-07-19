"use client";

import { CheckCircle2, Film, Loader2, LogOut, Ticket, UserPlus } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { acceptInvite, getInvite, MovieClubApiError } from "@/lib/movie-club-api";
import { formatDate } from "@/lib/movie-club-format";
import type { ClubInvite } from "@/lib/movie-club-types";

type AcceptState = "idle" | "accepting" | "accepted" | "error";

export default function InvitePage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const inviteToken = params.token;
  const { email, token: authToken, isAuthenticated, isLoading: isAuthLoading, signOut } = useAuth();
  const [invite, setInvite] = useState<ClubInvite | null>(null);
  const [isLoadingInvite, setIsLoadingInvite] = useState(true);
  const [acceptState, setAcceptState] = useState<AcceptState>("idle");
  const [error, setError] = useState<string | null>(null);
  const redirectPath = useMemo(() => `/invites/${encodeURIComponent(inviteToken)}`, [inviteToken]);

  useEffect(() => {
    let cancelled = false;
    async function loadInvite() {
      setIsLoadingInvite(true);
      setError(null);
      try {
        const result = await getInvite(inviteToken);
        if (!cancelled) {
          setInvite(result.invite);
        }
      } catch (inviteError) {
        if (!cancelled) {
          setError(inviteErrorMessage(inviteError));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingInvite(false);
        }
      }
    }

    loadInvite();
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated || !authToken || !invite || acceptState !== "idle") {
      return;
    }

    const currentAuthToken = authToken;
    let cancelled = false;
    async function acceptCurrentInvite() {
      setAcceptState("accepting");
      setError(null);
      try {
        const result = await acceptInvite(currentAuthToken, inviteToken);
        if (!cancelled) {
          setAcceptState("accepted");
          router.replace(`/clubs/${encodeURIComponent(result.clubId)}`);
        }
      } catch (acceptError) {
        if (!cancelled) {
          setAcceptState("error");
          setError(inviteErrorMessage(acceptError));
        }
      }
    }

    acceptCurrentInvite();
    return () => {
      cancelled = true;
    };
  }, [acceptState, authToken, invite, inviteToken, isAuthLoading, isAuthenticated, router]);

  const isLoading = isLoadingInvite || isAuthLoading;
  const signedInMismatch = Boolean(
    email && invite?.email && email.trim().toLowerCase() !== invite.email.trim().toLowerCase()
  );

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-4 text-slate-50 sm:py-10">
      <section className="w-full max-w-2xl rounded-lg border border-white/10 bg-slate-900/85 p-5 shadow-2xl shadow-black/40 sm:p-8">
        <div className="mb-8 flex items-center gap-2 font-semibold text-white">
          <Film className="size-6" />
          <span>Movie Club</span>
        </div>

        {isLoading ? (
          <Status icon={<Loader2 className="size-6 animate-spin text-cyan-300" />} title="Loading invite">
            Checking the invite link.
          </Status>
        ) : error && !invite ? (
          <Status icon={<Ticket className="size-6 text-rose-200" />} title="Invite unavailable" tone="rose">
            {error}
          </Status>
        ) : invite ? (
          <div>
            <div className="mb-6">
              <p className="mb-2 flex items-center gap-2 text-sm text-cyan-300">
                <Ticket className="size-4" />
                Club invite
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                Join {invite.clubName || "this movie club"}
              </h1>
              <p className="mt-3 text-slate-300">
                This invite is for <span className="font-medium text-white">{invite.email}</span> and expires {formatDate(invite.expiresAt, "MMM d, yyyy")}.
              </p>
            </div>

            {error ? <Alert>{error}</Alert> : null}

            {!isAuthenticated ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Button asChild className="bg-violet-500 text-white hover:bg-violet-600">
                  <Link href={`/sign-in?redirect=${encodeURIComponent(redirectPath)}`}>
                    <CheckCircle2 className="size-4" />
                    Sign in
                  </Link>
                </Button>
                <Button asChild className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
                  <Link href={`/sign-up?redirect=${encodeURIComponent(redirectPath)}`}>
                    <UserPlus className="size-4" />
                    Sign up
                  </Link>
                </Button>
              </div>
            ) : acceptState === "accepting" ? (
              <div className="flex items-center gap-3 rounded-lg border border-cyan-400/30 bg-cyan-500/10 p-4 text-cyan-100">
                <Loader2 className="size-5 animate-spin" />
                Accepting invite...
              </div>
            ) : signedInMismatch || acceptState === "error" ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-300">
                  Signed in as <span className="font-medium text-white">{email}</span>.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    signOut();
                    router.replace(`/sign-in?redirect=${encodeURIComponent(redirectPath)}`);
                  }}
                  className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                >
                  <LogOut className="size-4" />
                  Sign out
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-green-400/30 bg-green-500/10 p-4 text-green-100">
                <CheckCircle2 className="size-5" />
                Invite accepted. Redirecting...
              </div>
            )}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function Status({
  icon,
  title,
  tone = "slate",
  children,
}: {
  icon: React.ReactNode;
  title: string;
  tone?: "slate" | "rose";
  children: React.ReactNode;
}) {
  const color = tone === "rose" ? "text-rose-100" : "text-slate-300";
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-white/5">{icon}</div>
      <h1 className="text-2xl font-semibold text-white">{title}</h1>
      <p className={`mt-2 ${color}`}>{children}</p>
    </div>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">{children}</div>;
}

function inviteErrorMessage(error: unknown) {
  if (error instanceof MovieClubApiError) {
    if (error.status === 401) {
      return "Sign in is required to accept this invite.";
    }
    if (error.status === 403) {
      return "This invite belongs to a different email address. Sign in with the invited email to accept it.";
    }
    if (error.status === 404) {
      return "This invite link was not found.";
    }
    if (error.status === 409) {
      return "This invite is no longer pending.";
    }
    if (error.status === 410) {
      return "This invite has expired.";
    }
    return error.message;
  }

  return error instanceof Error ? error.message : "Unable to load invite.";
}
