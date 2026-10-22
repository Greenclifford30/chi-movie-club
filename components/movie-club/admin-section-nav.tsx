"use client";

import { useId, useRef } from "react";

export type AdminSection = "setup" | "showtimes" | "voting" | "people";

const sections: { id: AdminSection; label: string; description: string }[] = [
  { id: "setup", label: "Setup", description: "Movie and planning" },
  { id: "showtimes", label: "Showtimes", description: "Find and approve" },
  { id: "voting", label: "Voting & plan", description: "Decide and confirm" },
  { id: "people", label: "People", description: "Members and invites" },
];

export function AdminSectionNav({ active, onChange, summaries = {}, idPrefix = "admin" }: { active: AdminSection; onChange: (section: AdminSection) => void; summaries?: Partial<Record<AdminSection, string>>; idPrefix?: string }) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const labelId = useId();
  return (
    <div role="tablist" aria-labelledby={labelId} className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <span id={labelId} className="sr-only">Admin sections</span>
      {sections.map((section, index) => (
        <button
          key={section.id}
          type="button"
          ref={element => { tabs.current[index] = element; }}
          role="tab"
          id={`${idPrefix}-tab-${section.id}`}
          aria-controls={`${idPrefix}-panel-${section.id}`}
          aria-selected={active === section.id}
          tabIndex={active === section.id ? 0 : -1}
          onClick={() => onChange(section.id)}
          onKeyDown={event => {
            const next = event.key === "Home" ? 0 : event.key === "End" ? sections.length - 1 : event.key === "ArrowRight" ? (index + 1) % sections.length : event.key === "ArrowLeft" ? (index + sections.length - 1) % sections.length : null;
            if (next === null) return;
            event.preventDefault();
            onChange(sections[next].id);
            tabs.current[next]?.focus();
          }}
          className={`min-h-16 min-w-0 rounded-lg border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${active === section.id ? "border-violet-300/50 bg-violet-400/10 text-white" : "border-white/10 bg-white/[.03] text-slate-300 hover:border-white/20 hover:bg-white/[.06]"}`}
        >
          <span className="block text-sm font-semibold">{section.label}</span>
          <span className="mt-1 block text-xs text-slate-300">{summaries[section.id] || section.description}</span>
        </button>
      ))}
    </div>
  );
}
