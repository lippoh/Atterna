// src/ai/schemas.ts — the analysis contract (zod, shared client/server)
import { z } from "zod";
export const CATEGORY_VOCAB = [
  "waiting_time", "service", "food_quality", "prices", "cleanliness",
  "atmosphere", "location", "staff", "parking", "noise", "booking",
  "rooms", "value", "equipment", "safety", "other",
] as const;
export const analysisSchema = z.object({
  language: z.string().length(2),              // ISO 639-1
  sentiment: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE"]),
  urgency: z.enum(["LOW", "MEDIUM", "HIGH"]),
  topics: z.array(z.enum(CATEGORY_VOCAB)).max(6),
  complaints: z.array(z.object({
    category: z.enum(CATEGORY_VOCAB),
    severity: z.number().int().min(1).max(5),
    summary: z.string().min(5).max(160),
    quote: z.string().max(200).optional(),     // evidence from the text
  })).max(5),
  compliments: z.array(z.object({
    category: z.enum(CATEGORY_VOCAB),
    summary: z.string().min(5).max(160),
  })).max(5),
  actionable: z.boolean(),
  requiresResponse: z.boolean(),
});
export type Analysis = z.infer<typeof analysisSchema>;
// Compose contract — P4 output (plain text, <= 120 words in practice)
export const composeSchema = z.object({
  text: z.string().min(10).max(1200),
});
export type ComposeOutput = z.infer<typeof composeSchema>;