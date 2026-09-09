// src/jobs/weekly-report.ts — Monday 08:00 Athens, per active business
// V2 fixes vs the V1 listing: ownerEmail() and subjectFor() — the two
// names V1 called without defining them (your TS2304s) — are implemented;
// the owner's locale drives both the email language and the metrics
// labels; send failures are logged per business without aborting the run.
// 2026-09 (reputation-intelligence refactor): the email now leads with the
// deterministic Reputation Health + what-changed + competitive position +
// open recommendations (spec §26), built from stored metrics and cached
// insights — never a fresh LLM call inside the send loop (cost §16).
import { prisma } from "@/lib/db";
import { getDashboardMetrics, getInsights } from "@/lib/metrics";
import { renderWeeklyEmail, type IntelSection } from "@/emails/weekly";
import { send } from "@/lib/mailer";
import {
  getScoreWithChange,
  collectScoreInput,
  computeReputationScore,
} from "@/lib/reputation/score";
import { getThemeStats } from "@/lib/reputation/themes";
import { getBenchmark } from "@/lib/reputation/competitors";
import { getCachedQuarterlySummary } from "@/ai/insights";
import { categoryLabel } from "@/lib/metrics";
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
const [metrics, insights, scoreChange, scoreInput, recommendations, themes, benchmark, summary] =
await Promise.all([
  getDashboardMetrics(b.organizationId, b.id, locale),
  getInsights(b.organizationId, b.id, { window: "7d", locale }),
  getScoreWithChange(b.id),
  collectScoreInput(b.organizationId, b.id),
  prisma.recommendation.findMany({
    where: { businessId: b.id, status: { in: ["OPEN", "IN_PROGRESS"] } },
    orderBy: [{ impact: "desc" }, { createdAt: "asc" }],
    take: 3,
    select: { title: true },
  }),
  getThemeStats(b.organizationId, b.id),
  getBenchmark(b.organizationId, b.id),
  getCachedQuarterlySummary(b.id),
]);
const score = computeReputationScore(scoreInput);
const topStrength = [...themes]
  .sort((x, y) => y.complimentMentions - x.complimentMentions)[0];
const intel: IntelSection = {
  healthScore: score.score,
  healthDelta: scoreChange.delta,
  ratingDelta: score.inputsSummary.ratingDelta90d,
  responseRate: score.inputsSummary.responseRate90d ?? metrics.responseRate,
  negativeShare: score.inputsSummary.negativeShare90d,
  position:
    benchmark.position !== null && benchmark.totalRated !== null
      ? `#${benchmark.position}/${benchmark.totalRated}`
      : null,
  topStrength: topStrength?.complimentMentions
    ? categoryLabel(topStrength.category, locale)
    : null,
  recommendations: recommendations.map((r) => ({ title: r.title })),
  narrative: summary?.narrative ?? null,
};
const html = await renderWeeklyEmail({
  locale,
  businessName: b.name,
  metrics,
  insights,
  intel,
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
healthScore: intel.healthScore,
healthDelta: intel.healthDelta,
position: intel.position,
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