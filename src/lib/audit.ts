// src/lib/audit.ts — append-only audit trail (auth, billing, admin, publish)
// audit("auth.login", { userId, request }) matches the V1 call sites.
// Auditing must never break the request it observes: failures are logged
// and swallowed. The "never list" (Section 37) applies — ids and actions,
// never customer content.
import { prisma } from "@/lib/db";
type RequestLike = {
  headers?: { get(name: string): string | null };
};
export interface AuditMeta {
  userId?: string;
  organizationId?: string;
  targetUserId?: string;
  sessionId?: string;
  entity?: string;
  entityId?: string;
  request?: RequestLike;
  [key: string]: unknown;
}
function extractIp(meta: AuditMeta): string | undefined {
  const req = meta.request;
  if (!req?.headers) return undefined;
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim();
  return req.headers.get("x-real-ip") ?? undefined;
}
export async function audit(action: string, meta: AuditMeta = {}): Promise<void> {
  try {
    const ip = extractIp(meta);
    await prisma.auditLog.create({
      data: {
        action,
        actorUserId: meta.userId ?? null,
        organizationId: meta.organizationId ?? null,
        entity: meta.entity ?? null,
        entityId:
          meta.entityId ?? (meta.targetUserId ? "user" : undefined) ?? null,
        ip: ip ?? null,
      },
    });
  } catch (error) {
    // Never let audit failures surface to users; Sentry sees them.
    console.error("audit write failed", action, error);
  }
}