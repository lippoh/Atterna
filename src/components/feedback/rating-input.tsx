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
    <div className="space-y-2">
      <p className="text-center text-base font-semibold text-slate-800">{labels.question}</p>
      <div className="flex justify-center gap-2">
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
                "flex h-14 w-14 flex-col items-center justify-center rounded-2xl border text-2xl transition-all active:scale-95",
                active
                  ? "border-blue-600 bg-blue-600 text-white shadow-md"
                  : "border-slate-300 bg-white text-slate-600 hover:border-blue-400",
              )}
            >
              {n}
              <span className={cn("text-[10px]", active ? "text-blue-100" : "text-slate-400")}>
                {n <= 2 ? "★" : n === 3 ? "★★" : "★★★"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}