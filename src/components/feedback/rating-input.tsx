// src/components/feedback/rating-input.tsx — public QR star control
"use client";

import { cn } from "@/lib/utils";

export interface RatingInputProps {
  value: number | null;
  onChange: (rating: number) => void;
  labels: { low: string; high: string; question: string };
}

export function RatingInput({ value, onChange, labels }: RatingInputProps) {
  return (
    <div className="space-y-5">
      <p className="text-center font-display text-2xl font-semibold leading-tight text-ink-900">{labels.question}</p>
      <div className="flex justify-center gap-2" role="radiogroup" aria-label={labels.question}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              aria-label={n <= 2 ? labels.low : n >= 4 ? labels.high : String(n)}
              aria-pressed={active}
              onClick={() => onChange(n)}
              className={cn(
                "flex h-14 w-14 flex-col items-center justify-center rounded-lg border text-2xl transition-all duration-200 hover:scale-105 active:scale-95",
                active
                  ? "border-star-400 bg-star-400 text-white shadow-sm"
                  : "border-line-strong bg-surface text-ink-500 hover:border-aegean-600",
              )}
            >
              <span aria-hidden="true">★</span>
              <span className={cn("text-[10px]", active ? "text-white/80" : "text-ink-300")}>{n}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}