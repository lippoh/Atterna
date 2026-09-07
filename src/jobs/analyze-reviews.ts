// src/jobs/analyze-reviews.ts — per-review analysis + auto-drafting
// Handler for the analyze-review job; after a NEGATIVE or HIGH-urgency
// result, a response draft is pre-generated (Section 30: "drafts
// pre-generated for negative & high-urgency reviews") and the owner
// alert fires (notify-negative-review).
import { analyzeReview } from "@/ai/analyze";
import { composeReply } from "@/ai/compose";
import { enqueue } from "./runner";
import { prisma } from "@/lib/db";
export async function handleAnalyzeReview(payload: unknown): Promise<void> {
const data = (payload ?? {}) as { reviewId?: string };
if (!data.reviewId) throw new Error("NO_REVIEW_ID");
const analysis = await analyzeReview(data.reviewId);
if (analysis.sentiment === "NEGATIVE" || analysis.urgency === "HIGH") {
// Pre-generate a draft for the owner to edit and approve.
await composeReply(data.reviewId);
await enqueue(
"notify-negative-review",
{ reviewId: data.reviewId },
{ dedupeKey: `alert:${data.reviewId}` } // max 1 per review (Table 32.1)
);
}
}
/** Enqueue analysis for any reviews that slipped through (QR path, retries). */
export async function enqueuePendingAnalyses(limit = 200): Promise<number> {
const pending = await prisma.review.findMany({
where: { analysis: null, deletedAt: null, text: { not: null } },
select: { id: true },
take: limit,
});
for (const review of pending) {
await enqueue("analyze-review", { reviewId: review.id }, {
dedupeKey: `analyze:${review.id}`,
});
}
return pending.length;
}