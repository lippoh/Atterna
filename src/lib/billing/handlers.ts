// src/lib/billing/handlers.ts — subscription state changes (webhook only)
// All five events from Table 27.1.
//
// Stripe fix pack (2026-09) changes vs the previous version:
//   - checkout.session.completed resolves the plan from the LIVE Stripe
//     subscription (price id → plan), with the session metadata our own
//     checkout code wrote as fallback — never from a local Subscription
//     row that cannot exist yet. An unmappable price THROWS: the route
//     returns 500, Stripe retries and the failure is visible in the
//     Dashboard instead of silently downgrading the org to STARTER.
//   - Trial/period dates come from the Stripe subscription object
//     (trial_end, items[].current_period_end) — never a hardcoded 30 days.
//   - invoice.paid NEVER writes organizationId "unknown". If the customer
//     cannot be resolved yet (invoice.paid can legitimately arrive before
//     checkout.session.completed stamps stripeCustomerId), the handler
//     throws → 500 → Stripe's retry schedule re-processes the event once
//     the customer is known. A paid invoice is never silently attributed
//     to a wrong org, never discarded, and the Stripe Dashboard surfaces
//     any delivery that keeps failing.
// Statuses: Stripe → SubStatus — trialing→TRIALING, active→ACTIVE,
// past_due/unpaid→PAST_DUE, canceled→CANCELED, incomplete*→INCOMPLETE.
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { accessEndsAfterCancel } from "@/lib/billing/trial";
import { planPriceIds, type PlanKey } from "@/lib/billing/price-map";

const SUB_STATUS: Record<string, "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "INCOMPLETE">
    = {
  trialing: "TRIALING",
  active: "ACTIVE",
  past_due: "PAST_DUE",
  canceled: "CANCELED",
  unpaid: "PAST_DUE",
  incomplete: "INCOMPLETE",
  incomplete_expired: "INCOMPLETE",
};

/**
 * Strict price → plan mapping. Returns null when the price id is not one
 * of the three configured STRIPE_PRICE_* values — callers must treat null
 * as a hard failure (misconfiguration), never as STARTER.
 */
function planFromPrice(priceId: string | null | undefined): PlanKey | null {
  if (!priceId) return null;
  const ids = planPriceIds();
  if (priceId === ids.STARTER) return "STARTER";
  if (priceId === ids.GROWTH) return "GROWTH";
  if (priceId === ids.PRO) return "PRO";
  return null;
}

function planFromSubscription(subscription: Stripe.Subscription): PlanKey | null {
  return planFromPrice(subscription.items.data[0]?.price?.id);
}

/** The real period end: the trial's end while trialing, else the item's. */
function periodEndOf(subscription: Stripe.Subscription): Date | null {
  const sec =
    subscription.trial_end ??
    subscription.items.data[0]?.current_period_end ??
    null;
  return sec ? new Date(sec * 1000) : null;
}

/** Fetch the session's subscription (or accept a pre-expanded object). */
async function subscriptionOf(
  session: Stripe.Checkout.Session
): Promise<Stripe.Subscription | null> {
  if (typeof session.subscription === "string") {
    return stripe.subscriptions.retrieve(session.subscription);
  }
  return session.subscription ?? null;
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object;
      if (typeof s.client_reference_id !== "string") break;
      // Stamp the customer FIRST: it is deterministic from the event, and
      // a later failure in plan resolution must not lose it — Stripe
      // retries the event and the stamp is idempotent.
      const org = await prisma.organization.update({
        where: { id: s.client_reference_id },
        data: { stripeCustomerId: (s.customer as string) ?? undefined },
      });
      const subscription = await subscriptionOf(s);
      let planKey: PlanKey | null =
        subscription ? planFromSubscription(subscription) : null;
      if (!planKey) {
        // Fallback: metadata written by OUR checkout server code.
        const metadataPlan = s.metadata?.priceKey;
        planKey =
          metadataPlan === "GROWTH" || metadataPlan === "PRO" || metadataPlan === "STARTER"
            ? metadataPlan
            : null;
      }
      if (!planKey) {
        throw new Error(
          `checkout.session.completed for organization ${org.id}: cannot map a ` +
            `plan (subscription ${s.subscription ?? "absent"}, metadata priceKey ` +
            `${s.metadata?.priceKey ?? "absent"}). Verify that ` +
            "STRIPE_PRICE_STARTER / STRIPE_PRICE_GROWTH / STRIPE_PRICE_PRO match " +
            "the recurring Prices in your Stripe account."
        );
      }
      const status = subscription
        ? SUB_STATUS[subscription.status] ?? "ACTIVE"
        : "ACTIVE"; // no subscription object yet → corrected by the
      // follow-up customer.subscription.updated event, which always fires.
      const periodEnd = subscription ? periodEndOf(subscription) : null;
      await prisma.subscription.upsert({
        where: { organizationId: org.id },
        create: {
          organizationId: org.id,
          stripeSubscriptionId: subscription?.id ?? null,
          planKey,
          status,
          ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}),
        },
        update: {
          status,
          planKey,
          canceledAt: null,
          ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}),
          ...(subscription ? { stripeSubscriptionId: subscription.id } : {}),
        },
      });
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object;
      const planKey = planFromSubscription(sub);
      if (!planKey) {
        throw new Error(
          `customer.subscription.updated ${sub.id}: the subscription's price ` +
            `(${sub.items.data[0]?.price?.id ?? "absent"}) maps to none of the ` +
            "configured plans. Verify STRIPE_PRICE_STARTER / STRIPE_PRICE_GROWTH / " +
            "STRIPE_PRICE_PRO."
        );
      }
      const periodEnd = periodEndOf(sub);
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data: {
          status: SUB_STATUS[sub.status] ?? "ACTIVE",
          planKey,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          // Keep the stored period end when Stripe reports none — never
          // fabricate a date.
          ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}),
        },
      });
      break;
    }
    case "customer.subscription.deleted": {
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: event.data.object.id },
        data: {
          status: "CANCELED",
          canceledAt: new Date(),
          accessEndsAt: accessEndsAfterCancel(30),
        },
      });
      break;
    }
    case "invoice.paid": {
      const invoice = event.data.object;
      if (!invoice.id) break; // preview invoices have no id — never arrives via events
      const customerId =
        typeof invoice.customer === "string" ? invoice.customer : null;
      const org = customerId
        ? await prisma.organization.findUnique({ where: { stripeCustomerId: customerId } })
        : null;
      if (!org) {
        // Event ordering: invoice.paid can precede
        // checkout.session.completed (which stamps stripeCustomerId).
        // Throw → route 500 → Stripe retries on its schedule; by then the
        // customer is resolvable. Never "unknown", never discarded.
        throw new Error(
          `invoice.paid ${invoice.id}: cannot resolve the organization for ` +
            `Stripe customer ${customerId ?? "absent"} yet — deferring to ` +
            "Stripe's webhook retry schedule"
        );
      }
      const total = invoice.total ?? 0;
      const vat = total - (invoice.total_excluding_tax ?? total);
      await prisma.invoice.upsert({
        where: { stripeInvoiceId: invoice.id },
        create: {
          organizationId: org.id,
          stripeInvoiceId: invoice.id,
          totalCents: invoice.amount_paid ?? total,
          currency: (invoice.currency ?? "eur").toUpperCase(),
          vatCents: vat,
          hostedUrl: invoice.hosted_invoice_url ?? "",
        },
        update: {
          totalCents: invoice.amount_paid ?? total,
          vatCents: vat,
        },
      });
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const customerId =
        typeof invoice.customer === "string" ? invoice.customer : null;
      if (customerId) {
        // PAST_DUE now; Stripe dunning retries 3 times before cancel.
        await prisma.subscription.updateMany({
          where: { organization: { stripeCustomerId: customerId } },
          data: { status: "PAST_DUE" },
        });
      }
      break;
    }
    default:
      // Unknown types are recorded by the route and ignored here.
      break;
  }
}
