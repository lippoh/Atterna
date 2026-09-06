// src/jobs/weekly-report.ts — Monday 08:00 Athens, per active business
import { prisma } from "@/lib/db";
import { getDashboardMetrics, getInsights } from "@/lib/metrics";
import { renderWeeklyEmail } from "@/emails/weekly";
import { send } from "@/lib/mailer";
export async function runWeeklyReports() {
  const businesses = await prisma.business.findMany({
    where: { deletedAt: null,
      organization: { subscription: { status: { in:
        ["TRIALING", "ACTIVE"] } } } },
    include: { organization: { include: { subscription: true } } },
  });
  for (const b of businesses) {
    const [metrics, insights] = await Promise.all([
      getDashboardMetrics(b.organizationId, b.id),
      getInsights(b.organizationId, b.id, { window: "7d" }),
    ]);
    const html = await renderWeeklyEmail({
      locale: b.locale, businessName: b.name,
      metrics, insights,
    });
    await send({
      to: ownerEmail(b),
      subject: subjectFor(b.locale, metrics),
      html,
      listUnsubscribe: true,
    });
    await prisma.reportLog.create({ data: {
      businessId: b.id, organizationId: b.organizationId,
      kind: "WEEKLY", metrics: metrics as object,
    }});
  }
}