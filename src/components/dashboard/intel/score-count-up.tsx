// src/components/dashboard/intel/score-count-up.tsx — animated health
// score (Stage H, spec item 4): CountUp eases 0→score over 600ms with
// tabular-nums; prefers-reduced-motion renders the final value instantly
// (handled inside CountUp). Client island: only the number hydrates.
"use client";

import { CountUp } from "@/components/ui/count-up";

export function ScoreCountUp({ score, className }: { score: number; className?: string }) {
  return <CountUp to={score} decimals={0} className={className} />;
}
