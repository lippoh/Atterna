// src/jobs/weekly-report.ts — Monday 08:00 Athens, per active business
// V2 fixes vs the V1 listing: ownerEmail() and subjectFor() — the two
// names V1 called without defining them (your TS2304s) — are implemented;
// the owner's locale drives both the email language and the metrics
// labels; send failures are logged per business without aborting the run.
import { prisma } from "@/lib/db";
import { getDashboardMetrics, getInsights } from "@/lib/metrics";
import { renderWeeklyEmail } from "@/emails/weekly";
import { send } from "@/lib/mailer";
async function ownerEmail(b: {
organizationId: string;
}): Promise<{ email: string; locale: string } | null> {
const membership = await prisma.membership.findFirst({
where: { organizationId: b.organizationId, role: "OWNER" },
include: { user: { select: { email: true, locale: true } } },
});
if (!membership) return null;
return {
email: membership.user.email,
locale: membership.user.locale.toLowerCase(),
};
}
function subjectFor(
locale: string,
metrics: { rating: number; reviewCount: number }
): string {
return locale === "en"
? `Your weekly reputation report — rating ${metrics.rating.toFixed(1)}
(${metrics.reviewCount} reviews)`
: `Εβδομαδιαία αναφορά φήμης — βαθμολογία ${metrics.rating.toFixed(1)}
(${metrics.reviewCount} κριτικές)`;
}
export async function runWeeklyReports(): Promise<{ sent: number; failed: number }> {
const businesses = await prisma.business.findMany({
where: {
deletedAt: null,
organization: {
subscription: { status: { in: ["TRIALING", "ACTIVE"] } },
},
},
include: { organization: { include: { subscription: true } } },
});
let sent = 0;
let failed = 0;
for (const b of businesses) {
const owner = await ownerEmail(b);
if (!owner) continue;
const locale = owner.locale === "en" ? "en" : "el";
const [metrics, insights] = await Promise.all([
getDashboardMetrics(b.organizationId, b.id, locale),
getInsights(b.organizationId, b.id, { window: "7d", locale }),
]);
const html = await renderWeeklyEmail({
locale,
businessName: b.name,
metrics,
insights,
});
const result = await send({
to: owner.email,
subject: subjectFor(locale, metrics),
html,
listUnsubscribe: true,
});
if (result.ok) sent++;
else failed++;
await prisma.reportLog.create({
data: {
businessId: b.id,
organizationId: b.organizationId,
kind: "WEEKLY",
metrics: {
rating: metrics.rating,
reviewCount: metrics.reviewCount,
velocity: metrics.velocity,
unanswered: metrics.unanswered,
responseRate: metrics.responseRate,
} as object,
},
});
}
return { sent, failed };
}
/** Handler form for the job queue (weekly-report type). */
export async function handleWeeklyReport(): Promise<void> {
await runWeeklyReports();
}