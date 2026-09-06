// src/lib/ratelimit.ts — in-memory sliding window for public surfaces
// Login: 5/h/IP · reset: 3/h · QR submit: 5/h/token+IP (Appendix 58).
// In-memory is correct for Phase 1-2 (single Vercel region); the upgrade
// path is a Redis or Postgres bucket behind this same signature.
type Bucket = number[]; // timestamps of allowed hits
const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 10_000;
function sweep(now: number, windowSec: number): void {
  if (buckets.size < MAX_TRACKED_KEYS) return;
  for (const [key, hits] of buckets) {
    const fresh = hits.filter((t) => now - t < windowSec * 1000);
    if (fresh.length === 0) buckets.delete(key);
    else buckets.set(key, fresh);
  }
}
/**
 * Returns true when the request is allowed and records the hit.
 * rateLimit(`login:${ip}`, 5, 3600) — 5 events per hour per key.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<boolean> {
  const now = Date.now();
  sweep(now, windowSec);
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowSec * 1000);
  if (hits.length >= limit) {
    buckets.set(key, hits); // keep the window warm so abusers stay blocked
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}