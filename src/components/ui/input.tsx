// src/components/ui/input.tsx — shadcn-style input primitive
import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-sm border border-line-strong bg-surface px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus-visible:border-aegean-600 focus-visible:ring-2 focus-visible:ring-aegean-100 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";
export { Input };