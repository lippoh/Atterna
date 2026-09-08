// src/components/ui/input.tsx — input primitive
// §7.2: h-10, surface bg, line-strong border, radius-sm; focus shows
// aegean border + soft 3px aegean-100 outer ring. Labels live above the
// field in the pages, never floating.
import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink-900 transition-[border-color,box-shadow] duration-150 placeholder:text-ink-300 focus-visible:border-aegean-600 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-aegean-100 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger-600",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
