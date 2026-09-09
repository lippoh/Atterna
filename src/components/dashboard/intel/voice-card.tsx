// src/components/dashboard/intel/voice-card.tsx — Customer Voice (§14, §37):
// 90-day sentiment + top strengths + the low-review-month framing (current
// month shown next to 90-day/12-month/all-time context, never "no data")
// + the cached AI narrative when available.
import { getTranslations } from "next-intl/server";
import { categoryLabel } from "@/lib/metrics";
import type { WindowStats } from "@/lib/reputation/analytics";
import type { ThemeStat } from "@/lib/reputation/themes";

export async function VoiceCard({
  w30,
  w90,
  w365,
  wAll,
  monthCount,
  themes,
  narrative,
  strengths,
  risks,
  locale,
}: {
  w30: WindowStats;
  w90: WindowStats;
  w365: WindowStats;
  wAll: WindowStats;
  monthCount: number;
  themes: ThemeStat[];
  narrative: string | null;
  strengths: string[];
  risks: string[];
  locale: string;
}) {
  const t = await getTranslations({ namespace: "dashboard.intel.voice", locale });
  const analyzed = w90.analyzed;
  const total = w90.sentiment.positive + w90.sentiment.neutral + w90.sentiment.negative;
  const share = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const topStrengths = [...themes]
    .sort((a, b) => b.complimentMentions - a.complimentMentions)
    .filter((x) => x.complimentMentions > 0)
    .slice(0, 3);
  const quietMonth = w30.count === 0;

  const bar = (label: string, count: number, cls: string) => (
    <div key={label} className="flex items-center gap-3">
      <p className="w-16 shrink-0 text-[12px] font-medium text-ink-500">{label}</p>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-sunken">
        <div className={`h-full rounded-full ${cls}`} style={{ width: `${share(count)}%` }} />
      </div>
      <p className="w-10 shrink-0 text-right font-mono text-[12px] tabular-nums text-ink-500">
        {analyzed ? `${share(count)}%` : "—"}
      </p>
    </div>
  );

  return (
    <section className="rounded-lg border border-line bg-surface p-5 shadow-xs sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink-900">{t("title")}</h2>
        <p className="font-mono text-[11px] text-ink-300">
          {t("window90")}
        </p>
      </div>

      {/* low-review-month framing (spec §14): month vs 90d vs 12m vs all */}
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5 text-[13px]">
        <p className="text-ink-700">
          <span className="font-semibold tabular-nums text-ink-900">{monthCount}</span>{" "}
          {t("thisMonth")}
        </p>
        <p className="text-ink-700">
          <span className="font-semibold tabular-nums text-ink-900">{w90.count}</span>{" "}
          {t("in90d")}
        </p>
        <p className="text-ink-700">
          <span className="font-semibold tabular-nums text-ink-900">{w365.count}</span>{" "}
          {t("in12m")}
        </p>
        <p className="text-ink-700">
          <span className="font-semibold tabular-nums text-ink-900">{wAll.count}</span>{" "}
          {t("allTime")}
        </p>
      </div>
      {quietMonth && w90.count > 0 && (
        <p className="mt-2 rounded-md bg-sunken px-3 py-2 text-[13px] text-ink-700">
          {t("quietMonth", { rating: w90.avgRating?.toFixed(1) ?? "—" })}
        </p>
      )}

      {analyzed > 0 ? (
        <div className="mt-5 space-y-2">
          {bar(t("positive"), w90.sentiment.positive, "bg-success-600")}
          {bar(t("neutral"), w90.sentiment.neutral, "bg-ink-300")}
          {bar(t("negative"), w90.sentiment.negative, "bg-danger-600")}
        </div>
      ) : (
        <p className="mt-5 text-[13px] text-ink-500">{t("noAnalysis")}</p>
      )}

      {topStrengths.length > 0 && (
        <div className="mt-5">
          <p className="text-[12px] font-semibold tracking-wide text-ink-500">
            {t("strengths")}
          </p>
          <ul className="mt-2 space-y-1.5">
            {topStrengths.map((s) => (
              <li key={s.category} className="flex items-center gap-2 text-sm text-ink-700">
                <span className="size-1.5 rounded-full bg-success-600" aria-hidden="true" />
                {categoryLabel(s.category, locale)}
                <span className="font-mono text-[11px] text-ink-300">
                  {s.complimentMentions}×
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {narrative && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="lh-body text-sm leading-relaxed text-ink-700">{narrative}</p>
          {(strengths.length > 0 || risks.length > 0) && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {strengths.length > 0 && (
                <ul className="space-y-1">
                  {strengths.map((line) => (
                    <li key={line} className="flex items-start gap-1.5 text-[13px] text-ink-700">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-success-600" />
                      {line}
                    </li>
                  ))}
                </ul>
              )}
              {risks.length > 0 && (
                <ul className="space-y-1">
                  {risks.map((line) => (
                    <li key={line} className="flex items-start gap-1.5 text-[13px] text-ink-700">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-terracotta-500" />
                      {line}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
