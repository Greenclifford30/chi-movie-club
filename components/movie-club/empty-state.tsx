"use client";

import { ArrowRight, Film } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  description,
  action,
  icon,
  className = "",
}: {
  title: string;
  description: string;
  action?: { label: string; href?: string; onClick?: () => void };
  icon?: React.ReactNode;
  className?: string;
}) {
  const actionButton = action?.href ? (
    <Button asChild className="mt-5 bg-violet-400 text-slate-950 hover:bg-violet-300">
      <Link href={action.href}>
        {action.label}
        <ArrowRight className="size-4" />
      </Link>
    </Button>
  ) : action?.onClick ? (
    <Button onClick={action.onClick} className="mt-5 bg-violet-400 text-slate-950 hover:bg-violet-300">
      {action.label}
      <ArrowRight className="size-4" />
    </Button>
  ) : null;

  return (
    <section className={`mc-panel p-7 sm:p-9 ${className}`}>
      <div className="mb-4 flex size-11 items-center justify-center rounded-lg bg-violet-400/10 text-violet-100">
        {icon || <Film className="size-5" />}
      </div>
      <h2 className="text-xl font-semibold tracking-tight text-white">{title}</h2>
      <p className="mt-2 max-w-prose text-sm leading-6 text-slate-300">{description}</p>
      {actionButton}
    </section>
  );
}
