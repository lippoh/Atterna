// src/components/dashboard/metric-card.tsx — traffic-light dashboard card
// Server component (no client water). Tone colors pair with labels —
// color is never the only signal (UX principles, Table 11.1).
import { cn } from "@/lib/utils";
export interface MetricCardProps {
tone: "good" | "warn" | "bad";
label: string;
value: string;
hint?: string;
}
const TONES: Record<MetricCardProps["tone"], { card: string; value: string; dot: string; word:
string }> = {
good: {
card: "border-emerald-200 bg-emerald-50",
value: "text-emerald-800",
dot: "bg-emerald-500",
word: "text-emerald-700",
},
warn: {
card: "border-amber-200 bg-amber-50",
value: "text-amber-800",
dot: "bg-amber-500",
word: "text-amber-700",
},
bad: {
card: "border-rose-200 bg-rose-50",
value: "text-rose-800",
dot: "bg-rose-500",
word: "text-rose-700",
},
};
const TONE_WORDS: Record<MetricCardProps["tone"], { el: string; en: string }> = {
good: { el: "καλά", en: "good" },
warn: { el: "προσοχή", en: "watch" },
bad: { el: "άμεση ενέργεια", en: "act now" },
};
export function MetricCard({ tone, label, value, hint, locale = "el" }: MetricCardProps & {
locale?: string }) {
const t = TONES[tone];
const word = locale === "en" ? TONE_WORDS[tone].en : TONE_WORDS[tone].el;
return (
<div className={cn("rounded-xl border p-4", t.card)}>
<div className="flex items-center gap-2">
<span className={cn("h-2.5 w-2.5 rounded-full", t.dot)} aria-hidden="true" />
<p className="text-xs font-medium text-slate-600">{label}</p>
</div>
<p className={cn("mt-2 text-2xl font-bold leading-tight", t.value)}>{value}</p>
<p className={cn("mt-1 text-[11px] font-medium", t.word)}>{word}</p>
{hint && <p className="mt-1 text-[11px] leading-snug text-slate-500">{hint}</p>}
</div>
);
}