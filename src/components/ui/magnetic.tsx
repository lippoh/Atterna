// src/components/ui/magnetic.tsx — magnetic CTA wrapper (brief §8.2)
// The wrapped element drifts up to 8px toward the cursor while it hovers
// inside the hit area, then springs back. Strength is a fraction of the
// cursor's offset from center. Mouse only; reduced motion disables the
// drift via CSS (transform pinned to none).
"use client";

import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Magnetic({
  children,
  className,
  strength = 0.28,
  distance = 8,
}: {
  children: ReactNode;
  className?: string;
  /** Fraction of the cursor offset applied as translation (0..1). */
  strength?: number;
  /** Maximum translation in px. */
  distance?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const tx = Math.max(-distance, Math.min(distance, dx * strength));
    const ty = Math.max(-distance, Math.min(distance, dy * strength));
    el.style.setProperty("--mag-x", `${tx.toFixed(1)}px`);
    el.style.setProperty("--mag-y", `${ty.toFixed(1)}px`);
  }

  function onPointerLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--mag-x", "0px");
    el.style.setProperty("--mag-y", "0px");
  }

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className={cn("magnetic", className)}
    >
      {children}
    </div>
  );
}
