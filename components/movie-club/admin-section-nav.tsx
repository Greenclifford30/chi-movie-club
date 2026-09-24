"use client";

export type AdminSection = "setup" | "showtimes" | "voting" | "people";

const sections: { id: AdminSection; label: string; description: string }[] = [
  { id: "setup", label: "Setup", description: "Movie and planning" },
  { id: "showtimes", label: "Showtimes", description: "Find and approve" },
  { id: "voting", label: "Voting & plan", description: "Decide and confirm" },
  { id: "people", label: "People", description: "Members and invites" },
];

export function AdminSectionNav({ active, onChange }: { active: AdminSection; onChange: (section: AdminSection) => void }) {
  return (
    <nav aria-label="Admin sections" className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {sections.map((section, index) => (
        <button
          key={section.id}
          type="button"
          aria-current={active === section.id ? "step" : undefined}
          onClick={() => onChange(section.id)}
          className={`min-h-16 rounded-lg border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${active === section.id ? "border-violet-300/50 bg-violet-400/10 text-white" : "border-white/10 bg-white/[.03] text-slate-300 hover:border-white/20 hover:bg-white/[.06]"}`}
        >
          <span className="block text-[11px] font-medium uppercase tracking-[.14em] text-slate-500">0{index + 1}</span>
          <span className="mt-1 block text-sm font-semibold">{section.label}</span>
          <span className="hidden text-xs text-slate-400 lg:block">{section.description}</span>
        </button>
      ))}
    </nav>
  );
}
