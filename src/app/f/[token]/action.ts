// src/app/f/[token]/actions.ts — public feedback submission
"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
const schema = z.object({
  token: z.string().min(10).max(64),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});
export async function submitFeedback(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" as const };
  const { token, rating, comment } = parsed.data;
  const req = await prisma.feedbackRequest.findUnique({
    where: { token, active: true },
    select: { id: true, businessId: true, organizationId: true },
  });
  if (!req) return { ok: false, error: "notFound" as const };
  const ip = headers().get("x-forwarded-for") ?? "0";
  if (!(await rateLimit(`fb:${token}:${ip}`, 5, 3600)))
    return { ok: false, error: "rateLimited" as const };
  await prisma.feedbackSubmission.create({
    data: {
      feedbackRequestId: req.id,
      businessId: req.businessId,
      organizationId: req.organizationId,
      rating,
      comment: comment || null,
      ipHash: hashIp(ip), // dropped automatically after 30 days (GDPR)
    },
  });
  // negative ratings notify the owner immediately (job enqueued)
  if (rating <= 3) await enqueue("notify-negative-feedback", { id: req.id });
  return { ok: true, positive: rating >= 4 };
}