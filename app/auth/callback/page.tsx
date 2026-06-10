"use client";

import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackShell message="Completing sign-in..." />}>
      <AuthCallbackContent />
    </Suspense>
  );
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { completeGoogleSignIn } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function completeSignIn() {
      const oauthError = searchParams.get("error_description") || searchParams.get("error");
      const code = searchParams.get("code");
      const state = searchParams.get("state");

      if (oauthError) {
        setError(oauthError);
        return;
      }

      if (!code || !state) {
        setError("Google sign-in returned without the required authorization code.");
        return;
      }

      try {
        const redirectPath = await completeGoogleSignIn(code, state);
        if (!cancelled) {
          router.replace(redirectPath);
        }
      } catch (callbackError) {
        if (!cancelled) {
          setError(callbackError instanceof Error ? callbackError.message : "Unable to complete Google sign-in.");
        }
      }
    }

    completeSignIn();
    return () => {
      cancelled = true;
    };
  }, [completeGoogleSignIn, router, searchParams]);

  if (error) {
    return <CallbackShell message={error} isError />;
  }

  return <CallbackShell message="Completing sign-in..." />;
}

function CallbackShell({ message, isError = false }: { message: string; isError?: boolean }) {
  return (
    <main className="grid min-h-screen place-items-center px-4 text-slate-50">
      <div className="w-full max-w-sm rounded-lg border border-white/10 bg-slate-900/80 p-6 text-center shadow-2xl shadow-black/40">
        {isError ? null : <Loader2 className="mx-auto mb-4 size-6 animate-spin text-cyan-300" />}
        <p className={isError ? "text-sm text-rose-100" : "text-sm text-slate-300"}>{message}</p>
      </div>
    </main>
  );
}
