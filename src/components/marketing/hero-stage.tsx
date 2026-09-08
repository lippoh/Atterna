// src/components/marketing/hero-stage.tsx — the hero product preview (§9.1)
// Client island: the miniature dashboard with animated chart + counters,
// the rotated draft-reply card behind it, and three floating chips. The
// whole stage follows the cursor with layered depths (parallax), each
// layer drifting by a different multiple of the pointer offset. Mouse
// only; reduced motion pins the transforms off in CSS.
"use client";

import { useRef } from "react";
import { CountUp } from "@/components/ui/count-up";
import {
  IconCheck,
  IconStarFilled,
  IconSparkles,
  IconQr,
} from "@/components/ui/icons";

export interface HeroStageLabels {
  business: string;
  businessMeta: string;
  synced: string;
  kpiRating: string;
  kpiResponse: string;
  kpiDelta: string;
  chartLabel: string;
  draftLabel: string;
  draftText: string;
  draftReady: string;
  reviewer: string;
  answered: string;
  reviewText: string;
}

// Up-trending demo series for the mini area chart.
const SERIES = [4.1, 4.15, 4.1, 4.25, 4.2, 4.35, 4.3, 4.45, 4.4, 4.55, 4.5, 4.62];
const W = 220;
const H = 90;

export function HeroStage({ labels }: { labels: HeroStageLabels }) {
  const ref = useRef<HTMLDivElement>(null);

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5; // -0.5..0.5
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--px", px.toFixed(3));
    el.style.setProperty("--py", py.toFixed(3));
  }

  function onPointerLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--px", "0");
    el.style.setProperty("--py", "0");
  }

  const min = 4.0;
  const max = 4.75;
  const pts = SERIES.map((v, i) => {
    const x = (i / (SERIES.length - 1)) * (W - 8) + 4;
    const y = H - 8 - ((v - min) / (max - min)) * (H - 20);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" L");

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className="parallax-stage relative mx-auto w-full max-w-[440px]"
    >
      {/* Draft-reply card behind — offset, rotated 2°, 0.9 scale, depth 0.5 */}
      <div
        aria-hidden="true"
        className="float-y-slow absolute -right-4 -top-10 hidden w-[62%] rotate-2 rounded-xl border border-line bg-surface p-4 shadow-md sm:block parallax-depth-1"
      >
        <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.08em] text-aegean-600">
          <IconSparkles className="size-3" />
          {labels.draftLabel}
        </p>
        <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-ink-500">
          {labels.draftText}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="rounded-full bg-success-100 px-2 py-0.5 text-[10px] font-medium text-success-600">
            {labels.draftReady}
          </span>
        </div>
      </div>

      {/* Floating chip — top-left, depth 2 */}
      <div
        aria-hidden="true"
        className="float-y absolute -left-6 top-6 z-10 hidden items-center gap-2.5 rounded-lg border border-line bg-surface px-3.5 py-2.5 shadow-md sm:flex parallax-depth-2"
      >
        <span className="flex text-star-400">
          {Array.from({ length: 5 }).map((_, i) => (
            <IconStarFilled key={i} className="size-3" />
          ))}
        </span>
        <span className="text-[12px] font-semibold text-ink-900">{labels.reviewer}</span>
        <span className="flex items-center gap-1 text-[11px] font-medium text-success-600">
          <IconCheck className="size-3" />
          {labels.answered}
        </span>
      </div>

      {/* Floating chip — bottom-right, depth 2.5 */}
      <div
        aria-hidden="true"
        className="float-y-slow absolute -bottom-5 -right-3 z-10 hidden items-center gap-2.5 rounded-lg border border-line bg-surface px-3.5 py-2.5 shadow-md sm:flex parallax-depth-3"
      >
        <span className="flex size-8 items-center justify-center rounded-md bg-sunken text-ink-700">
          <IconQr className="size-5" />
        </span>
        <span className="font-mono text-[11px] font-semibold text-ink-700">
          +11 <span className="font-normal text-ink-300">30d</span>
        </span>
      </div>

      {/* The miniature dashboard — depth 1 */}
      <div className="parallax-depth-1 relative rounded-xl border border-line bg-surface p-5 shadow-lg sm:p-6">
        {/* header row: business + sync chip */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-display text-[17px] font-semibold text-ink-900">
              {labels.business}
            </p>
            <p className="text-[12px] text-ink-500">{labels.businessMeta}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-100 px-2.5 py-1 text-[11px] font-medium text-success-600">
            <span className="pulse-dot size-1.5 rounded-full bg-success-600" aria-hidden="true" />
            <IconCheck className="size-3" />
            {labels.synced}
          </span>
        </div>

        {/* three mini KPIs */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          {(
            [
              { value: 4.8, decimals: 1, suffix: "★", label: labels.kpiRating },
              { value: 92, decimals: 0, suffix: "%", label: labels.kpiResponse },
              { value: 11, decimals: 0, prefix: "+", label: labels.kpiDelta },
            ] as { value: number; decimals: number; prefix?: string; suffix?: string; label: string }[]
          ).map((kpi) => (
            <div key={kpi.label} className="rounded-md bg-sunken px-3 py-2.5">
              <p className="font-display text-xl font-semibold tabular-nums text-ink-900">
                <CountUp
                  to={kpi.value}
                  decimals={kpi.decimals}
                  prefix={kpi.prefix ?? ""}
                  suffix={kpi.suffix}
                />
              </p>
              <p className="mt-0.5 text-[10px] leading-tight text-ink-500">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* 220×90 area chart */}
        <figure className="mt-4 overflow-hidden rounded-md border border-line bg-sunken">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block h-[90px] w-full"
            role="img"
            aria-label={labels.chartLabel}
          >
            <defs>
              <linearGradient id="heroArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--aegean-600)" stopOpacity="0.18" />
                <stop offset="100%" stopColor="var(--aegean-600)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`M${pts} L${W - 4},${H - 6} L4,${H - 6} Z`} fill="url(#heroArea)" />
            <path
              d={`M${pts}`}
              fill="none"
              stroke="var(--aegean-600)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              className="chart-line"
            />
          </svg>
        </figure>

        {/* one review row */}
        <div className="mt-4 rounded-md border border-line p-3">
          <div className="flex items-center gap-2">
            <span className="flex text-star-400" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <IconStarFilled key={i} className="size-3" />
              ))}
            </span>
            <span className="text-[12px] font-medium text-ink-700">{labels.reviewer}</span>
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-success-600">
              <IconCheck className="size-3" />
              {labels.answered}
            </span>
          </div>
          <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-ink-500">
            {labels.reviewText}
          </p>
        </div>
      </div>
    </div>
  );
}
