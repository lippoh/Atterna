// src/components/dashboard/intel/trajectory-card.tsx — Trajectory (Stage D)
// Client island: 30d / 90d / 12m range toggle over precomputed series.
// All three series ship server-rendered (no refetch, no new queries);
// the toggle only swaps which slice is visible. State lives in the URL
// (?range=) so the choice survives refresh and is shareable.
//
// Trajectory replaces the static 12-month trend: daily resolution for
// short ranges, monthly for the year view, each labelled with its window.
"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { TrendSvg } from "@/components/dashboard/trend-chart";
import type { TrendPoint } from "@/lib/metrics";
import { cn } from "@/lib/utils";

export type TrajectoryRange = "30d" | "90d" | "12m";

const RANGES: TrajectoryRange[] = ["30d", "90d", "12m"];

export function TrajectoryCard({
  series30,
  series90,
  series12m,
  ariaLabel,
}: {
  series30: TrendPoint[];
  series90: TrendPoint[];
  series12m: TrendPoint[];
  ariaLabel: string;
}) {
  const t = useTranslations("dashboard.intel.trajectory");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const raw = searchParams.get("range");
  const active: TrajectoryRange = raw === "30d" || raw === "12m" ? raw : "90d";

  const series = useMemo(
    () => (active === "30d" ? series30 : active === "12m" ? series12m : series90),
    [active, series30, series90, series12m]
  );

  const rated = series.filter((p) => p.value !== null);
  const first = rated[0]?.value ?? null;
  const last = rated[rated.length - 1]?.value ?? null;
  const delta = first !== null && last !== null ? Math.round((last - first) * 10) / 10 : null;

  function setRange(range: TrajectoryRange) {
    const params = new URLSearchParams(searchParams.toString());
    if (range === "90d") params.delete("range");
    else params.set("range", range);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <section
      aria-labelledby="trajectory-title"
      className="rounded-lg border border-line bg-surface p-5 shadow-xs sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id="trajectory-title" className="text-lg font-semibold text-ink-900">
            {t("title")}
          </h2>
          {delta !== null && (
            <p
              className={cn(
                "font-mono text-[12px] font-semibold tabular-nums",
                delta > 0 ? "text-success-600" : delta < 0 ? "text-danger-600" : "text-ink-500"
              )}
            >
              {delta > 0 ? "+" : ""}
              {delta} {t("overRange")}
            </p>
          )}
        </div>
        <div
          role="group"
          aria-label={t("rangeLabel")}
          className="flex gap-1 rounded-lg border border-line bg-sunken/60 p-1"
        >
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              aria-pressed={r === active}
              className={cn(
                "h-8 rounded-md px-3.5 text-[13px] font-semibold transition-colors duration-150",
                r === active
                  ? "bg-surface text-ink-900 shadow-xs"
                  : "text-ink-500 hover:text-ink-700"
              )}
            >
              {t(`ranges.${r}`)}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-[12px] text-ink-500">{t(`windows.${active}`)}</p>
      <div className="mt-4" key={active}>
        <TrendSvg series={series} ariaLabel={ariaLabel} gradientId="trajectoryFill" />
      </div>
    </section>
  );
}
