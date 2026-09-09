// src/components/dashboard/intel/context-panel.tsx — the right-hand context
// column: Competitor position (§21–22, honest when empty), source
// breakdown (§24) and seasonal intelligence (§23). All server components;
// competitor add/remove are server actions.
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { sourceLabel } from "@/lib/sources/registry";
import { seasonLabel, type SeasonalComparison } from "@/lib/reputation/seasonal";
import type { Benchmark, CompetitorRow } from "@/lib/reputation/competitors";
import type { SourceBreakdown } from "@/lib/reputation/analytics";
import { removeCompetitorAction } from "@/app/[locale]/(app)/settings/sources/actions";

export async function CompetitorCard({
  benchmark,
  competitors,
  locale,
}: {
  benchmark: Benchmark;
  competitors: CompetitorRow[];
  locale: string;
}) {
  const t = await getTranslations({ namespace: "dashboard.intel.competitors", locale });
  return (
    <section className="rounded-lg border border-line bg-surface p-5 shadow-xs sm:p-6">
      <h2 className="text-lg font-semibold text-ink-900">{t("title")}</h2>

      {benchmark.ownRating === null || benchmark.competitorAvgRating === null ? (
        <p className="mt-3 text-[13px] leading-relaxed text-ink-500">{t("none")}</p>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <p className="text-[11px] font-medium text-ink-500">{t("yourRating")}</p>
            <p className="font-display text-2xl font-semibold tabular-nums text-ink-900">
              {benchmark.ownRating.toFixed(1)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-ink-500">{t("localAverage")}</p>
            <p className="font-display text-2xl font-semibold tabular-nums text-ink-500">
              {benchmark.competitorAvgRating.toFixed(1)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-ink-500">{t("position")}</p>
            <p className="font-display text-2xl font-semibold tabular-nums text-ink-900">
              {benchmark.position !== null
                ? `#${benchmark.position}/${benchmark.totalRated}`
                : "—"}
            </p>
          </div>
        </div>
      )}

      {benchmark.ratingGap !== null && benchmark.ownRating !== null && (
        <p
          className={`mt-3 text-[13px] font-medium ${
            benchmark.ratingGap >= 0 ? "text-success-600" : "text-danger-600"
          }`}
        >
          {benchmark.ratingGap >= 0
            ? t("gapAbove", { gap: `+${benchmark.ratingGap.toFixed(1)}` })
            : t("gapBelow", { gap: benchmark.ratingGap.toFixed(1) })}
        </p>
      )}

      {competitors.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
          {competitors.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-900">{c.name}</p>
                {c.city && <p className="text-[11px] text-ink-300">{c.city}</p>}
              </div>
              {c.rating !== null && (
                <p className="font-mono text-[12px] tabular-nums text-ink-500">
                  {c.rating.toFixed(1)}★
                </p>
              )}
              <form action={removeCompetitorAction}>
                <input type="hidden" name="id" value={c.id} />
                <button
                  type="submit"
                  className="text-[11px] font-semibold text-ink-300 transition-colors hover:text-danger-600"
                >
                  {t("remove")}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[11px] leading-snug text-ink-300">{t("honestyNote")}</p>
      <Link
        href="/settings/sources"
        className="link-grow mt-3 inline-block text-[13px] font-semibold text-aegean-600"
      >
        {t("manage")}
      </Link>
    </section>
  );
}

export async function SourceCard({
  breakdown,
  locale,
}: {
  breakdown: SourceBreakdown;
  locale: string;
}) {
  const t = await getTranslations({ namespace: "dashboard.intel.sources", locale });
  return (
    <section className="rounded-lg border border-line bg-surface p-5 shadow-xs sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink-900">{t("title")}</h2>
        <p className="font-mono text-[11px] text-ink-300">{t("total")}</p>
      </div>
      <p className="font-display text-3xl font-semibold tabular-nums text-ink-900">
        {breakdown.total}
      </p>
      <ul className="mt-4 space-y-1.5">
        {breakdown.sources.map((s) => (
          <li key={s.source} className="flex items-center gap-3">
            <p className="w-32 shrink-0 truncate text-[13px] text-ink-700">
              {sourceLabel(s.source, locale)}
            </p>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
              <div
                className="h-full rounded-full bg-aegean-600/60"
                style={{
                  width: `${Math.round((s.count / Math.max(1, breakdown.total)) * 100)}%`,
                }}
              />
            </div>
            <p className="w-8 shrink-0 text-right font-mono text-[12px] tabular-nums text-ink-500">
              {s.count}
            </p>
          </li>
        ))}
        {breakdown.feedbackCount > 0 && (
          <li className="flex items-center gap-3">
            <p className="w-32 shrink-0 truncate text-[13px] text-ink-700">{t("qr")}</p>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
              <div
                className="h-full rounded-full bg-terracotta-500/60"
                style={{
                  width: `${Math.round((breakdown.feedbackCount / Math.max(1, breakdown.total)) * 100)}%`,
                }}
              />
            </div>
            <p className="w-8 shrink-0 text-right font-mono text-[12px] tabular-nums text-ink-500">
              {breakdown.feedbackCount}
            </p>
          </li>
        )}
      </ul>
      <Link
        href="/settings/sources"
        className="link-grow mt-4 inline-block text-[13px] font-semibold text-aegean-600"
      >
        {t("manage")}
      </Link>
    </section>
  );
}

export async function SeasonalCard({
  comparison,
  locale,
}: {
  comparison: SeasonalComparison;
  locale: string;
}) {
  const t = await getTranslations({ namespace: "dashboard.intel.seasonal", locale });
  const season = comparison.current?.season ?? null;
  return (
    <section className="rounded-lg border border-line bg-surface p-5 shadow-xs sm:p-6">
      <h2 className="text-lg font-semibold text-ink-900">{t("title")}</h2>
      {season && comparison.current ? (
        <>
          <p className="mt-1 text-[13px] font-medium text-ink-700">
            {seasonLabel(season, locale)} {comparison.current.year} ·{" "}
            <span className="font-mono tabular-nums">
              {comparison.current.count}
            </span>{" "}
            {t("reviews")} ·{" "}
            <span className="font-mono tabular-nums">
              {comparison.current.avgRating?.toFixed(1) ?? "—"}★
            </span>
          </p>
          {comparison.deltas ? (
            <ul className="mt-3 space-y-1 text-[13px] text-ink-700">
              <li>
                {t("ratingDelta", {
                  delta: `${comparison.deltas.ratingDelta !== null && comparison.deltas.ratingDelta >= 0 ? "+" : ""}${comparison.deltas.ratingDelta ?? "—"}`,
                })}
              </li>
              <li>
                {t("volumeDelta", {
                  pct: `${comparison.deltas.volumeDeltaPct !== null && comparison.deltas.volumeDeltaPct >= 0 ? "+" : ""}${comparison.deltas.volumeDeltaPct ?? "—"}`,
                })}
              </li>
            </ul>
          ) : (
            <p className="mt-3 text-[13px] text-ink-500">{t("noComparison")}</p>
          )}
          {comparison.offSeason && comparison.offSeasonIssue && (
            <p className="mt-3 rounded-md border border-star-400/40 bg-terracotta-100/50 px-3 py-2 text-[13px] text-ink-700">
              {t("offSeasonIssue", {
                issue:
                  locale === "en"
                    ? comparison.offSeasonIssue.labelEn
                    : comparison.offSeasonIssue.labelEl,
              })}
            </p>
          )}
        </>
      ) : (
        <p className="mt-3 text-[13px] text-ink-500">{t("noData")}</p>
      )}
    </section>
  );
}
