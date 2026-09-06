// src/app/[locale]/(app)/dashboard/page.tsx — the 30-second view
import { requireOrg } from "@/lib/session";
import { getDashboardMetrics } from "@/lib/metrics";
import { MetricCard } from "@/components/dashboard/metric-card";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { getTranslations } from "next-intl/server";
export default async function DashboardPage() {
  const { orgId } = await requireOrg();
  const [t, m] = await Promise.all([
    getTranslations("dashboard"),
    getDashboardMetrics(orgId),
  ]);
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4 pb-24">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard tone={m.rating >= 4.3 ? "good" : m.rating >= 3.8 ? "warn" : "bad"}
          label={t("rating")} value={m.rating.toFixed(1)} />
        <MetricCard tone={m.unanswered === 0 ? "good" : "warn"}
          label={t("unanswered.label")} value={String(m.unanswered)} />
        <MetricCard tone={m.complaintTrend <= 0 ? "good" : "warn"}
          label={t("topComplaint")} value={m.topComplaintLabel} />
        <MetricCard tone="good"
          label={t("topCompliment")} value={m.topComplimentLabel} />
      </div>
      <TrendChart series={m.rating30d} aria-label={t("rating")} />
    </main>
  );
}