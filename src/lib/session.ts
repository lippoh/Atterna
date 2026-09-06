// src/lib/session.ts — typed guards used by every server action
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user as {
    id: string;
    email: string;
    locale: string;
    impersonatedBy?: string;
  };
}
export async function requireOrg(businessId?: string) {
  const user = await requireUser();
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id },
    include: { organization: true },
  });
  if (!membership) redirect("/onboarding");
  // Tenant guard: if a businessId is involved, it must belong to the org
  if (businessId) {
    const owns = await prisma.business.findFirst({
      where: { id: businessId, organizationId: membership.organizationId },
      select: { id: true },
    });
    if (!owns) throw new Error("FORBIDDEN");
  }
  return {
    user,
    orgId: membership.organizationId,
    role: membership.role,
  };
}