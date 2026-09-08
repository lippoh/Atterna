// src/components/ui/count-up.tsx — rAF-driven count-up (brief §8)
// 600ms, tabular-nums, reduced motion renders the final value instantly.
"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function CountUp({
  to,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 600,
  className,
}: {
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(() =>
    (0).toFixed(decimals)
  );
  const raf = useRef<number>(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(to.toFixed(decimals));
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      // ease-out so the number decelerates into place
      const eased = 1 - (1 - t) ** 3;
      setDisplay((to * eased).toFixed(decimals));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [to, decimals, duration]);

  return (
    <span className={cn("tabular-nums", className)}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
