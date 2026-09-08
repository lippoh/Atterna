// src/app/[locale]/(app)/dashboard/page.tsx — the 30-second view
// V1's page kept structurally (same imports, same card grid, same
// TrendChart) with the three fields it actually reads now returned by
// metrics.ts, plus the What/Why/Do insight list from Section 26.
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireOrg } from "@/lib/session";
import { getDashboardMetrics, getInsights } from "@/lib/metrics";
import { MetricCard } from "@/components/dashboard/metric-card";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { InsightCard } from "@/components/dashboard/insight-card";
import { prisma } from "@/lib/db";
import { Link } from "@/i18n/navigation";
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
if (!business.gbpConnection) {
return (
<main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
  <div><p className="text-xs font-semibold uppercase tracking-[.12em] text-terracotta-500">Atterna / {t("title")}</p><h1 className="mt-2 font-display text-4xl font-semibold text-ink-900">{t("title")}</h1></div>
<p className="max-w-2xl rounded-lg border border-aegean-600/20 bg-aegean-100 p-5 text-sm leading-7 text-ink-700">
{t("connectFirst")}
</p>
<Link
href="/onboarding"
className="inline-block rounded-sm bg-aegean-600 px-4 py-2.5 text-sm font-semibold
text-white shadow-xs hover:bg-aegean-700"
>
→ {locale === "en" ? "Connect now" : "Σύνδεση τώρα"}
</Link>
</main>
);
}
return (
<main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-terracotta-500">Atterna / {t("title")}</p><h1 className="mt-2 font-display text-4xl font-semibold text-ink-900">{t("title")}</h1></div><span className="font-mono text-xs text-ink-500">{new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date())}</span></div>
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
<TrendChart series={m.rating30d} aria-label={t("trend")} />
<section className="space-y-4">
<h2 className="font-display text-2xl font-semibold text-ink-900">{t("insights")}</h2>
{insights.length === 0 ? (
<p className="rounded-lg border border-line bg-surface p-5 text-sm text-ink-500">
{t("noInsights")}
</p>
) : (
insights.map((insight) => (
<InsightCard key={insight.key} insight={insight} />
))
)}
</section>
</main>
);
}