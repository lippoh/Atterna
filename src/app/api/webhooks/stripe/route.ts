// src/app/api/webhooks/stripe/route.ts — verified, raw body, idempotent
import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { handleStripeEvent } from "@/lib/billing/handlers";
export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new NextResponse("missing signature", { status: 400 });
  const payload = await req.text(); // RAW body — required for verification
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      payload, signature, process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return new NextResponse("invalid signature", { status: 400 });
  }
  // Idempotency: Stripe retries; process each event id exactly once
  const seen = await prisma.webhookEvent.findUnique({ where: { id: event.id } });
  if (seen) return NextResponse.json({ received: true, duplicate: true });
  await prisma.$transaction([
    prisma.webhookEvent.create({ data: { id: event.id, type: event.type } }),
    handleStripeEvent(event), // throws -> rollback -> Stripe retries
  ]);
  return NextResponse.json({ received: true });
}