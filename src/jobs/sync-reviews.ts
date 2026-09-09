// src/jobs/sync-reviews.ts — scheduled GBP sync per connected business
// Cron cadence: every 30 min during 08:00–24:00 Athens (vercel.json).
// After a successful sync, every review without an analysis is enqueued
// (analysis after sync, Section 30's trigger table).
import { enqueue } from "./runner";
import { syncBusinessReviews } from "@/integrations/gbp/reviews";
import { prisma } from "@/lib/db";
const STALE_AFTER_MS = 25 * 60_000; // cron fires every 30 min
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
// Note (Step 8): the overnight 2h-sweep companion (2h staleness variant
// of enqueueSyncs) was removed as dead code — the master cron schedule
// (*/30 5-21 * * *) never fires 22:00–04:59 UTC, so the branch that
// called it was unreachable. If the schedule is EVER extended to
// overnight hours, enqueueSyncs' 25-min staleness guard already keeps
// the 30-min cadence safe; reintroduce a 2h-staleness variant only if a
// sparser overnight cadence is explicitly wanted.