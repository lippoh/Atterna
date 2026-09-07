// tests/unit/helpers.ts — integration test scaffolding (real Postgres)
// Exports prisma (V1's import list), resetTestDb (migrates a fresh Neon
// branch in CI), seedTwoOrgs → { a, b } bundles, and
// requireOrgWithBusiness — the requireOrg() guard logic replicated as a
// test seam (no Next request context needed under vitest).
import { prisma } from "@/lib/db";
export { prisma };
export async function resetTestDb(): Promise<void> {
  // CI: `prisma migrate deploy` runs against DATABASE_URL (a Neon branch)
  // before vitest — this hook only truncates data, never the schema.
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  const names = tables.map((t) => `"${t.tablename}"`).filter((n) => n !==
    '"_prisma_migrations"');
  if (names.length > 0) {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${names.join(", ")} RESTART IDENTITY CASCADE`
    );
  }
}
export interface OrgBundle {
  user: { id: string; email: string };
  org: { id: string; name: string };
  business: { id: string; name: string };
  review: { id: string; rating: number };
}
export async function seedTwoOrgs(): Promise<{ a: OrgBundle; b: OrgBundle }> {
  await resetTestDb();
  async function seed(n: string, rating: number): Promise<OrgBundle> {
    const user = await prisma.user.create({
      data: {
        email: `owner-${n}@example.com`,
        emailVerified: new Date(),
        passwordHash: null,
      },
    });
    const org = await prisma.organization.create({
      data: {
        name: `Org ${n.toUpperCase()}`,
        memberships: { create: { userId: user.id, role: "OWNER" } },
        businesses: { create: { name: `Business ${n}`, category: "taverna", city: "Αθήνα" } },
      },
    });
    const business = await prisma.business.findFirstOrThrow({
      where: { organizationId: org.id },
    });
    const review = await prisma.review.create({
      data: {
        organizationId: org.id,
        businessId: business.id,
        source: "GOOGLE",
        externalId: `rev-${n}-1`,
        rating,
        text: "Sample review text",
        reviewerName: "Guest",
      },
    });
    return { user, org, business, review };
  }
  const a = await seed("a", 5); // happy org
  const b = await seed("b", 1); // 1-star review that A must never see
  return { a, b };
}
/**
 * The requireOrg() tenant guard, replicated for tests: resolves the
 * caller's org, then refuses foreign business ids with FORBIDDEN.
 */
export async function requireOrgWithBusiness(
  user: { id: string },
  businessId: string
): Promise<{ orgId: string }> {
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id },
  });
  if (!membership) throw new Error("NO_ORG");
  const owns = await prisma.business.findFirst({
    where: { id: businessId, organizationId: membership.organizationId },
    select: { id: true },
  });
  if (!owns) throw new Error("FORBIDDEN");
  return { orgId: membership.organizationId };
}