// src/components/ui/badge.tsx — chip primitive
// Sentiment chips pair an 8px dot with the label — color is never the
// only signal (§7.4). Mono language badge + urgency pattern live in the
// feature components; this is the general-purpose tinted chip.
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-aegean-100 text-aegean-700",
        secondary: "bg-sunken text-ink-700",
        outline: "border border-line-strong text-ink-700",
        success: "bg-success-100 text-success-600",
        warning: "bg-terracotta-100 text-terracotta-500",
        destructive: "bg-danger-100 text-danger-600",
        onDark: "bg-white/10 text-white/90",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /** 8px status dot shown before the label (sentiment / job state). */
  dot?: boolean;
  dotClassName?: string;
}

function Badge({ className, variant, dot, dotClassName, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          aria-hidden="true"
          className={cn("size-2 rounded-full bg-current", dotClassName)}
        />
      )}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
