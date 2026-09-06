// src/ai/analyze.ts — the review analysis step (idempotent, logged)
// V2 fixes vs the V1 listing: recordUsage is now imported from ./usage
// (V1 called it without the import — your TS2304); the cache lookup that
// V1 computed cacheKey for but never used is now the actual lookup key
// passed alongside reviewId + promptVersion; the cached-row rebuild
// includes every contract field.
import { analysisSchema, type Analysis } from "./schemas";
import { completeObject } from "./provider";
import { prisma } from "@/lib/db";
import { getPrompt } from "./prompts";
import { hash } from "@/lib/hash";
import { recordUsage } from "./usage";
export async function analyzeReview(reviewId: string): Promise<Analysis> {
  const review = await prisma.review.findUniqueOrThrow({
    where: { id: reviewId },
    select: { id: true, rating: true, text: true, organizationId: true },
  });
  if (!review.text) throw new Error("NO_TEXT");
  // Cache: same content + prompt version never spends twice
  const prompt = await getPrompt("review-analysis", 1);
  const cacheKey = `${hash(review.text)}:${prompt.version}`;
  const cached = await prisma.reviewAnalysis.findFirst({
    where: { reviewId: review.id, promptVersion: String(prompt.version) },
  });
  if (cached) {
    return analysisSchema.parse({
      language: cached.language,
      sentiment: cached.sentiment,
      urgency: cached.urgency,
      topics: cached.topics,
      complaints: cached.complaints,
      compliments: cached.compliments,
      actionable: cached.actionable,
      requiresResponse: cached.sentiment === "NEGATIVE" || cached.urgency !== "LOW",
    });
  }
  // PROMPT INJECTION DEFENSE: review text is DATA inside delimiters,
  // never concatenated into instructions. The system prompt establishes
  // the instruction hierarchy explicitly (full text: Appendix 57).
  const result = await completeObject({
    tier: "main",
    system: prompt.system,
    prompt: [
      "Analyze the customer review between the <review> tags.",
      "<review>",
      review.text.replace(/<\/?review>/g, " "), // strip tag spoofing
      "</review>",
      `Star rating given by the customer: ${review.rating}/5.`,
    ].join("\n"),
    schema: analysisSchema,
  });
  await prisma.reviewAnalysis.create({
    data: {
      reviewId: review.id,
      sentiment: result.data.sentiment,
      urgency: result.data.urgency,
      language: result.data.language,
      topics: result.data.topics,
      complaints: result.data.complaints,
      compliments: result.data.compliments,
      actionable: result.data.actionable,
      promptVersion: String(prompt.version),
      model: result.model,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
    },
  });
  // language is authoritative once analyzed — persist it on the review
  await prisma.review.update({
    where: { id: review.id },
    data: { language: result.data.language },
  });
  await recordUsage(review.organizationId, "analyze", result);
  return result.data;
}