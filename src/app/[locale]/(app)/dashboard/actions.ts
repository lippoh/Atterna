// src/app/[locale]/(app)/dashboard/actions.ts — the issue/recommendation
// status workflow (spec §20): Open → In progress → Resolved / Dismissed.
// Server actions with tenant fencing; resolving an issue closes its
// rule-based recommendations (the feedback loop measures improvement).
"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/session";
import { audit } from "@/lib/audit";

const ISSUE_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "DISMISSED"] as const;
const REC_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "DISMISSED"] as const;
type Status = (typeof ISSUE_STATUSES)[number];

function parseStatus(raw: FormDataEntryValue | null, allowed: readonly string[]): Status | null {
  const value = String(raw ?? "");
  return (allowed as readonly string[]).includes(value) ? (value as Status) : null;
}

export async function setIssueStatusAction(formData: FormData): Promise<void> {
  const { orgId, user } = await requireOrg();
  const id = String(formData.get("issueId") ?? "");
  const status = parseStatus(formData.get("status"), ISSUE_STATUSES);
  if (!status) return;
  // Tenant fence: the issue's business must belong to the caller's org.
  const issue = await prisma.issue.findFirst({
    where: { id, business: { organizationId: orgId } },
    select: { id: true, category: true, kind: true, businessId: true },
  });
  if (!issue) return;
  await prisma.issue.update({
    where: { id: issue.id },
    data: { status, updatedAt: new Date() },
  });
  if (status === "RESOLVED" || status === "DISMISSED") {
    await prisma.recommendation.updateMany({
      where: { issueId: issue.id, source: "RULES", status: { in: ["OPEN", "IN_PROGRESS"] } },
      data: { status: "RESOLVED", resolvedAt: new Date(), updatedAt: new Date() },
    });
  }
  await audit(`issue.${status.toLowerCase()}`, {
    userId: user.id,
    organizationId: orgId,
    entity: "issue",
    entityId: issue.id,
  });
  revalidatePath("/dashboard");
}

export async function setRecommendationStatusAction(formData: FormData): Promise<void> {
  const { orgId, user } = await requireOrg();
  const id = String(formData.get("recommendationId") ?? "");
  const status = parseStatus(formData.get("status"), REC_STATUSES);
  if (!status) return;
  const recommendation = await prisma.recommendation.findFirst({
    where: { id, business: { organizationId: orgId } },
    select: { id: true, businessId: true },
  });
  if (!recommendation) return;
  await prisma.recommendation.update({
    where: { id: recommendation.id },
    data: {
      status,
      resolvedAt: status === "RESOLVED" ? new Date() : null,
      updatedAt: new Date(),
    },
  });
  await audit(`recommendation.${status.toLowerCase()}`, {
    userId: user.id,
    organizationId: orgId,
    entity: "recommendation",
    entityId: recommendation.id,
  });
  revalidatePath("/dashboard");
}
