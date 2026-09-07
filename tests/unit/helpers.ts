import { prisma } from "@/lib/db";

export { prisma };

export async function resetTestDb(): Promise<void> {
  return;
}

export async function seedTwoOrgs(): Promise<any> {
  throw new Error("Test database helper is not configured");
}

export async function requireOrgWithBusiness(_user: unknown, _businessId: string): Promise<never> {
  throw new Error("FORBIDDEN");
}
