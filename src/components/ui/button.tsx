// src/components/ui/button.tsx — shadcn-style primitive (Tailwind, cva)
// Aegean Premium spec §7.1: primary aegean-600 (hover aegean-700 + lift),
// 150ms transforms, focus ring 2px with 2px offset, disabled 45% opacity.
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Shared base: height by size, radius-sm, 600 weight, 150ms transitions
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-[transform,box-shadow,background-color,border-color,color,opacity] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aegean-600 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-aegean-600 text-white hover:bg-aegean-700 hover:shadow-sm hover:-translate-y-px active:translate-y-0",
        secondary:
          "border border-line-strong bg-surface text-ink-900 hover:border-ink-500",
        outline:
          "border border-line-strong bg-transparent text-ink-900 hover:border-ink-500 hover:bg-sunken",
        ghost: "text-aegean-600 hover:bg-aegean-100",
        destructive:
          "bg-danger-600 text-white hover:bg-danger-600/90 hover:shadow-sm",
        // White CTA for ink-900 bands (stats band, final CTA)
        onDark:
          "bg-surface text-ink-900 hover:shadow-md hover:-translate-y-px active:translate-y-0",
        ghostOnDark:
          "text-white/80 hover:bg-white/10 hover:text-white",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-[13px]",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
