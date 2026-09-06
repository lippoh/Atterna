// src/lib/stripe.ts — stripe client + checkout/portal sessions
// Synchronous calls create sessions and read state, never write
// subscription state — the webhook is the only writer (Section 27).
import Stripe from "stripe";
import { env } from "@/lib/env";
export const stripe = new Stripe(env.STRIPE_SECRET_KEY);
export async function createCheckoutSession(input: {
  orgId: string;
  planKey: "STARTER" | "GROWTH" | "PRO";
  customerEmail?: string;
  trialDays?: number;
  locale: string;
}): Promise<{ url: string }> {
  const price = input.planKey === "STARTER"
    ? env.STRIPE_PRICE_STARTER
    : input.planKey === "GROWTH"
      ? env.STRIPE_PRICE_GROWTH
      : env.STRIPE_PRICE_PRO;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    client_reference_id: input.orgId,
    customer_email: input.customerEmail,
    metadata: {
      orgId: input.orgId,
      priceKey: input.planKey,
      ...(input.trialDays ? { trial: "1" } : {}),
    },
    subscription_data: input.trialDays
      ? { trial_period_days: input.trialDays }
      : undefined,
    locale: input.locale === "en" ? "en" : "el",
    allow_promotion_codes: true,
    success_url: `${env.APP_URL}/${input.locale}/billing?success=1`,
    cancel_url: `${env.APP_URL}/${input.locale}/billing?canceled=1`,
    // Stripe Tax + Greek VAT are enabled in the Stripe dashboard
    // (automatic_tax on the account); the session inherits them.
  });
  return { url: session.url ?? "" };
}
export async function createPortalSession(input: {
  customerId: string;
  locale: string;
}): Promise<{ url: string }> {
  const session = await stripe.billingPortal.sessions.create({
    customer: input.customerId,
    return_url: `${env.APP_URL}/${input.locale}/billing`,
  });
  return { url: session.url };
}