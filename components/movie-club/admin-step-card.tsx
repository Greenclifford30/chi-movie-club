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
    current: "border-violet-300/30 bg-[#141b29]",
    complete: "border-white/10 bg-[#141b29]",
    waiting: "border-white/10 bg-[#141b29]",
    blocked: "border-amber-300/25 bg-[#141b29]",
  };

  return (
    <Card className={`py-6 ${statusClasses[status]} ${className}`}>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-violet-300">{step}</p>
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
