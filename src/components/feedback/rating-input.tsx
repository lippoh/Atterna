// src/components/feedback/rating-input.tsx — public QR star control (§9.7)
// Five 56px touch targets in a row; radio-group semantics with arrow-key
// support and per-star aria labels («Τέλεια» … «Πολύ κακή»). Hover scales
// the star to 1.08; selection fills star-400 with a 200ms pop and shows
// the label under. Never color-only: weight + fill + label.
"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import { IconStar, IconStarFilled } from "@/components/ui/icons";

export interface RatingInputProps {
  value: number | null;
  onChange: (rating: number) => void;
  labels: {
    low: string;
    high: string;
    question: string;
    starLabels: string[];
  };
}

export function RatingInput({ value, onChange, labels }: RatingInputProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusStar = (n: number) => {
    const el = refs.current[n - 1];
    el?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent, n: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(5, n + 1);
      onChange(next);
      focusStar(next);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      const prev = Math.max(1, n - 1);
      onChange(prev);
      focusStar(prev);
    }
  };

  const selectedLabel = value ? labels.starLabels[value - 1] : null;

  return (
    <div className="space-y-3">
      <p
        id="rating-question"
        className="text-center font-display text-2xl font-semibold leading-tight text-ink-900"
      >
        {labels.question}
      </p>
      <div
        role="radiogroup"
        aria-labelledby="rating-question"
        className="flex justify-center gap-1.5 sm:gap-2"
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const active = value === n;
          const filled = value !== null && n <= value;
          return (
            <button
              key={n}
              ref={(el) => {
                refs.current[n - 1] = el;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={labels.starLabels[n - 1] ?? String(n)}
              onClick={() => onChange(n)}
              onKeyDown={(e) => onKeyDown(e, n)}
              className={cn(
                "flex size-14 items-center justify-center rounded-md transition-transform duration-150 ease-out hover:scale-[1.08] focus-visible:scale-[1.08] active:scale-95 sm:size-16",
                active && "star-pop"
              )}
            >
              {filled ? (
                <IconStarFilled className="size-9 text-star-400 sm:size-10" />
              ) : (
                <IconStar className="size-9 text-ink-300 sm:size-10" />
              )}
            </button>
          );
        })}
      </div>
      {/* the chosen label appears under the row */}
      <p className="h-6 text-center text-sm font-semibold text-ink-700" aria-live="polite">
        {selectedLabel ?? ""}
      </p>
    </div>
  );
}
