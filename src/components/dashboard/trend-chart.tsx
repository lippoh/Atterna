// src/components/dashboard/trend-chart.tsx — server-rendered SVG line chart
// No charting library (Section 26): plain SVG that serializes into the
// weekly email just as it renders in the dashboard. series comes from
// metrics.bucketByDay — { date, value | null } per day.
import type { TrendPoint } from "@/lib/metrics";
export interface TrendChartProps {
series: TrendPoint[];
"aria-label": string;
}
const W = 520;
const H = 140;
const PAD = { top: 10, right: 8, bottom: 18, left: 30 };
export function TrendChart({ series, "aria-label": ariaLabel }: TrendChartProps) {
const values = series.map((p) => p.value).filter((v): v is number => v !== null);
const min = values.length ? Math.max(0, Math.min(...values) - 0.5) : 0;
const max = values.length ? Math.min(5, Math.max(...values) + 0.5) : 5;
const span = max - min || 1;
const n = Math.max(series.length - 1, 1);
const x = (i: number) => PAD.left + (i / n) * (W - PAD.left - PAD.right);
const y = (v: number) => PAD.top + (1 - (v - min) / span) * (H - PAD.top - PAD.bottom);
const points = series
.map((p, i) => (p.value === null ? null : `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`))
.filter((s): s is string => s !== null);
const linePath = points.length > 1 ? `M${points.join(" L")}` : "";
const areaPath =
points.length > 1
? `${linePath} L${x(series.length - 1).toFixed(1)},${(H - PAD.bottom).toFixed(1)}
L${PAD.left},${(H - PAD.bottom).toFixed(1)} Z`
: "";
const first = series[0]?.date?.slice(5) ?? "";
const last = series[series.length - 1]?.date?.slice(5) ?? "";
return (
<figure className="rounded-xl border border-slate-200 bg-white p-3">
<svg
viewBox={`0 0 ${W} ${H}`}
role="img"
aria-label={ariaLabel}
className="h-auto w-full"
>
<defs>
<linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stopColor="#2d7ab3" stopOpacity="0.25" />
<stop offset="100%" stopColor="#2d7ab3" stopOpacity="0.02" />
</linearGradient>
</defs>
{/* gridlines at min / mid / max */}
{[min, (min + max) / 2, max].map((v, i) => (
<g key={i}>
<line
x1={PAD.left}
x2={W - PAD.right}
y1={y(v)}
y2={y(v)}
stroke="#e2e8f0"
strokeDasharray="3 3"
/>
<text x={PAD.left - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="#64748b">
{v.toFixed(1)}
</text>
</g>
))}
{areaPath && <path d={areaPath} fill="url(#trendFill)" />}
{linePath && <path d={linePath} fill="none" stroke="#2d7ab3" strokeWidth="2"
strokeLinejoin="round" strokeLinecap="round" />}
{series.map((p, i) =>
p.value === null ? null : (
<circle key={p.date} cx={x(i)} cy={y(p.value)} r="2.2" fill="#1a4a7a" />
)
)}
<text x={PAD.left} y={H - 4} fontSize="9" fill="#64748b">{first}</text>
<text x={W - PAD.right} y={H - 4} textAnchor="end" fontSize="9" fill="#64748b">{last}</text>
</svg>
</figure>
);
}