// src/jobs/refresh-reputation.ts — daily intelligence refresh per active
// business: themes → issues → recommendations → deterministic score
// snapshot (see lib/reputation/refresh.ts). Enqueued by the daily intel
// cron and after imports/syncs create new data.
import { enqueue } from "./runner";
import { refreshBusinessIntelligence } from "@/lib/reputation/refresh";
import { getScoreWithChange } from "@/lib/reputation/score";
import { collectScoreInput, computeReputationScore } from "@/lib/reputation/score";
import { warmInsightCache } from "@/ai/insights";
import { prisma } from "@/lib/db";

/** Enqueue one refresh job per active business (deduped per day). */
export async function enqueueRefreshes(): Promise<number> {
  const businesses = await prisma.business.findMany({
    where: {
      deletedAt: null,
      organization: { subscription: { status: { in: ["TRIALING", "ACTIVE"] } } },
    },
    select: { id: true },
    take: 200,
  });
  const day = new Date().toISOString().slice(0, 10);
  for (const business of businesses) {
    await enqueue("refresh-reputation", { businessId: business.id }, {
      dedupeKey: `refresh:${business.id}:${day}`,
    });
  }
  return businesses.length;
}

export async function handleRefreshReputation(payload: unknown): Promise<void> {
  const data = (payload ?? {}) as { businessId?: string };
  if (!data.businessId) throw new Error("NO_BUSINESS_ID");
  const businessId = data.businessId;
  await refreshBusinessIntelligence(businessId);
  // Warm the AI caches (only the job pays tokens; page views read cache).
  // Best-effort: without an AI key the deterministic layer stands alone.
  try {
    const business = await prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { organizationId: true, locale: true },
    });
    const locale = business.locale === "EN" ? "en" : "el";
    const change = await getScoreWithChange(businessId);
    const input = await collectScoreInput(business.organizationId, businessId);
    const score = computeReputationScore(input);
    await warmInsightCache(business.organizationId, businessId, score, change.delta, locale);
  } catch {
    /* AI warming is optional */
  }
}
