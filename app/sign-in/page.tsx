"use client";

import { Film, Loader2, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";

export default function SignInPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/clubs");
    }
  }, [isAuthenticated, isLoading, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await signIn(email, password);
      router.replace("/clubs");
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

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

        <form onSubmit={handleSubmit} className="flex flex-col justify-center p-8">
          <div className="mb-8">
            <p className="text-sm text-slate-400">Welcome back</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">Sign in</h2>
          </div>

          <div className="space-y-4">
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

            <Button type="submit" disabled={isSubmitting} className="w-full bg-violet-500 text-white hover:bg-violet-600">
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
              Sign in
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
