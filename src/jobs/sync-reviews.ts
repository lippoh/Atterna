// src/jobs/sync-reviews.ts — scheduled GBP sync per connected business
// Cron cadence: every 30 min during 08:00–24:00 Athens (vercel.json).
// After a successful sync, every review without an analysis is enqueued
// (analysis after sync, Section 30's trigger table).
import { enqueue } from "./runner";
import { syncBusinessReviews } from "@/integrations/gbp/reviews";
import { prisma } from "@/lib/db";
const STALE_AFTER_MS = 25 * 60_000; // cron fires every 30 min
const DAY_MS = 86_400_000;
/** Enqueue one sync-reviews job per stale connected business (deduped). */
export async function enqueueSyncs(): Promise<number> {
const stale = new Date(Date.now() - STALE_AFTER_MS);
const connections = await prisma.gbpConnection.findMany({
where: {
status: "ACTIVE",
OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: stale } }],
},
select: { businessId: true },
take: 50,
});
for (const conn of connections) {
await enqueue("sync-reviews", { businessId: conn.businessId }, {
dedupeKey: `sync:${conn.businessId}`,
});
}
return connections.length;
}
export async function handleSyncReviews(payload: unknown): Promise<void> {
const data = (payload ?? {}) as { businessId?: string };
if (!data.businessId) throw new Error("NO_BUSINESS_ID");
const result = await syncBusinessReviews(data.businessId);
if (result.skipped) return;
// Chain analysis for every review that has none yet (idempotent).
const pending = await prisma.review.findMany({
where: { businessId: data.businessId, analysis: null, deletedAt: null },
select: { id: true },
take: 200,
});
for (const review of pending) {
await enqueue("analyze-review", { reviewId: review.id }, {
dedupeKey: `analyze:${review.id}`,
});
}
}
/** Nightly overnight sweep companion (2h cadence would be a cron change). */
export async function enqueueOvernightSyncs(): Promise<number> {
const overnight = new Date(Date.now() - 2 * 60 * 60_000);
const connections = await prisma.gbpConnection.findMany({
where: {
status: "ACTIVE",
OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: overnight } }],
},
select: { businessId: true },
take: 50,
});
for (const conn of connections) {
await enqueue("sync-reviews", { businessId: conn.businessId }, {
dedupeKey: `sync:${conn.businessId}`,
});
}
return connections.length;
}
void DAY_MS;