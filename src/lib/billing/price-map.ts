// src/lib/billing/price-map.ts — plan keys, Stripe price ids and quotas
import { env } from "@/lib/env";
export type PlanKey = "STARTER" | "GROWTH" | "PRO";
export const PLAN_PRICE_IDS: Record<PlanKey, string> = {
  STARTER: env.STRIPE_PRICE_STARTER,
  GROWTH: env.STRIPE_PRICE_GROWTH,
  PRO: env.STRIPE_PRICE_PRO,
};
/** Map a Stripe price id back to a plan key (webhook direction). */
export function priceToPlan(priceId: string | null | undefined): PlanKey {
  if (priceId === env.STRIPE_PRICE_GROWTH) return "GROWTH";
  if (priceId === env.STRIPE_PRICE_PRO) return "PRO";
  return "STARTER";
}
/** Map a plan key to its Stripe price id (checkout direction). */
export function planToPrice(planKey: PlanKey): string {
  return PLAN_PRICE_IDS[planKey];
}
export const PLAN_LIMITS: Record<PlanKey, { reviewQuota: number; businessQuota: number;
    priceMonthly: number }> = {
  STARTER: { reviewQuota: 150, businessQuota: 1, priceMonthly: 19 },
  GROWTH: { reviewQuota: 600, businessQuota: 1, priceMonthly: 39 },
  PRO: { reviewQuota: 2000, businessQuota: 3, priceMonthly: 79 },
};