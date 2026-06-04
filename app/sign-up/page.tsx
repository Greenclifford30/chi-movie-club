"use client";

import { CheckCircle2, Film, Loader2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";

export default function SignUpPage() {
  return (
    <Suspense fallback={<AuthShellFallback />}>
      <SignUpContent />
    </Suspense>
  );
}

function SignUpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = safeRedirect(searchParams.get("redirect"));
  const { signIn, signUp, confirmSignUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await signUp(email, password);
      setNeedsConfirmation(true);
    } catch (signUpError) {
      setError(signUpError instanceof Error ? signUpError.message : "Unable to create account.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await confirmSignUp(email, code);
      await signIn(email, password);
      router.replace(redirect);
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Unable to confirm account.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell>
      {needsConfirmation ? (
        <form onSubmit={handleConfirm} className="flex flex-col justify-center p-8">
          <div className="mb-8">
            <p className="text-sm text-slate-400">Check your email</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">Confirm account</h2>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 p-3 text-sm text-cyan-100">
              Enter the confirmation code sent to {email.trim().toLowerCase()}.
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Confirmation code</Label>
              <Input
                id="code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
            {error ? <Alert>{error}</Alert> : null}
            <Button type="submit" disabled={isSubmitting || !code.trim()} className="w-full bg-violet-500 text-white hover:bg-violet-600">
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Confirm and continue
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSignUp} className="flex flex-col justify-center p-8">
          <div className="mb-8">
            <p className="text-sm text-slate-400">Join Movie Club</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">Create account</h2>
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
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
            {error ? <Alert>{error}</Alert> : null}
            <Button type="submit" disabled={isSubmitting} className="w-full bg-violet-500 text-white hover:bg-violet-600">
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
              Sign up
            </Button>
            <p className="text-center text-sm text-slate-400">
              Already have an account?{" "}
              <Link href={`/sign-in?redirect=${encodeURIComponent(redirect)}`} className="font-medium text-cyan-200 hover:text-cyan-100">
                Sign in
              </Link>
            </p>
          </div>
        </form>
      )}
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
            <p className="mb-3 text-sm font-medium text-cyan-200">Invited screening</p>
            <h1 className="max-w-md text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Create an account to join your club.
            </h1>
            <p className="mt-4 max-w-md text-slate-300">
              Use the same email address that received the invite.
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

function Alert({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">{children}</div>;
}

function safeRedirect(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/clubs";
  }
  return value;
}
