// src/components/ui/page-header.tsx — consistent page heading block
// Display-serif H1 + optional lede + optional action slot. One rhythm
// across every app surface: title, then content.
import * as React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900">
          {title}
        </h1>
        {description ? (
          <p className="lh-body mt-2 max-w-[60ch] text-sm text-ink-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
