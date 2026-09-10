// src/components/ui/status-chip.tsx — state chip with dot + label
// Color is never the only signal: every tone pairs a status dot with
// text (§7.4). Tones: ok / warn / bad / info / neutral.
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusChipVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium",
  {
    variants: {
      tone: {
        ok: "bg-success-100 text-success-600",
        warn: "bg-terracotta-100 text-terracotta-500",
        bad: "bg-danger-100 text-danger-600",
        info: "bg-aegean-100 text-aegean-600",
        neutral: "bg-sunken text-ink-700",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

export interface StatusChipProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusChipVariants> {
  /** Override the dot color; defaults to currentColor. */
  dotClassName?: string;
}

function StatusChip({ className, tone, dotClassName, children, ...props }: StatusChipProps) {
  return (
    <span className={cn(statusChipVariants({ tone }), className)} {...props}>
      <span aria-hidden="true" className={cn("size-2 rounded-full bg-current", dotClassName)} />
      {children}
    </span>
  );
}

export { StatusChip, statusChipVariants };
