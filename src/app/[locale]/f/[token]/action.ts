// src/app/[locale]/f/[token]/actions.ts — public feedback submission
// V2 fixes vs the V1 listing: headers is imported from next/headers and
// awaited (Next 15); hashIp comes from @/lib/hash; enqueue comes from
// @/jobs/runner — the three names V1 used without importing them.
// The file is actions.ts (plural) per the guide's own tree and §23.
"use server";
import { z } from "zod";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { hashIp } from "@/lib/hash";
import { enqueue } from "@/jobs/runner";
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
select: { id: true, businessId: true, business: { select: { organizationId: true } } },
});
if (!req) return { ok: false, error: "notFound" as const };
const h = await headers();
const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0";
if (!(await rateLimit(`fb:${token}:${ip}`, 5, 3600)))
return { ok: false, error: "rateLimited" as const };
const submission = await prisma.feedbackSubmission.create({
data: {
feedbackRequestId: req.id,
businessId: req.businessId,
organizationId: req.business.organizationId,
rating,
comment: comment || null,
ipHash: hashIp(ip), // dropped automatically after 30 days (GDPR)
},
});
// negative ratings notify the owner immediately (job enqueued)
if (rating <= 3) {
await enqueue("notify-negative-feedback", { id: submission.id }, {
dedupeKey: `fb-alert:${submission.id}`,
});
}
return { ok: true, positive: rating >= 4 };
}