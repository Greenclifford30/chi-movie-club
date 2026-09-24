export function PageSkeleton({ variant = "list", label = "Loading" }: { variant?: "list" | "movie" | "admin" | "form"; label?: string }) {
  return (
    <section aria-label={label} aria-busy="true" className="space-y-6">
      <span className="sr-only">{label}</span>
      {variant === "movie" ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(17rem,1fr)]">
          <div className="mc-panel overflow-hidden md:grid md:grid-cols-[15rem_1fr]">
            <div className="mc-skeleton h-64 rounded-none md:h-96" />
            <div className="space-y-5 p-6"><div className="mc-skeleton h-4 w-24" /><div className="mc-skeleton h-10 w-4/5" /><div className="mc-skeleton h-4 w-full" /><div className="mc-skeleton h-4 w-2/3" /></div>
          </div>
          <div className="mc-panel space-y-5 p-6"><div className="mc-skeleton h-5 w-1/2" /><div className="mc-skeleton h-12 w-full" /><div className="mc-skeleton h-12 w-full" /><div className="mc-skeleton h-11 w-full" /></div>
        </div>
      ) : variant === "admin" ? (
        <><div className="mc-panel space-y-4 p-6"><div className="mc-skeleton h-8 w-1/3" /><div className="mc-skeleton h-4 w-2/3" /><div className="grid gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="mc-skeleton h-16" />)}</div></div><div className="mc-panel h-80 p-6"><div className="mc-skeleton h-5 w-1/4" /></div></>
      ) : variant === "form" ? (
        <div className="mc-panel max-w-3xl space-y-5 p-6"><div className="mc-skeleton h-6 w-1/3" /><div className="mc-skeleton h-12 w-full" /><div className="mc-skeleton h-12 w-full" /><div className="mc-skeleton h-12 w-1/3" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="mc-panel space-y-5 p-5"><div className="mc-skeleton h-6 w-2/3" /><div className="mc-skeleton h-4 w-1/3" /><div className="mc-skeleton mt-8 h-10 w-full" /></div>)}</div>
      )}
    </section>
  );
}
