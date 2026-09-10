// src/components/ui/empty-state.tsx — honest empty state block
// Centered icon tile + title + body + optional action. Never fakes
// connectivity or metrics — states what is missing and the next step.
import * as React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-lg border border-dashed border-line-strong bg-surface px-6 py-12 text-center",
        className
      )}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="flex size-11 items-center justify-center rounded-full bg-sunken text-ink-500 [&_svg]:size-5"
        >
          {icon}
        </span>
      ) : null}
      <p className="mt-4 text-base font-semibold text-ink-900">{title}</p>
      {body ? <p className="lh-body mt-1.5 max-w-[46ch] text-sm text-ink-500">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
