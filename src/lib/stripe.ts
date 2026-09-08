// src/lib/stripe.ts — stripe client + checkout/portal sessions
// Synchronous calls create sessions and read state, never write
// subscription state — the webhook is the only writer (Section 27).
import Stripe from "stripe";
import { env } from "@/lib/env";

// V2.2: lazy client. A module-scope `new Stripe(env.STRIPE_SECRET_KEY)`
// evaluates env at import time and fails Next's build-time route module
// evaluation when secrets are absent. The proxy instantiates the real
// client on first use, so importing this module is side-effect free and
// every existing `stripe.*` call site keeps working unchanged.
let _stripe: Stripe | null = null;

function client(): Stripe {
  if (!_stripe) _stripe = new Stripe(env.STRIPE_SECRET_KEY);
  return _stripe;
}

export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target: Stripe, prop: string | symbol) {
    const c = client();
    const value = Reflect.get(c, prop);
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(c)
      : value;
  },
});

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