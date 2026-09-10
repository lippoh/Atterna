// src/components/ui/section-card.tsx — settings/billing section wrapper
// One surface rhythm: radius-lg, hairline, shadow-xs, p-5/6. Title row
// accepts an optional trailing slot (status chip, action link).
import * as React from "react";
import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  description,
  trailing,
  children,
  className,
  labelledBy,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  trailing?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={cn(
        "rounded-lg border border-line bg-surface p-5 shadow-xs sm:p-6",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={labelledBy} className="text-lg font-semibold text-ink-900">
          {title}
        </h2>
        {trailing}
      </div>
      {description ? (
        <p className="lh-body mt-2 max-w-[60ch] text-sm text-ink-500">{description}</p>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}
