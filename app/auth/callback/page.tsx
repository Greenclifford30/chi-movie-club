"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackShell message="Completing Google sign-in..." />}>
      <AuthCallbackContent />
    </Suspense>
  );
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { completeHostedUiSignIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const hasCompleted = useRef(false);

  useEffect(() => {
    if (hasCompleted.current) {
      return;
    }
    hasCompleted.current = true;

    async function completeSignIn() {
      const providerError = searchParams.get("error_description") || searchParams.get("error");
      if (providerError) {
        setError(providerError);
        return;
      }

      const code = searchParams.get("code");
      const state = searchParams.get("state");
      if (!code || !state) {
        setError("Google sign-in did not return the expected authorization code.");
        return;
      }

      try {
        const redirect = await completeHostedUiSignIn(code, state);
        router.replace(redirect);
      } catch (callbackError) {
        setError(callbackError instanceof Error ? callbackError.message : "Unable to complete Google sign-in.");
      }
    }

    completeSignIn();
  }, [completeHostedUiSignIn, router, searchParams]);

  if (error) {
    return (
      <CallbackShell message="Google sign-in failed">
        <div className="mt-4 rounded-lg border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">
          <div className="flex gap-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p>{error}</p>
          </div>
        </div>
        <Button asChild className="mt-5 w-full bg-violet-500 text-white hover:bg-violet-600">
          <Link href="/sign-in">Back to sign in</Link>
        </Button>
      </CallbackShell>
    );
  }

  return <CallbackShell message="Completing Google sign-in..." />;
}

function CallbackShell({ children, message }: { children?: React.ReactNode; message: string }) {
  const hasError = Boolean(children);

  return (
    <main className="grid min-h-screen place-items-center px-4 text-slate-50">
      <section className="w-full max-w-md rounded-lg border border-white/10 bg-slate-900/85 p-8 shadow-2xl shadow-black/40">
        <div className="flex items-center gap-3">
          {hasError ? <AlertCircle className="size-5 text-rose-200" /> : <Loader2 className="size-5 animate-spin text-cyan-300" />}
          <div>
            <p className="text-sm text-slate-400">Movie Club</p>
            <h1 className="text-xl font-semibold text-white">{message}</h1>
          </div>
        </div>
        {children}
      </section>
    </main>
  );
}
