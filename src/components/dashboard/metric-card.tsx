// src/components/dashboard/metric-card.tsx — KPI card (§9.3)
// Server component (no client water). Surface + hairline, small label,
// 2rem tabular metric, tone dot paired with a localized word — color is
// never the only signal (Table 11.1).
import { cn } from "@/lib/utils";

export interface MetricCardProps {
  tone: "good" | "warn" | "bad";
  label: string;
  value: string;
  hint?: string;
}

const TONES: Record<
  MetricCardProps["tone"],
  { dot: string; word: string; metric: string }
> = {
  good: { dot: "bg-success-600", word: "text-success-600", metric: "text-ink-900" },
  warn: { dot: "bg-star-400", word: "text-terracotta-500", metric: "text-ink-900" },
  bad: { dot: "bg-danger-600", word: "text-danger-600", metric: "text-ink-900" },
};

const TONE_WORDS: Record<MetricCardProps["tone"], { el: string; en: string }> = {
  good: { el: "καλά", en: "good" },
  warn: { el: "προσοχή", en: "watch" },
  bad: { el: "άμεση ενέργεια", en: "act now" },
};

export function MetricCard({
  tone,
  label,
  value,
  hint,
  locale = "el",
}: MetricCardProps & { locale?: string }) {
  const t = TONES[tone];
  const word = locale === "en" ? TONE_WORDS[tone].en : TONE_WORDS[tone].el;
  return (
    <div className="rounded-lg border border-line bg-surface p-4 shadow-xs sm:p-5">
      <div className="flex items-center gap-2">
        <span
          className={cn("size-2 shrink-0 rounded-full", t.dot)}
          aria-hidden="true"
        />
        <p className="text-[13px] font-medium text-ink-500">{label}</p>
      </div>
      <p
        className={cn(
          "mt-3 truncate font-display text-2xl font-semibold tabular-nums",
          t.metric
        )}
        title={value}
      >
        {value}
      </p>
      <p className={cn("mt-1 text-[11px] font-semibold tracking-wide", t.word)}>
        {word}
      </p>
      {hint && (
        <p className="mt-1.5 text-[11px] leading-snug text-ink-300">{hint}</p>
      )}
    </div>
  );
}
