// src/lib/impersonate.ts — the audited, constrained support mechanism
// V2 fixes vs the V1 listing: the unused `auth` import is gone (V1
// imported it and never used it — the eslint warning you saw); the
// "impersonation" provider that signIn() targets now exists in
// src/lib/auth.ts; sessions are time-boxed and can be ended explicitly.
import { signIn } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
export async function impersonateForSupport(
  adminId: string,
  targetUserId: string,
  minutes = 20
) {
  const admin = await prisma.user.findUniqueOrThrow({ where: { id: adminId } });
  if (!admin.isAdmin) throw new Error("FORBIDDEN");
  const session = await prisma.impersonationSession.create({
    data: {
      adminId,
      targetUserId,
      expiresAt: new Date(Date.now() + minutes * 60_000),
      reason: "support", // required, shown in audit
    },
  });
  await audit("admin.impersonation.start", {
    userId: adminId,
    targetUserId,
    sessionId: session.id,
  });
  await signIn("impersonation", { sessionId: session.id }); // scoped session
  return session;
}
export async function endImpersonation(sessionId: string) {
  await prisma.impersonationSession.update({
    where: { id: sessionId },
    data: { endedAt: new Date() },
  });
  await audit("admin.impersonation.end", { sessionId });
}
// Impersonated sessions: read-only billing actions, no exports of
// customer secrets, owner receives email "support accessed your
// account at HH:MM" — transparency is the safeguard.