// tests/integration/tenant-isolation.test.ts — the loud fence
import { describe, it, expect, beforeAll } from "vitest";
import { prisma, resetTestDb, requireOrgWithBusiness, seedTwoOrgs } from "./helpers";
import { getDashboardMetrics } from "@/lib/metrics";
beforeAll(resetTestDb); // migrates a fresh Neon branch
describe("tenant isolation", () => {
  it("org A metrics never include org B reviews", async () => {
    const { a, b, reviewB } = await seedTwoOrgs();
    const m = await getDashboardMetrics(a.id);
    expect(m.reviewCount).toBe(0);
    expect(m.rating).toBe(0); // B's 1-star review invisible to A
    // and a direct fetch by foreign id must be refused by the guard:
    await expect(requireOrgWithBusiness(a.user, reviewB.businessId))
      .rejects.toThrow("FORBIDDEN");
  });
});