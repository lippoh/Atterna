// src/components/dashboard/insight-card.tsx — the What/Why/Do card
// Every AI insight renders the same three-line structure; evidence,
// confidence and a curated playbook action — never free-form model
// output (Section 15).
import { cn } from "@/lib/utils";
import type { Insight } from "@/lib/metrics";
const SEVERITY: Record<Insight["severity"], { border: string; badge: string; badgeText: string
}> = {
info: { border: "border-line", badge: "bg-aegean-100 text-aegean-700", badgeText: "INFO" },
warning: { border: "border-line", badge: "bg-terracotta-100 text-terracotta-500", badgeText: "WATCH" },
critical: { border: "border-danger-600/30", badge: "bg-danger-100 text-danger-600", badgeText: "ACT" },
};
export function InsightCard({ insight }: { insight: Insight }) {
const s = SEVERITY[insight.severity];
return (
<div className={cn("rounded-lg border bg-surface p-5 shadow-xs", s.border)}>
<div className="flex items-center justify-between gap-2">
<p className="text-sm font-semibold text-ink-900">{insight.title}</p>
<span className={cn("rounded-full px-2 py-1 text-[10px] font-bold tracking-wide", s.badge)}>
{s.badgeText} · {insight.confidence}
</span>
</div>
<p className="mt-2 text-xs leading-6 text-ink-500">{insight.evidence}</p>
<p className="mt-3 text-sm font-semibold text-aegean-600">{insight.suggestedAction} →</p>
</div>
);
}