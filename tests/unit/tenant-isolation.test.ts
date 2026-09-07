// tests/unit/tenant-isolation.test.ts — the loud fence
// V2 fix vs the V1 listing: the helpers module (prisma, seedTwoOrgs,
// requireOrgWithBusiness) now exists; org A's metrics must never
// include org B's reviews, and a foreign business id must be refused.
// Runs against a real Postgres (DATABASE_URL — a Neon branch in CI).
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma, requireOrgWithBusiness, resetTestDb, seedTwoOrgs } from "./helpers";
import { getDashboardMetrics } from "@/lib/metrics";
afterEach(async () => {
  await resetTestDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});
describe("tenant isolation", () => {
  it("org A metrics never include org B reviews", async () => {
    const { a, b } = await seedTwoOrgs();
    const m = await getDashboardMetrics(a.org.id);
    expect(m.reviewCount).toBe(1); // A's own 5-star review only
    expect(m.rating).toBe(5); // B's 1-star review invisible to A
    const mb = await getDashboardMetrics(b.org.id);
    expect(mb.reviewCount).toBe(1);
    expect(mb.rating).toBe(1);
  });
  it("a direct fetch by foreign id must be refused by the guard", async () => {
    const { a, b } = await seedTwoOrgs();
    await expect(requireOrgWithBusiness(a.user, b.business.id)).rejects.toThrow(
      "FORBIDDEN"
    );
    await expect(requireOrgWithBusiness(a.user, a.business.id)).resolves.toEqual({
      orgId: a.org.id,
    });
  });
});
