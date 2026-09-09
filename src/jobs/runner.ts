// src/jobs/runner.ts — claim, execute, complete, fail (idempotent)
// V2 fix vs the V1 listing: the Json payload is cast through
// Prisma.InputJsonValue so the enqueue upsert typechecks; everything
// else — SKIP LOCKED claiming, exponential backoff, DEAD parking — is
// the V1 design unchanged.
//
// Step 8 (Phase 1): recoverStaleRunningJobs() requeues RUNNING rows
// abandoned by evicted serverless invocations, immediately before each
// batch is claimed (see runNextBatch). Backoff and DEAD-at-5 semantics
// are unchanged.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
type Handler = (payload: unknown, job: { id: string }) => Promise<void>;
const handlers: Record<string, Handler> = {};
export function registerJob(type: string, handler: Handler) {
handlers[type] = handler;
}
export async function enqueue(
type: string,
payload: unknown,
opts: { runAt?: Date; dedupeKey?: string } = {}
) {
return prisma.job.upsert({
where: { dedupeKey: opts.dedupeKey ?? `__none_${crypto.randomUUID()}` },
create: {
type,
payload: (payload ?? {}) as Prisma.InputJsonValue,
dedupeKey: opts.dedupeKey,
runAt: opts.runAt ?? new Date(),
state: "QUEUED",
},
update: {}, // dedupe: a scheduled copy already exists
});
}
/**
 * Recovery threshold (Step 8, Phase 1): a RUNNING job whose startedAt is
 * older than 10 minutes is considered abandoned — the serverless
 * function that claimed it was terminated, timed out or evicted before
 * it could write DONE/QUEUED. The route sets maxDuration = 300 s, so
 * 10 minutes is deliberately conservative (2× maxDuration): a genuinely
 * active execution that has merely been running for a few minutes is
 * never requeued while its invocation is still alive.
 */
export const STALE_RUNNING_MS = 10 * 60_000;

/**
 * Requeue RUNNING jobs abandoned by an evicted serverless invocation.
 *
 * Safety properties:
 * - Atomic single UPDATE with an age predicate — two concurrent cron
 *   invocations cannot both recover the same row: each UPDATE re-checks
 *   state = 'RUNNING' when it acquires the row lock, so the loser
 *   matches 0 rows after the winner commits.
 * - PRESERVES id, type, dedupeKey, attempts, payload and lastError —
 *   the retry budget keeps counting, so a job that keeps losing its
 *   execution still walks attempts 1→5 and parks DEAD like any other
 *   failure (no infinite recovery loop).
 * - CLEARS startedAt (it describes the abandoned execution, not the
 *   job) and refreshes runAt = now() so the row is immediately eligible
 *   for the next claim.
 * - Terminal states (DONE, DEAD) never match the predicate — recovery
 *   cannot resurrect finished jobs.
 * Returns the number of jobs requeued (0 when nothing is stale).
 */
export async function recoverStaleRunningJobs(): Promise<number> {
const recovered = await prisma.$queryRaw<Array<{ id: string }>>`
UPDATE "Job" SET state = 'QUEUED', "startedAt" = NULL, "runAt" = now()
WHERE state = 'RUNNING'
AND "startedAt" < now() - (${STALE_RUNNING_MS} * interval '1 millisecond')
RETURNING id`;
return recovered.length;
}

export async function runNextBatch(limit = 25) {
// Phase 1: requeue RUNNING rows abandoned by evicted invocations
// BEFORE claiming the next batch. Every cron entrypoint (sync, intel)
// funnels through runNextBatch, so every schedule gets recovery for
// free. Cheap when idle: one UPDATE that matches 0 rows.
await recoverStaleRunningJobs();
const claimed = await prisma.$queryRaw<Array<{ id: string }>>`
UPDATE "Job" SET state = 'RUNNING', attempts = attempts + 1,
"startedAt" = now()
WHERE id IN (
SELECT id FROM "Job"
WHERE state = 'QUEUED' AND "runAt" <= now()
ORDER BY "runAt" ASC
FOR UPDATE SKIP LOCKED LIMIT ${limit}
)
RETURNING id`;
for (const { id } of claimed) {
const job = await prisma.job.findUniqueOrThrow({ where: { id } });
try {
const handler = handlers[job.type];
if (!handler) throw new Error(`no handler: ${job.type}`);
await handler(job.payload, job);
await prisma.job.update({
where: { id },
data: { state: "DONE", finishedAt: new Date() },
});
} catch (err) {
const backoff = Math.min(60_000 * 4 ** job.attempts, 3_600_000);
const dead = job.attempts >= 5;
await prisma.job.update({
where: { id },
data: {
state: dead ? "DEAD" : "QUEUED",
runAt: new Date(Date.now() + backoff),
lastError: String(err).slice(0, 500),
},
});
}
}
return claimed.length;
}