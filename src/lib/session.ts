// src/lib/session.ts — typed guards used by every server action
import { cache } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

// Stage B: request-scoped memoization. Pages + layouts + server actions in
// one request each call requireUser()/requireOrg(); without cache() every
// call re-hits the session store AND the membership table. cache() dedupes
// to a single auth() + single membership lookup per request.
const getSession = cache(async () => auth());

const getMembership = cache(async (userId: string) =>
  prisma.membership.findFirst({
    where: { userId },
    include: { organization: true },
  })
);

export async function requireUser() {
  const session = await getSession();
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
  const membership = await getMembership(user.id);
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