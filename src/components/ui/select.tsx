// src/components/ui/select.tsx — native select primitive
// §7.2: matches Input metrics (h-10, surface, line-strong, radius-sm,
// aegean focus ring). Native <select> keeps OS picker behavior on mobile
// and full keyboard support — no custom dropdown.
import * as React from "react";
import { cn } from "@/lib/utils";

const Select = React.forwardRef<
  HTMLSelectElement,
  React.ComponentProps<"select">
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-10 w-full appearance-none rounded-md border border-line-strong bg-surface bg-[url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%2366788b%27 stroke-width=%272%27 stroke-linecap=%27round%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E')] bg-[position:right_0.75rem_center] bg-no-repeat py-2 pl-3 pr-9 text-sm text-ink-900 transition-[border-color,box-shadow] duration-150 focus-visible:border-aegean-600 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-aegean-100 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export { Select };
