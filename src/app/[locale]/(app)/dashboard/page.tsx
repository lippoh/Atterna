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
<main className="mx-auto max-w-2xl space-y-4 p-4">
  <h1 className="text-xl font-semibold">{t("title")}</h1>
<p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-slate-700">
{t("connectFirst")}
</p>
<Link
href="/onboarding"
className="inline-block rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold
text-white"
>
→ {locale === "en" ? "Connect now" : "Σύνδεση τώρα"}
</Link>
</main>
);
}
return (
<main className="mx-auto max-w-2xl space-y-4 p-4">
<h1 className="text-xl font-semibold">{t("title")}</h1>
<div className="grid grid-cols-2 gap-3">
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
<section className="space-y-3">
<h2 className="text-base font-semibold text-slate-900">{t("insights")}</h2>
{insights.length === 0 ? (
<p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
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