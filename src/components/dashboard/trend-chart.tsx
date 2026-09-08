// src/components/dashboard/trend-chart.tsx — server-rendered SVG line chart
// (§7.8): fixed height 220, area fill aegean-600 18%→0 gradient, 2px line
// with round joins and non-scaling stroke, 4 horizontal gridlines, mono
// x/y labels. The line draws in over 700ms (chart-line class, honors
// prefers-reduced-motion). No charting library — the SVG serializes into
// the weekly email exactly as it renders here.
import type { TrendPoint } from "@/lib/metrics";

export interface TrendChartProps {
  series: TrendPoint[];
  "aria-label": string;
}

const W = 560;
const H = 220;
const PAD = { top: 16, right: 12, bottom: 26, left: 34 };

export function TrendChart({ series, "aria-label": ariaLabel }: TrendChartProps) {
  const values = series.map((p) => p.value).filter((v): v is number => v !== null);
  const min = values.length ? Math.max(0, Math.min(...values) - 0.5) : 0;
  const max = values.length ? Math.min(5, Math.max(...values) + 0.5) : 5;
  const span = max - min || 1;

  const n = Math.max(series.length - 1, 1);
  const x = (i: number) => PAD.left + (i / n) * (W - PAD.left - PAD.right);
  const y = (v: number) =>
    PAD.top + (1 - (v - min) / span) * (H - PAD.top - PAD.bottom);

  const points = series
    .map((p, i) => (p.value === null ? null : `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`))
    .filter((s): s is string => s !== null);

  const linePath = points.length > 1 ? `M${points.join(" L")}` : "";
  const areaPath =
    points.length > 1
      ? `${linePath} L${x(series.length - 1).toFixed(1)},${(H - PAD.bottom).toFixed(1)} L${PAD.left},${(H - PAD.bottom).toFixed(1)} Z`
      : "";

  const first = series[0]?.date?.slice(5) ?? "";
  const last = series[series.length - 1]?.date?.slice(5) ?? "";
  const gridlines = [min, min + span / 3, min + (2 * span) / 3, max];

  return (
    <figure className="rounded-lg border border-line bg-surface p-4 shadow-xs sm:p-5">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel}
        className="block h-[220px] w-full"
      >
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--aegean-600)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--aegean-600)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridlines.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--line)"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 8}
              y={y(v) + 4}
              textAnchor="end"
              fontSize="13"
              fill="var(--ink-300)"
              className="font-mono"
            >
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        {areaPath && <path d={areaPath} fill="url(#trendFill)" />}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="var(--aegean-600)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            pathLength={1}
            className="chart-line"
          />
        )}
        <text x={PAD.left} y={H - 6} fontSize="13" fill="var(--ink-300)" className="font-mono">
          {first}
        </text>
        <text
          x={W - PAD.right}
          y={H - 6}
          textAnchor="end"
          fontSize="13"
          fill="var(--ink-300)"
          className="font-mono"
        >
          {last}
        </text>
      </svg>
    </figure>
  );
}
