// src/components/ui/badge.tsx — shadcn-style badge primitive
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-aegean-100 text-aegean-700",
        secondary: "border-transparent bg-sunken text-ink-700",
        success: "border-transparent bg-success-100 text-success-600",
        warning: "border-transparent bg-terracotta-100 text-terracotta-500",
        destructive: "border-transparent bg-danger-100 text-danger-600",
        outline: "border-line-strong text-ink-700",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };