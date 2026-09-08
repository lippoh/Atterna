// src/components/dashboard/insight-card.tsx — the What/Why/Do card
// (§9.3): severity hairline, title + confidence chip, evidence line,
// suggested action with an arrow. Same three-line structure for every
// AI insight — never free-form model output (Section 15).
import { cn } from "@/lib/utils";
import type { Insight } from "@/lib/metrics";
import { IconArrowRight } from "@/components/ui/icons";

const SEVERITY: Record<
  Insight["severity"],
  { border: string; chip: string }
> = {
  info: { border: "border-line", chip: "bg-sunken text-ink-500" },
  warning: { border: "border-star-400/50", chip: "bg-terracotta-100 text-terracotta-500" },
  critical: { border: "border-danger-600/50", chip: "bg-danger-100 text-danger-600" },
};

export function InsightCard({ insight }: { insight: Insight }) {
  const s = SEVERITY[insight.severity];
  return (
    <div className={cn("rounded-lg border bg-surface p-4 shadow-xs sm:p-5", s.border)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[15px] font-semibold leading-snug text-ink-900">
          {insight.title}
        </p>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 font-mono text-[11px] font-medium tabular-nums",
            s.chip
          )}
        >
          {insight.confidence}
        </span>
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500">
        {insight.evidence}
      </p>
      <p className="mt-3 flex items-start gap-2 text-sm font-semibold text-aegean-600">
        <IconArrowRight className="mt-0.5 size-4 shrink-0" />
        {insight.suggestedAction}
      </p>
    </div>
  );
}
