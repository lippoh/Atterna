// src/ai/provider.ts — provider abstraction (swap vendors via env)
// V2 fixes vs the V1 listing: withTimeout / isRetryable / sleep /
// backoffMs / AIProviderError were referenced but never defined — they
// are now implemented here and exported for reuse (compose, reports).
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { env } from "@/lib/env";
import type { z } from "zod";
const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
export type ModelTier = "cheap" | "main" | "strong";
export function modelFor(tier: ModelTier) {
  switch (tier) {
    case "cheap": return openai(env.AI_MODEL_CHEAP);
    case "strong": return openai(env.AI_MODEL_MAIN); // reserved for reports
    default: return openai(env.AI_MODEL_MAIN);
  }
}
// ── Retry toolkit (V1 referenced; V2 defines) ─────────────────────────────
export class AIProviderError extends Error {
  status?: number;
  retryable: boolean;
  constructor(message: string, opts: { status?: number; retryable?: boolean } = {}) {
    super(message);
    this.name = "AIProviderError";
    this.status = opts.status;
    this.retryable = opts.retryable ?? false;
  }
}
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
/** Exponential backoff: 1s, 4s, 16s — capped at 15s (Section 14). */
export function backoffMs(attempt: number): number {
  return Math.min(1000 * 4 ** attempt, 15_000);
}
/** Reject after ms with a timeout error; clears the timer when settled. */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = "operation"): Promise<T>
    {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new AIProviderError(`${label} timed out after ${ms}ms`, { retryable: true });
      reject(error);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}
/** 429 / 5xx / network / timeout → retry; validation errors → not. */
export function isRetryable(error: unknown): boolean {
  if (error instanceof AIProviderError) return error.retryable;
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: number }).status;
    if (status !== undefined) return status === 429 || status >= 500;
  }
  if (error instanceof Error && /timeout|timed out|fetch failed|network/i.test(error.message)) {
    return true;
  }
  return false;
}
// ── The single entry point every feature goes through ────────────────────
// Never call a vendor SDK directly from feature code.
export async function completeObject<T>(opts: {
  tier: ModelTier;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  maxRetries?: number;
  timeoutMs?: number;
}): Promise<{ data: T; tokensIn: number; tokensOut: number; model: string }> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= (opts.maxRetries ?? 1); attempt++) {
    try {
      const { object, usage, response } = await withTimeout(
        generateObject({
          model: modelFor(opts.tier),
          schema: opts.schema,
          system: opts.system,
          prompt: opts.prompt,
          temperature: 0.2,
        }),
        opts.timeoutMs ?? 20_000,
        "generateObject"
      );
      return {
        data: object,
        tokensIn: usage?.promptTokens ?? 0,
        tokensOut: usage?.completionTokens ?? 0,
        model: response.modelId,
      };
    } catch (err) {
      lastError = err;
      if (!isRetryable(err)) break;
      await sleep(backoffMs(attempt)); // 1000 * 4^attempt, capped 15s
    }
  }
  if (lastError instanceof AIProviderError) throw lastError;
  throw new AIProviderError(String(lastError));
}