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
const TONES: Record<MetricCardProps["tone"], { card: string; value: string; dot: string; word: string }> = {
good: {
card: "border-line bg-surface",
value: "text-ink-900",
dot: "bg-success-600",
word: "text-success-600",
},
warn: {
card: "border-line bg-surface",
value: "text-ink-900",
dot: "bg-star-400",
word: "text-terracotta-500",
},
bad: {
card: "border-line bg-surface",
value: "text-ink-900",
dot: "bg-danger-600",
word: "text-danger-600",
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
<div className={cn("rounded-lg border p-5 shadow-xs", t.card)}>
<div className="flex items-center gap-2">
<span className={cn("h-2.5 w-2.5 rounded-full", t.dot)} aria-hidden="true" />
<p className="text-[13px] font-medium text-ink-500">{label}</p>
</div>
<p className={cn("mt-3 font-mono text-3xl font-medium leading-tight tabular-nums", t.value)}>{value}</p>
<p className={cn("mt-1 text-[11px] font-medium", t.word)}>{word}</p>
{hint && <p className="mt-2 text-[11px] leading-snug text-ink-500">{hint}</p>}
</div>
);
}