// src/integrations/gbp/reviews.ts — quota-aware sync (idempotent)
// V2 fixes vs the V1 listing: the access token returned by
// refreshIfNeeded is now actually passed to gbpClient.listReviews
// (V1 computed it and never used it — the eslint warning you saw); the
// unused decrypt import is gone (refreshIfNeeded owns decryption);
// publishReply implements the Section 25 reply flow (draft → API →
// PUBLISHED with external id, review.repliedAt set).
import { prisma } from "@/lib/db";
import { refreshIfNeeded, gbpClient } from "./client";
import { mapReview } from "./mapper";
export async function syncBusinessReviews(businessId: string) {
  const conn = await prisma.gbpConnection.findUnique({
    where: { businessId },
    include: { business: true },
  });
  if (!conn || conn.status === "REVOKED") return { synced: 0, skipped: true };
  const accessToken = await refreshIfNeeded(conn); // refresh + persist
  const reviews = await gbpClient.listReviews({
    accessToken,
    locationId: conn.locationId,
    pageSize: 50, // stay inside quota headroom per poll
    maxPages: 4,
  });
  let created = 0;
  for (const r of reviews) {
    const row = mapReview(r, conn);
    const res = await prisma.review.upsert({
      where: {
        businessId_source_externalId: {
          businessId,
          source: "GOOGLE",
          externalId: row.externalId,
        },
      },
      create: {
        ...row,
        businessId,
        source: "GOOGLE",
        organizationId: conn.business.organizationId,
      },
      update: { rating: row.rating, text: row.text }, // editable at source
    });
    if (res.createdAt.getTime() === res.receivedAt.getTime()) created++;
  }
  await prisma.gbpConnection.update({
    where: { businessId },
    data: { lastSyncAt: new Date(), lastSyncError: null },
  });
  return { synced: created };
}
/**
 * Publish an approved draft through the reply endpoint and flip the
 * state machine: draft PUBLISHED with external reply id, review.repliedAt
 * set. Callers (the publish-reply job) handle retry/backoff on failure.
 */
export async function publishReply(draftId: string): Promise<void> {
  const draft = await prisma.responseDraft.findUniqueOrThrow({
    where: { id: draftId },
    include: {
      review: {
        select: {
          id: true,
          externalId: true,
          businessId: true,
          business: { include: { gbpConnection: true } },
        },
      },
    },
  });
  const conn = draft.review.business.gbpConnection;
  if (!conn) throw new Error("NO_GBP_CONNECTION");
  const accessToken = await refreshIfNeeded(conn);
  const text = draft.editedText ?? draft.text;
  const reviewName = `${conn.locationId}/reviews/${draft.review.externalId}`;
  const result = await gbpClient.updateReply({ accessToken, reviewName, text: text ?? "" });
  await prisma.responseDraft.update({
    where: { id: draftId },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
      externalReplyId: reviewName,
      failureReason: null,
    },
  });
  await prisma.review.update({
    where: { id: draft.review.id },
    data: { repliedAt: new Date() },
  });
  void result.reply.updateTime; // audit trail keeps ids, not content
}