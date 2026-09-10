// src/app/[locale]/(app)/dashboard/page.tsx — the Reputation Intelligence
// dashboard (spec §37 IA): Health → What changed → Customer Voice →
// Recurring/Emerging Issues → Recommendations → Competitor position →
// Source breakdown → Seasonal + Historical trend.
//
// Two structural changes vs the old page:
// 1. NO Google gate — the dashboard runs on ANY mix of sources (CSV,
//    manual, QR feedback, Google); with zero data it shows an import CTA.
// 2. Low-review months stay useful (spec §14): every block falls back to
//    longer windows and labels exactly which window it is showing.
// Every number is deterministic (lib/reputation); the AI layer only adds
// cached narrative when available.
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireOrg } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Link } from "@/i18n/navigation";
import { IconQr, IconArrowRight, IconUpload } from "@/components/ui/icons";
import { MetricCard } from "@/components/dashboard/metric-card";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { HealthCard } from "@/components/dashboard/intel/health-card";
import { VoiceCard } from "@/components/dashboard/intel/voice-card";
import { IssuesPanel } from "@/components/dashboard/intel/issues-panel";
import {
  CompetitorCard,
  SourceCard,
  SeasonalCard,
} from "@/components/dashboard/intel/context-panel";
import {
  getWindowStats,
  getMonthlyBuckets,
  monthlyTrendPoints,
  getSourceBreakdown,
} from "@/lib/reputation/analytics";
import {
  getScoreWithChange,
  collectScoreInput,
  computeReputationScore,
} from "@/lib/reputation/score";
import { getThemeStats } from "@/lib/reputation/themes";
import { buildSeasonalComparison } from "@/lib/reputation/seasonal";
import { getCompetitors, getBenchmark } from "@/lib/reputation/competitors";
import {
  getCachedQuarterlySummary,
  getCachedHealthNarrative,
  dataFingerprint,
} from "@/ai/insights";

function greetingKey(d: Date): "morning" | "afternoon" | "evening" {
  const h = d.getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

export default async function DashboardPage() {
  const { orgId } = await requireOrg();
  const locale = await getLocale();

  const business = await prisma.business.findFirst({
    where: { organizationId: orgId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (!business) redirect(`/${locale}/onboarding`);

  const [t, w30, w90, w365, wAll, sourceBreakdown] = await Promise.all([
    getTranslations({ namespace: "dashboard", locale }),
    getWindowStats(orgId, business.id, "30d"),
    getWindowStats(orgId, business.id, "90d"),
    getWindowStats(orgId, business.id, "365d"),
    getWindowStats(orgId, business.id, "all"),
    getSourceBreakdown(orgId, business.id),
  ]);

  // Current calendar month count (the "this month" context line, §14).
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthCount = await prisma.review.count({
    where: {
      organizationId: orgId,
      businessId: business.id,
      deletedAt: null,
      receivedAt: { gte: monthStart },
    },
  });

  const dateFmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "el-GR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // ── Empty state: no customer voice at all → import/connect CTA (§35) ──
  if (wAll.count === 0 && sourceBreakdown.feedbackCount === 0) {
    return (
      <main id="main-content" className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6">
        <h1 className="font-display text-3xl font-semibold text-ink-900">{t("title")}</h1>
        <div className="mt-8 rounded-lg border border-aegean-100 bg-aegean-100/60 p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-ink-900">{t("intel.empty.title")}</h2>
          <p className="lh-body mt-2 max-w-[56ch] text-sm text-ink-700">
            {t("intel.empty.body")}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/settings/sources"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-aegean-600 px-4 text-sm font-semibold text-white shadow-xs transition-[background-color,transform,box-shadow] duration-150 hover:-translate-y-px hover:bg-aegean-700 hover:shadow-sm"
            >
              <IconUpload className="size-4" />
              {t("intel.empty.import")}
            </Link>
            <Link
              href="/onboarding"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-line-strong bg-surface px-4 text-sm font-semibold text-ink-700 transition-colors hover:border-ink-500"
            >
              {t("intel.empty.connect")}
              <IconArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ── Intelligence pipeline (deterministic + cached AI) ─────────────────
  // Stage B: the four display windows are passed into collectScoreInput so
  // the score layer does not re-run the same aggregates a second time.
  // One shared data fingerprint feeds both AI-cache reads (was 2 identical
  // aggregate runs per page view).
  const [
    scoreChange,
    issues,
    recommendations,
    competitors,
    benchmark,
    themeStats,
    monthly,
    baseFingerprint,
  ] = await Promise.all([
    getScoreWithChange(business.id),
    prisma.issue.findMany({
      where: { businessId: business.id, status: { in: ["OPEN", "IN_PROGRESS"] } },
      orderBy: [{ severity: "desc" }, { mentionsCurrent: "desc" }],
    }),
    prisma.recommendation.findMany({
      where: { businessId: business.id, status: { in: ["OPEN", "IN_PROGRESS"] } },
      orderBy: [{ impact: "desc" }, { createdAt: "asc" }],
      take: 6,
    }),
    getCompetitors(business.id),
    getBenchmark(orgId, business.id),
    getThemeStats(orgId, business.id),
    getMonthlyBuckets(orgId, business.id, 12),
    dataFingerprint(business.id),
  ]);
  const [summary, scoreInput] = await Promise.all([
    getCachedQuarterlySummary(business.id, baseFingerprint),
    collectScoreInput(orgId, business.id, now, { w30, w90, w365, wAll }),
  ]);
  const score = computeReputationScore(scoreInput);
  const narrative = await getCachedHealthNarrative(
    business.id,
    score.score,
    scoreChange.delta,
    baseFingerprint
  );
  const seasonal = buildSeasonalComparison(monthly, themeStats);

  const negativeShare = score.inputsSummary.negativeShare90d;
  const responseRate = w90.responseRate ?? wAll.responseRate;

  return (
    <main id="main-content" className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6">
      {/* Greeting row */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink-900">
            {t(`greeting.${greetingKey(new Date())}`)}
          </h1>
          <p className="mt-1 text-[13px] text-ink-500">{dateFmt.format(new Date())}</p>
        </div>
        <Link
          href="/feedback"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-aegean-600 px-4 text-sm font-semibold text-white shadow-xs transition-[background-color,transform,box-shadow] duration-150 hover:-translate-y-px hover:bg-aegean-700 hover:shadow-sm"
        >
          <IconQr className="size-4" />
          {t("requestReview")}
        </Link>
      </div>

      {/* ── Reputation Health (deterministic score + cached AI line) ──── */}
      <div className="mt-8">
        <HealthCard
          score={score}
          change={scoreChange}
          narrative={narrative?.text ?? null}
          locale={locale}
        />
      </div>

      {/* ── What changed (90-day comparisons; honest when young) ───────── */}
      <section className="mt-6">
        <h2 className="text-lg font-semibold text-ink-900">{t("intel.changed.title")}</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            tone={
              score.inputsSummary.ratingDelta90d === null
                ? "warn"
                : score.inputsSummary.ratingDelta90d >= 0
                  ? "good"
                  : "bad"
            }
            label={t("intel.changed.rating")}
            value={
              score.inputsSummary.ratingDelta90d === null
                ? "—"
                : `${score.inputsSummary.ratingDelta90d >= 0 ? "+" : ""}${score.inputsSummary.ratingDelta90d}`
            }
            hint={`${w90.avgRating?.toFixed(1) ?? "—"} → ${score.inputsSummary.avgRating90d?.toFixed(1) ?? "—"}`}
            locale={locale}
          />
          <MetricCard
            tone={responseRate === null ? "warn" : responseRate >= 0.8 ? "good" : "warn"}
            label={t("intel.changed.response")}
            value={responseRate === null ? "—" : `${Math.round(responseRate * 100)}%`}
            hint={t("intel.changed.responseHint", { count: w90.answered })}
            locale={locale}
          />
          <MetricCard
            tone={negativeShare === null ? "warn" : negativeShare <= 0.15 ? "good" : "warn"}
            label={t("intel.changed.negative")}
            value={negativeShare === null ? "—" : `${Math.round(negativeShare * 100)}%`}
            hint={t("intel.changed.negativeHint", { count: w90.sentiment.negative })}
            locale={locale}
          />
          <MetricCard
            tone="good"
            label={t("intel.changed.velocity")}
            value={String(w30.count)}
            hint={t("intel.changed.velocityHint", { count: monthCount })}
            locale={locale}
          />
        </div>
      </section>

      {/* ── Intelligence grid: voice + issues/actions | context column ── */}
      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[7fr_5fr]">
        <div className="space-y-6">
          <VoiceCard
            w30={w30}
            w90={w90}
            w365={w365}
            wAll={wAll}
            monthCount={monthCount}
            themes={themeStats}
            narrative={summary?.narrative ?? null}
            strengths={summary?.strengths ?? []}
            risks={summary?.risks ?? []}
            locale={locale}
          />
          <IssuesPanel
            issues={issues}
            recommendations={recommendations}
            locale={locale}
          />
        </div>
        <div className="space-y-6">
          <CompetitorCard
            benchmark={benchmark}
            competitors={competitors}
            locale={locale}
          />
          <SourceCard breakdown={sourceBreakdown} locale={locale} />
          <SeasonalCard comparison={seasonal} locale={locale} />
        </div>
      </div>

      {/* ── Historical trend: 12-month rating line (§12, all-source) ──── */}
      <section className="mt-6">
        <h2 className="text-lg font-semibold text-ink-900">{t("intel.trend")}</h2>
        <div className="mt-4">
          <TrendChart series={monthlyTrendPoints(monthly)} aria-label={t("trend")} />
        </div>
      </section>
    </main>
  );
}
