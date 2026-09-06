// src/ai/usage.ts — token/cost accounting (AiUsageLog rows)
// recordUsage(orgId, "analyze", result) — the exact call V1's analyze.ts
// made without importing it. Cost table is per-model with a safe default;
// re-quote prices quarterly (Section 38 cost ladder).
import { prisma } from "@/lib/db";
/** Illustrative EUR micros per 1M tokens — replace with quoted prices. */
const COST_PER_1M: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 150, output: 600 },
  "gpt-4o": { input: 2500, output: 10000 },
};
const DEFAULT_COST = { input: 2000, output: 8000 };
export interface UsageResult {
  tokensIn: number;
  tokensOut: number;
  model: string;
}
export async function recordUsage(
  organizationId: string,
  task: "classify" | "analyze" | "compose" | "report",
  result: UsageResult
): Promise<void> {
  const rates = COST_PER_1M[result.model] ?? DEFAULT_COST;
  const costMicros = Math.round(
    (result.tokensIn / 1_000_000) * rates.input * 1_000 +
      (result.tokensOut / 1_000_000) * rates.output * 1_000
  );
  await prisma.aiUsageLog.create({
    data: {
      organizationId,
      task,
      model: result.model,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      costMicros,
    },
  });
}
export async function monthlyUsage(organizationId: string): Promise<{
  tokensIn: number;
  tokensOut: number;
  costEur: number;
  calls: number;
}> {
  const since = new Date();
  since.setDate(1);
  since.setHours(0, 0, 0, 0);
  const logs = await prisma.aiUsageLog.findMany({
    where: { organizationId, createdAt: { gte: since } },
    select: { tokensIn: true, tokensOut: true, costMicros: true },
  });
  return {
    tokensIn: logs.reduce((s, l) => s + l.tokensIn, 0),
    tokensOut: logs.reduce((s, l) => s + l.tokensOut, 0),
    costEur: logs.reduce((s, l) => s + l.costMicros, 0) / 1_000_000,
    calls: logs.length,
  };
}
/** Budget gate (AI_MONTHLY_TOKEN_BUDGET, soft alert at 80%). */
export async function budgetState(
  organizationId: string,
  budget: number
): Promise<{ used: number; ratio: number; softBreach: boolean; hardBreach: boolean }> {
  const usage = await monthlyUsage(organizationId);
  const used = usage.tokensIn + usage.tokensOut;
  const ratio = budget > 0 ? used / budget : 0;
  return {
    used,
    ratio,
    softBreach: ratio >= 0.8 && ratio < 1,
    hardBreach: ratio >= 1,
  };
}