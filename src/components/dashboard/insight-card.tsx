// src/components/dashboard/insight-card.tsx — the What/Why/Do card
// Every AI insight renders the same three-line structure; evidence,
// confidence and a curated playbook action — never free-form model
// output (Section 15).
import { cn } from "@/lib/utils";
import type { Insight } from "@/lib/metrics";
const SEVERITY: Record<Insight["severity"], { border: string; badge: string; badgeText: string
}> = {
info: { border: "border-slate-200", badge: "bg-slate-100 text-slate-700", badgeText: "info" },
warning: { border: "border-amber-200", badge: "bg-amber-100 text-amber-800", badgeText: "⚠" },
critical: { border: "border-rose-200", badge: "bg-rose-100 text-rose-800", badgeText: "!" },
};
export function InsightCard({ insight }: { insight: Insight }) {
const s = SEVERITY[insight.severity];
return (
<div className={cn("rounded-xl border bg-white p-4", s.border)}>
<div className="flex items-center justify-between gap-2">
<p className="text-sm font-semibold text-slate-900">{insight.title}</p>
<span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", s.badge)}>
{insight.confidence}
</span>
</div>
<p className="mt-1 text-xs text-slate-500">{insight.evidence}</p>
<p className="mt-2 text-sm font-medium text-blue-800">→ {insight.suggestedAction}</p>
</div>
);
}