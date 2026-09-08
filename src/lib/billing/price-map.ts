// src/lib/billing/price-map.ts — plan keys, Stripe price ids and quotas
import { env } from "@/lib/env";

export type PlanKey = "STARTER" | "GROWTH" | "PRO";

// V2.2: built lazily — a module-scope `env.STRIPE_PRICE_*` read fails
// build-time route module evaluation without runtime secrets.
export function planPriceIds(): Record<PlanKey, string> {
  return {
    STARTER: env.STRIPE_PRICE_STARTER,
    GROWTH: env.STRIPE_PRICE_GROWTH,
    PRO: env.STRIPE_PRICE_PRO,
  };
}

/** Map a Stripe price id back to a plan key (webhook direction). */
export function priceToPlan(priceId: string | null | undefined): PlanKey {
  const ids = planPriceIds();
  if (priceId === ids.GROWTH) return "GROWTH";
  if (priceId === ids.PRO) return "PRO";
  return "STARTER";
}

/** Map a plan key to its Stripe price id (checkout direction). */
export function planToPrice(planKey: PlanKey): string {
  return planPriceIds()[planKey];
}

export const PLAN_LIMITS: Record<PlanKey, { reviewQuota: number; businessQuota: number; priceMonthly: number }> = {
  STARTER: { reviewQuota: 150, businessQuota: 1, priceMonthly: 19 },
  GROWTH: { reviewQuota: 600, businessQuota: 1, priceMonthly: 39 },
  PRO: { reviewQuota: 2000, businessQuota: 3, priceMonthly: 79 },
};