"use client";

import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function AdminStepCard({
  step,
  title,
  description,
  status = "waiting",
  children,
  className = "",
}: {
  step: string;
  title: string;
  description: string;
  status?: "current" | "complete" | "waiting" | "blocked";
  children: React.ReactNode;
  className?: string;
}) {
  const statusClasses = {
    current: "border-cyan-300/30 bg-slate-900/85 shadow-cyan-950/10",
    complete: "border-green-400/25 bg-slate-900/80 shadow-green-950/10",
    waiting: "border-white/10 bg-slate-900/80 shadow-black/20",
    blocked: "border-amber-300/25 bg-slate-900/80 shadow-amber-950/10",
  };

  return (
    <Card className={`py-6 shadow-2xl ${statusClasses[status]} ${className}`}>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-cyan-300">{step}</p>
            <h2 className="mt-2 text-xl font-semibold text-white">{title}</h2>
            <p className="mt-1 text-sm text-slate-400">{description}</p>
          </div>
          {status === "complete" ? <CheckCircle2 className="size-5 shrink-0 text-green-300" /> : null}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
