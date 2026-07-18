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
    <Button asChild className="mt-5 bg-violet-500 text-white hover:bg-violet-600">
      <Link href={action.href}>
        {action.label}
        <ArrowRight className="size-4" />
      </Link>
    </Button>
  ) : action?.onClick ? (
    <Button onClick={action.onClick} className="mt-5 bg-violet-500 text-white hover:bg-violet-600">
      {action.label}
      <ArrowRight className="size-4" />
    </Button>
  ) : null;

  return (
    <section className={`rounded-lg border border-white/10 bg-slate-900/70 p-6 ${className}`}>
      <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-violet-400/15 text-violet-100">
        {icon || <Film className="size-5" />}
      </div>
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-2 max-w-2xl text-sm text-slate-300">{description}</p>
      {actionButton}
    </section>
  );
}
