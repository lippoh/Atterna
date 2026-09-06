// src/lib/tenant.ts — tenant scoping guards for direct DB access
// requireOrg() covers actions that arrive with a businessId; these helpers
// cover the reverse direction (arriving with a review/draft/token id) so no
// code path can touch another organization's rows. The tenant-isolation
// test suite exercises the same fence.
import { prisma } from "@/lib/db";
export class ForbiddenError extends Error {
  constructor(message = "FORBIDDEN") {
    super(message);
    this.name = "ForbiddenError";
  }
}
/** Load a business only if it belongs to the organization. */
export async function getScopedBusiness(orgId: string, businessId: string) {
  const business = await prisma.business.findFirst({
    where: { id: businessId, organizationId: orgId, deletedAt: null },
  });
  if (!business) throw new ForbiddenError();
  return business;
}
/** Load a review only if its business belongs to the organization. */
export async function getScopedReview(orgId: string, reviewId: string) {
  const review = await prisma.review.findFirst({
    where: { id: reviewId, organizationId: orgId, deletedAt: null },
    include: { analysis: true, business: true, drafts: true },
  });
  if (!review) throw new ForbiddenError();
  return review;
}
/** Load a feedback request only if its business belongs to the organization. */
export async function getScopedFeedbackRequest(orgId: string, requestId: string) {
  const request = await prisma.feedbackRequest.findFirst({
    where: { id: requestId, business: { organizationId: orgId } },
  });
  if (!request) throw new ForbiddenError();
  return request;
}
/** MANAGER-level actions (approve/publish) require at least MANAGER. */
export function assertRole(role: "OWNER" | "MANAGER", minimum: "MANAGER" | "OWNER") {
  if (minimum === "MANAGER" && role === "OWNER") return;
  if (role !== minimum) throw new ForbiddenError();
}