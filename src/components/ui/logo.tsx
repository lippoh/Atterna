// src/components/ui/logo.tsx — the Atterna wordmark
// "Atterna." in the display serif with a terracotta period (brief §7.5).
// No image asset — pure type, crisp at every size, dark-mode safe via
// currentColor.
import { cn } from "@/lib/utils";

export function Logo({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-display font-semibold tracking-tight text-ink-900",
        size === "sm" && "text-lg",
        size === "md" && "text-xl",
        size === "lg" && "text-2xl",
        className
      )}
    >
      Atterna<span className="text-terracotta-500">.</span>
    </span>
  );
}
