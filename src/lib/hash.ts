// src/lib/hash.ts — stable hashing for cache keys and IP anonymization
import { createHash } from "node:crypto";
/**
 * Deterministic content hash (sha256, hex, first 32 chars) — used for
 * AI result cache keys keyed on review content + prompt version.
 */
export function hash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 32);
}
/**
 * GDPR-safe IP fingerprint for rate limiting. The raw IP is never stored;
 * the hash is salted with AUTH_SECRET so it cannot be reversed by rainbow
 * tables. FeedbackSubmission.ipHash stores exactly this value and the
 * nightly prune drops it after 30 days.
 */
export function hashIp(ip: string): string {
  const pepper = process.env.AUTH_SECRET ?? "dev-pepper";
  return createHash("sha256").update(`${pepper}:${ip}`, "utf8").digest("hex").slice(0, 24);
}