// src/app/api/webhooks/stripe/route.ts — verified, raw body, idempotent
// V2 fixes vs the V1 listing: the webhook secret flows through the
// validated env (no non-null process.env assertion); the handler runs
// BEFORE the idempotency row is written so a failed handler leaves no
// "processed" marker and Stripe's retry re-processes safely (handlers
// are upsert-idempotent by event/invoice/subscription ids).
import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { handleStripeEvent } from "@/lib/billing/handlers";
export async function POST(req: NextRequest) {
const signature = req.headers.get("stripe-signature");
if (!signature) return new NextResponse("missing signature", { status: 400 });
const payload = await req.text(); // RAW body — required for verification
let event: Stripe.Event;
try {
event = stripe.webhooks.constructEvent(
payload,
signature,
env.STRIPE_WEBHOOK_SECRET
);
} catch {
return new NextResponse("invalid signature", { status: 400 });
}
// Idempotency: Stripe retries; process each event id exactly once.
const seen = await prisma.webhookEvent.findUnique({ where: { id: event.id } });
if (seen) return NextResponse.json({ received: true, duplicate: true });
try {
await handleStripeEvent(event); // throws → 500 → Stripe retries
} catch (error) {
console.error("stripe handler failed", event.type, error);
return new NextResponse("handler error", { status: 500 });
}
await prisma.webhookEvent
.create({ data: { id: event.id, type: event.type } })
.catch(() => undefined); // race on concurrent retry — harmless
return NextResponse.json({ received: true });
}