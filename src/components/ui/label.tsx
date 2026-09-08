// src/components/ui/label.tsx — shadcn-style label primitive
import * as React from "react";
import { cn } from "@/lib/utils";
const Label = React.forwardRef<HTMLLabelElement, React.ComponentProps<"label">>(
({ className, ...props }, ref) => (
<label
ref={ref}
className={cn("text-[13px] font-medium leading-5 text-ink-700", className)}
{...props}
/>
)
);
Label.displayName = "Label";
export { Label };