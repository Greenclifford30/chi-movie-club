"use client";

import { Film, Loader2, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

export function ProtectedPage({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/sign-in");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <main className="grid min-h-screen place-items-center text-slate-200">
        <div className="flex items-center gap-3">
          <Loader2 className="size-5 animate-spin text-cyan-300" />
          <span>Loading Movie Club...</span>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const params = useParams<{ clubId?: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { email, signOut } = useAuth();
  const clubId = params.clubId || process.env.NEXT_PUBLIC_DEFAULT_CLUB_ID;

  const links = clubId
    ? [
        { href: `/clubs/${clubId}`, label: "Active Night" },
        { href: `/clubs/${clubId}/history`, label: "History" },
        { href: `/clubs/${clubId}/admin`, label: "Admin" },
      ]
    : [];

  return (
    <ProtectedPage>
      <main className="min-h-screen text-slate-50">
        <header className="sticky top-0 z-50 border-b border-white/10 bg-[#111827]/90 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-6">
              <Link href="/clubs" className="flex items-center gap-2 font-semibold tracking-tight text-white">
                <Film className="size-5" />
                <span>Movie Club</span>
              </Link>
              <nav className="hidden items-center gap-4 text-sm md:flex">
                {links.map((link) => {
                  const active = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={active ? "border-b border-white pb-1 font-medium text-white" : "text-slate-400 transition hover:text-white"}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button asChild variant="ghost" size="icon" title="Account settings">
                <Link href="/settings">
                  <Settings className="size-4" />
                  <span className="sr-only">Account settings</span>
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title={email ? `Sign out ${email}` : "Sign out"}
                onClick={() => {
                  signOut();
                  router.replace("/sign-in");
                }}
              >
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>
        </header>
        {children}
      </main>
    </ProtectedPage>
  );
}
