// src/lib/billing/handlers.ts — subscription state changes (webhook only)
// All five events from Table 27.1. priceToPlan is imported from the
// price map (V1 referenced it without the import — fixed here).
// Stripe statuses map onto SubStatus: trialing→TRIALING, active→ACTIVE,
// past_due→PAST_DUE, canceled→CANCELED, incomplete/expired→INCOMPLETE.
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { trialEndsAt, accessEndsAfterCancel } from "@/lib/billing/trial";
import { priceToPlan } from "@/lib/billing/price-map";
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
function planFromSubscription(subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  return priceToPlan(priceId);
}
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object;
      if (typeof s.client_reference_id !== "string") break;
      const org = await prisma.organization.update({
        where: { id: s.client_reference_id },
        data: { stripeCustomerId: (s.customer as string) ?? undefined },
      });
      const metadataPlan = s.metadata?.priceKey;
      const planKey: "STARTER" | "GROWTH" | "PRO" =
        metadataPlan === "GROWTH" || metadataPlan === "PRO" || metadataPlan === "STARTER"
          ? metadataPlan
          : await planFromSubscriptionId(s.subscription as string | null);
      await prisma.subscription.upsert({
        where: { organizationId: org.id },
        create: {
          organizationId: org.id,
          stripeSubscriptionId: (s.subscription as string) ?? null,
          planKey,
          status: s.metadata?.trial === "1" ? "TRIALING" : "ACTIVE",
          currentPeriodEnd: trialEndsAt(30),
        },
        update: { status: "ACTIVE", canceledAt: null },
      });
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object;
      // Stripe API 2025+: current_period_end moved onto subscription items.
      const periodEndSec =
        sub.items.data[0]?.current_period_end ?? Math.floor(Date.now() / 1000);
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data: {
          status: SUB_STATUS[sub.status] ?? "ACTIVE",
          planKey: planFromSubscription(sub),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          currentPeriodEnd: new Date(periodEndSec * 1000),
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
      const total = invoice.total ?? 0;
      const vat = total - (invoice.total_excluding_tax ?? total);
      await prisma.invoice.upsert({
        where: { stripeInvoiceId: invoice.id },
        create: {
          organizationId: org?.id ?? "unknown",
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
/** Resolve plan from a live subscription id (fetch once, then map price). */
async function planFromSubscriptionId(subscriptionId: string | null): Promise<"STARTER" |
    "GROWTH" | "PRO"> {
  if (!subscriptionId) return "STARTER";
  const sub = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
    select: { planKey: true },
  });
  return (sub?.planKey as "STARTER" | "GROWTH" | "PRO") ?? "STARTER";
}