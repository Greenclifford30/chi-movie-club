"use client";

import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

type StatusAlertTone = "info" | "success" | "warning" | "danger";

const toneClasses: Record<StatusAlertTone, string> = {
  info: "border-cyan-300/30 bg-cyan-400/10 text-cyan-50",
  success: "border-green-400/30 bg-green-500/10 text-green-100",
  warning: "border-amber-300/30 bg-amber-400/10 text-amber-100",
  danger: "border-rose-400/30 bg-rose-500/10 text-rose-100",
};

export function StatusAlert({
  children,
  tone = "info",
  className = "",
}: {
  children: React.ReactNode;
  tone?: StatusAlertTone;
  className?: string;
}) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "danger" || tone === "warning" ? AlertTriangle : Info;

  return (
    <div className={`rounded-lg border p-3 text-sm ${toneClasses[tone]} ${className}`}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
