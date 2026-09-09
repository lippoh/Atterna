// src/lib/cron-types.ts — the single source of truth for ?type= values
// accepted by GET /api/cron (Step 8, Phase 2).
//
// Before the Step 8 fix pack the route fell through to the sync pipeline
// for ANY unknown ?type= value — a typo in vercel.json (or a stray query
// param) silently executed the default pipeline. The route now rejects
// unknown types with 400 invalid_cron_type BEFORE touching the database.
//
// This module is deliberately dependency-free (no next/server, no Prisma)
// so unit tests (tests/unit/cron-parity.test.ts,
// tests/unit/cron-route.test.ts) can import it without the ESM issues
// that affect middleware/next-auth imports under vitest, and so
// vercel.json parity can be asserted against the exact same list the
// route dispatches on.
export const SUPPORTED_CRON_TYPES = [
  "sync",
  "weekly-report",
  "prune",
  "intel",
] as const;

export type CronType = (typeof SUPPORTED_CRON_TYPES)[number];

/**
 * Resolve the requested cron type from the raw `?type=` query value.
 *
 * - absent (null) → "sync" (the default pipeline — vercel.json's bare
 *   `/api/cron` entry relies on this)
 * - "sync" → "sync"
 * - any other SUPPORTED_CRON_TYPES value → that value
 * - anything else (including case variants like "BOGUS", or an explicit
 *   empty `?type=`) → null = unsupported → the route must answer 400
 *   invalid_cron_type and execute nothing.
 */
export function parseCronType(raw: string | null): CronType | null {
  if (raw === null || raw === "sync") return "sync";
  return (SUPPORTED_CRON_TYPES as readonly string[]).includes(raw)
    ? (raw as CronType)
    : null;
}
