// src/ai/compose.ts — response drafting (P4, Appendix 57)
// The business's tone settings are injected as a structured SETTINGS
// block; the review and its analysis as a delimited REVIEW block; the
// draft lands as a ResponseDraft in DRAFT status — never auto-published.
import { composeSchema } from "./schemas";
import { completeObject } from "./provider";
import { prisma } from "@/lib/db";
import { getPrompt } from "./prompts";
import { recordUsage } from "./usage";
interface AiSettings {
  tone?: string; // friendly | formal | warm
  signature?: string;
  forbiddenPhrases?: string[];
}
export async function composeReply(reviewId: string): Promise<string> {
  const review = await prisma.review.findUniqueOrThrow({
    where: { id: reviewId },
    include: { analysis: true, business: { select: { aiSettings: true, organizationId: true } }
    },
  });
  if (!review.text) throw new Error("NO_TEXT");
  const prompt = await getPrompt("response-compose", 1);
  const settings = (review.business.aiSettings ?? {}) as AiSettings;
  const settingsBlock = [
    "SETTINGS",
    `tone: ${settings.tone ?? "friendly"}`,
    `signature: ${settings.signature ?? "—"}`,
    `forbiddenPhrases: ${(settings.forbiddenPhrases ?? []).join(", ") || "none"}`,
  ].join("\n");
  const reviewBlock = [
    "REVIEW",
    `rating: ${review.rating}/5`,
    `language: ${review.analysis?.language ?? review.language ?? "el"}`,
    `text: ${review.text.replace(/<\/?review>/g, " ")}`,
  ].join("\n");
  const result = await completeObject({
    tier: "main",
    system: prompt.system,
    prompt: [
      "Draft the owner's public reply using the blocks below.",
      settingsBlock,
      reviewBlock,
    ].join("\n\n"),
    schema: composeSchema,
  });
  await prisma.responseDraft.create({
    data: {
      reviewId: review.id,
      status: "DRAFT",
      text: result.data.text,
      language: review.analysis?.language ?? review.language ?? "el",
      model: result.model,
      promptVersion: String(prompt.version),
    },
  });
  await recordUsage(review.business.organizationId, "compose", result);
  return result.data.text;
}