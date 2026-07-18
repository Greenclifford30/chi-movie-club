"use client";

import { Chrome, Film, Loader2, LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";

export default function SignInPage() {
  return (
    <Suspense fallback={<AuthShellFallback />}>
      <SignInContent />
    </Suspense>
  );
}

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = safeRedirect(searchParams.get("redirect"));
  const { isAuthenticated, isLoading, signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(redirect);
    }
  }, [isAuthenticated, isLoading, redirect, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await signIn(email, password);
      router.replace(redirect);
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setIsGoogleSubmitting(true);

    try {
      await signInWithGoogle(redirect);
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Unable to start Google sign-in.");
      setIsGoogleSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="flex flex-col justify-center p-8">
        <div className="mb-8">
          <p className="text-sm text-slate-400">Welcome back</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">Sign in</h2>
        </div>

        <div className="space-y-4">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting || isGoogleSubmitting}
            onClick={handleGoogleSignIn}
            className="w-full border-white/10 bg-white text-slate-950 hover:bg-slate-100 hover:text-slate-950"
          >
            {isGoogleSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Chrome className="size-4" />}
            Continue with Google
          </Button>

          <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-slate-500">
            <span className="h-px flex-1 bg-white/10" />
            <span>Email</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="border-white/10 bg-white/5 text-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="border-white/10 bg-white/5 text-white"
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          <Button type="submit" disabled={isSubmitting || isGoogleSubmitting} className="w-full bg-violet-500 text-white hover:bg-violet-600">
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
            Sign in
          </Button>

          <p className="text-center text-sm text-slate-400">
            Need an account?{" "}
            <Link href={`/sign-up?redirect=${encodeURIComponent(redirect)}`} className="font-medium text-cyan-200 hover:text-cyan-100">
              Sign up
            </Link>
          </p>
        </div>
      </form>
    </AuthShell>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10 text-slate-50">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-lg border border-white/10 bg-slate-900/80 shadow-2xl shadow-black/40 md:grid-cols-[1.05fr_0.95fr]">
        <div className="flex min-h-[520px] flex-col justify-between bg-[linear-gradient(145deg,rgba(139,92,246,0.22),rgba(34,211,238,0.08))] p-8">
          <div className="flex items-center gap-2 font-semibold">
            <Film className="size-6" />
            <span>Movie Club</span>
          </div>
          <div>
            <p className="mb-3 text-sm font-medium text-cyan-200">Chicago movie nights</p>
            <h1 className="max-w-md text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Plan movie nights without the group-chat chaos.
            </h1>
            <p className="mt-4 max-w-md text-slate-300">
              Sign in with your club account to vote, RSVP, and manage the next screening.
            </p>
          </div>
        </div>
        {children}
      </section>
    </main>
  );
}

function AuthShellFallback() {
  return (
    <main className="grid min-h-screen place-items-center text-slate-200">
      <div className="flex items-center gap-3">
        <Loader2 className="size-5 animate-spin text-cyan-300" />
        Loading...
      </div>
    </main>
  );
}

function safeRedirect(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/clubs";
  }
  return value;
}
