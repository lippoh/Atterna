// src/components/ui/textarea.tsx — shadcn-style textarea primitive
import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "flex min-h-[96px] w-full rounded-sm border border-line-strong bg-surface px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus-visible:border-aegean-600 focus-visible:ring-2 focus-visible:ring-aegean-100 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
export { Textarea };