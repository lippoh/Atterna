// tests/unit/cron-parity.test.ts — Step 8, Phase 6: vercel.json parity.
//
// Guards against a future vercel.json entry pointing at an unsupported
// /api/cron type (which the route would now reject with 400 — the cron
// would fire and do nothing, silently). The supported set is imported
// from src/lib/cron-types.ts — the EXACT list the route dispatches on —
// so route and test can never drift apart. Also pins the three master
// schedules (the Step 8 pack must not change them) and the intentional
// intel cron.
//
// NOTE: ?type=sync is NOT required to be declared — the bare /api/cron
// schedule already invokes the sync pipeline via the default branch.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { SUPPORTED_CRON_TYPES } from "@/lib/cron-types";

interface VercelCronEntry {
  path: string;
  schedule: string;
}

const vercel = JSON.parse(
  readFileSync(resolve(__dirname, "../../vercel.json"), "utf8")
) as { crons?: VercelCronEntry[] };

function declaredType(entry: VercelCronEntry): string {
  // Vercel cron paths are relative ("/api/cron" or "/api/cron?type=…").
  const url = new URL(entry.path, "https://cron-parity.local");
  return url.searchParams.get("type") ?? "sync";
}

describe("vercel.json cron parity", () => {
  it("parses and declares a non-empty crons array", () => {
    expect(Array.isArray(vercel.crons)).toBe(true);
    expect(vercel.crons!.length).toBeGreaterThan(0);
    for (const entry of vercel.crons!) {
      expect(typeof entry.path).toBe("string");
      expect(entry.path.length).toBeGreaterThan(0);
      expect(typeof entry.schedule).toBe("string");
      expect(entry.schedule.length).toBeGreaterThan(0);
    }
  });

  it("every declared path is exactly /api/cron (nothing else is scheduled)", () => {
    for (const entry of vercel.crons!) {
      const url = new URL(entry.path, "https://cron-parity.local");
      expect(url.pathname, `unexpected cron path: ${entry.path}`).toBe("/api/cron");
    }
  });

  it("every declared cron type maps to a SUPPORTED_CRON_TYPES value", () => {
    for (const entry of vercel.crons!) {
      const type = declaredType(entry);
      expect(
        [...SUPPORTED_CRON_TYPES],
        `vercel.json declares unsupported cron type "${type}" — the route ` +
          `would answer 400 invalid_cron_type and the schedule would do ` +
          `nothing. Fix vercel.json or extend src/lib/cron-types.ts.`
      ).toContain(type);
    }
  });

  it("does not need type=sync declared — the bare /api/cron entry is the sync schedule", () => {
    const bare = vercel.crons!.filter(
      (e) => !new URL(e.path, "https://cron-parity.local").search
    );
    expect(bare.length).toBe(1); // exactly one default (sync) schedule
    expect(declaredType(bare[0])).toBe("sync");
  });

  it("has no duplicate cron paths (Vercel applies the last duplicate — keep it unambiguous)", () => {
    const paths = vercel.crons!.map((e) => e.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("protects the three master schedules (byte-exact paths + schedules)", () => {
    const pairs = vercel.crons!.map((e) => `${e.path} @ ${e.schedule}`);
    expect(pairs).toContain("/api/cron @ */30 5-21 * * *");
    expect(pairs).toContain("/api/cron?type=weekly-report @ 0 5 * * 1");
    expect(pairs).toContain("/api/cron?type=prune @ 0 2 * * *");
  });

  it("keeps the intentional intel cron (daily reputation-intelligence refresh)", () => {
    const pairs = vercel.crons!.map((e) => `${e.path} @ ${e.schedule}`);
    expect(pairs).toContain("/api/cron?type=intel @ 30 3 * * *");
  });
});
