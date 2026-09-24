import { ArrowLeft, Film } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12 text-slate-50">
      <div className="mc-panel w-full max-w-xl p-8 sm:p-12">
        <span className="grid size-12 place-items-center rounded-lg bg-violet-400/10 text-violet-200"><Film className="size-6" /></span>
        <p className="mc-eyebrow mt-8">404 / Scene missing</p>
        <h1 className="mc-title mt-3">This page isn’t showing.</h1>
        <p className="mt-4 max-w-prose leading-7 text-slate-300">The link may have changed, or this movie night may have moved to club history.</p>
        <Link href="/clubs" className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-md bg-violet-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-violet-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><ArrowLeft className="size-4" /> Back to clubs</Link>
      </div>
    </main>
  );
}
