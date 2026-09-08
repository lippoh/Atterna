// src/components/ui/label.tsx — field label primitive
// §7.2: labels sit above inputs — 13px, Inter 500, ink-700.
import * as React from "react";
import { cn } from "@/lib/utils";

const Label = React.forwardRef<HTMLLabelElement, React.ComponentProps<"label">>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "text-[13px] font-medium leading-none text-ink-700 peer-disabled:opacity-45",
        className
      )}
      {...props}
    />
  )
);
Label.displayName = "Label";

export { Label };
