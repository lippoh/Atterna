// src/jobs/runner.ts — claim, execute, complete, fail (idempotent)
// V2 fix vs the V1 listing: the Json payload is cast through
// Prisma.InputJsonValue so the enqueue upsert typechecks; everything
// else — SKIP LOCKED claiming, exponential backoff, DEAD parking — is
// the V1 design unchanged.
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
export async function runNextBatch(limit = 25) {
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