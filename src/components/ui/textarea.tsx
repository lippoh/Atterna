// src/components/ui/textarea.tsx — textarea primitive
// §7.2: autosize-friendly (min rows 3-5), same focus treatment as Input.
import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "flex min-h-[88px] w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm leading-relaxed text-ink-900 transition-[border-color,box-shadow] duration-150 placeholder:text-ink-300 focus-visible:border-aegean-600 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-aegean-100 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger-600",
      className
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
