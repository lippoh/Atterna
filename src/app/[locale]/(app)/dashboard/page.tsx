// src/app/[locale]/(app)/dashboard/page.tsx — the 30-second view (§9.3)
// Same data pipeline as V1 (metrics.ts + insights); the visual layer is
// Aegean Premium: greeting row, 4-up metric grid, trend chart card, the
// What/Why/Do insight list. All numbers Intl-formatted, tabular-nums.
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireOrg } from "@/lib/session";
import { getDashboardMetrics, getInsights } from "@/lib/metrics";
import { MetricCard } from "@/components/dashboard/metric-card";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { InsightCard } from "@/components/dashboard/insight-card";
import { prisma } from "@/lib/db";
import { Link } from "@/i18n/navigation";
import { IconQr, IconArrowRight } from "@/components/ui/icons";

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
    include: { gbpConnection: { select: { id: true } } },
  });
  if (!business) redirect(`/${locale}/onboarding`);

  const [t, m, insights] = await Promise.all([
    getTranslations({ namespace: "dashboard", locale }),
    getDashboardMetrics(orgId, business.id, locale),
    getInsights(orgId, business.id, { locale }),
  ]);

  const dateFmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "el-GR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  if (!business.gbpConnection) {
    return (
      <main id="main-content" className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6">
        <h1 className="font-display text-3xl font-semibold text-ink-900">
          {t("title")}
        </h1>
        <div className="mt-6 rounded-lg border border-aegean-100 bg-aegean-100/60 p-5">
          <p className="text-sm text-ink-700">{t("connectFirst")}</p>
          <Link
            href="/onboarding"
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-aegean-600 px-4 text-sm font-semibold text-white shadow-xs transition-[background-color,transform,box-shadow] duration-150 hover:-translate-y-px hover:bg-aegean-700 hover:shadow-sm"
          >
            {locale === "en" ? "Connect now" : "Σύνδεση τώρα"}
            <IconArrowRight className="size-4" />
          </Link>
        </div>
      </main>
    );
  }

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

      {/* Metric grid */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          tone={m.rating >= 4.3 ? "good" : m.rating >= 3.8 ? "warn" : "bad"}
          label={t("rating")}
          value={m.rating.toFixed(1)}
          hint={t("ratingHint")}
          locale={locale}
        />
        <MetricCard
          tone={m.unanswered === 0 ? "good" : "warn"}
          label={t("unanswered.label")}
          value={String(m.unanswered)}
          locale={locale}
        />
        <MetricCard
          tone={m.complaintTrend <= 0 ? "good" : "warn"}
          label={t("topComplaint")}
          value={m.topComplaintLabel}
          locale={locale}
        />
        <MetricCard
          tone="good"
          label={t("topCompliment")}
          value={m.topComplimentLabel}
          locale={locale}
        />
      </div>

      {/* 30-day trend */}
      <section className="mt-6">
        <TrendChart series={m.rating30d} aria-label={t("trend")} />
      </section>

      {/* What/Why/Do insights */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-ink-900">{t("insights")}</h2>
        <div className="mt-4 space-y-3">
          {insights.length === 0 ? (
            <p className="rounded-lg border border-line bg-surface p-5 text-sm text-ink-500">
              {t("noInsights")}
            </p>
          ) : (
            insights.map((insight) => (
              <InsightCard key={insight.key} insight={insight} />
            ))
          )}
        </div>
      </section>
    </main>
  );
}
