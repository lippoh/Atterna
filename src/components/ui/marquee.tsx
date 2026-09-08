// src/components/ui/marquee.tsx — infinite CSS marquee (brief §8.2)
// Server-safe (no JS): the track holds two identical groups and animates
// translateX(-50%) for a seamless loop. Hover pauses (animation-play-state).
// Edge masks fade the rows in/out. Reduced motion: animation pinned off in
// globals.css and the row becomes a horizontally scrollable strip.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Marquee({
  children,
  className,
  reverse = false,
  duration = 42,
  itemClassName,
}: {
  children: ReactNode;
  className?: string;
  /** Reverse direction (right → left becomes left → right). */
  reverse?: boolean;
  /** Seconds for one full loop. */
  duration?: number;
  itemClassName?: string;
}) {
  return (
    <div className={cn("marquee-mask overflow-hidden", className)}>
      <div
        className={cn("marquee-track", reverse && "marquee-reverse")}
        style={{ "--marquee-duration": `${duration}s` } as React.CSSProperties}
      >
        <div className={cn("marquee-group", itemClassName)}>{children}</div>
        <div className={cn("marquee-group", itemClassName)} aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}
