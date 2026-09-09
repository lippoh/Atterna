// tests/unit/job-runner-recovery.test.ts — Step 8, Phase 1: stale-RUNNING
// job recovery. Against the disposable test database (real Postgres), so
// the atomicity/row-lock guarantees are exercised for real:
//   A. RUNNING job newer than threshold stays RUNNING;
//   B. RUNNING job older than threshold becomes QUEUED;
//   C. attempts are preserved (retry budget keeps counting);
//   D. a stale job can subsequently execute (recovery → claim → DONE);
//   E. concurrent recovery is safe/idempotent (real parallel UPDATEs);
//   F. DONE/DEAD rows are untouched (no resurrection of terminal states);
//   G. lastError is preserved;
//   H. normal retry/backoff and DEAD-at-5 are unchanged.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";

import {
  enqueue,
  registerJob,
  runNextBatch,
  recoverStaleRunningJobs,
  STALE_RUNNING_MS,
} from "@/jobs/runner";
import { prisma, resetTestDb } from "./helpers";

const DAY_MS = 86_400_000;

beforeAll(() => {
  // Test-only handlers — vitest isolates module state per file, so the
  // runner's handler map is ours alone in this file.
  registerJob("recovery-probe", async () => {
    /* succeeds */
  });
  registerJob("recovery-boom", async () => {
    throw new Error("BOOM_FOR_TEST");
  });
});

beforeEach(async () => {
  await resetTestDb();
});

/** Seed a job row directly (bypassing enqueue) to forge exact states. */
async function seedJob(data: {
  type?: string;
  state: string;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  attempts?: number;
  runAt?: Date;
  lastError?: string | null;
  payload?: object;
}) {
  return prisma.job.create({
    data: {
      type: data.type ?? "recovery-probe",
      payload: (data.payload ?? { n: 1 }) as object,
      dedupeKey: `seed-${crypto.randomUUID()}`,
      state: data.state,
      attempts: data.attempts ?? 0,
      runAt: data.runAt ?? new Date(Date.now() - 60_000),
      startedAt: data.startedAt ?? undefined,
      finishedAt: data.finishedAt ?? undefined,
      lastError: data.lastError ?? undefined,
    },
  });
}

describe("stale-RUNNING recovery (Phase 1)", () => {
  it("A. RUNNING job newer than the threshold stays RUNNING", async () => {
    const job = await seedJob({
      state: "RUNNING",
      startedAt: new Date(Date.now() - 2 * 60_000), // 2 min ago — active
      attempts: 3,
    });
    // The batch runner recovers before claiming; run one to prove the
    // fresh RUNNING row survives a full pass.
    const executed = await runNextBatch(10);
    expect(executed).toBe(0);
    const after = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(after.state).toBe("RUNNING");
    expect(after.startedAt).not.toBeNull(); // execution state untouched
    expect(after.attempts).toBe(3);
    await expect(recoverStaleRunningJobs()).resolves.toBe(0); // direct call too
  });

  it("B. RUNNING job older than the threshold becomes QUEUED", async () => {
    const job = await seedJob({
      state: "RUNNING",
      startedAt: new Date(Date.now() - STALE_RUNNING_MS - 60_000),
    });
    const recovered = await recoverStaleRunningJobs();
    expect(recovered).toBe(1);
    const after = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(after.state).toBe("QUEUED");
    expect(after.startedAt).toBeNull(); // cleared: describes the dead execution
    expect(after.runAt.getTime()).toBeGreaterThanOrEqual(Date.now() - 5_000); // eligible now
  });

  it("C. attempts are preserved (never reset to zero)", async () => {
    const job = await seedJob({
      state: "RUNNING",
      startedAt: new Date(Date.now() - STALE_RUNNING_MS - 60_000),
      attempts: 4, // one eviction away from DEAD
    });
    await recoverStaleRunningJobs();
    const after = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(after.attempts).toBe(4); // preserved — the 5th claim parks it DEAD
  });

  it("D. a stale job can subsequently execute (recovery inside runNextBatch)", async () => {
    const job = await seedJob({
      type: "recovery-probe",
      state: "RUNNING",
      startedAt: new Date(Date.now() - STALE_RUNNING_MS - 60_000),
      attempts: 2,
      lastError: "EVICTED: function timed out",
      payload: { n: 7 },
    });
    // One call: recovery requeues (state=QUEUED, runAt=now) → the claim
    // in the SAME call picks it up → handler runs → DONE.
    const executed = await runNextBatch(10);
    expect(executed).toBe(1);
    const after = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(after.state).toBe("DONE");
    expect(after.finishedAt).not.toBeNull();
    expect(after.attempts).toBe(3); // 2 + one more claim — budget counted
    expect(after.lastError).toBe("EVICTED: function timed out"); // kept
  });

  it("E. concurrent recovery is safe and idempotent (real parallel UPDATEs)", async () => {
    const job = await seedJob({
      state: "RUNNING",
      startedAt: new Date(Date.now() - STALE_RUNNING_MS - 60_000),
      attempts: 1,
    });
    // Two recoveries racing on the same row: Postgres row locks + the
    // state='RUNNING' re-check mean exactly one wins.
    const [r1, r2] = await Promise.all([
      recoverStaleRunningJobs(),
      recoverStaleRunningJobs(),
    ]);
    expect(r1 + r2).toBe(1);
    const after = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(after.state).toBe("QUEUED");
    expect(after.attempts).toBe(1); // not decremented, not double-counted
    // A sequential third call recovers nothing more.
    expect(await recoverStaleRunningJobs()).toBe(0);
  });

  it("F. DONE and DEAD rows are never touched (terminal states stay terminal)", async () => {
    const done = await seedJob({
      state: "DONE",
      startedAt: new Date(Date.now() - STALE_RUNNING_MS - DAY_MS),
      finishedAt: new Date(Date.now() - DAY_MS),
    });
    const dead = await seedJob({
      type: "recovery-boom",
      state: "DEAD",
      startedAt: new Date(Date.now() - STALE_RUNNING_MS - DAY_MS),
      attempts: 5,
      lastError: "BOOM_FOR_TEST",
    });
    expect(await recoverStaleRunningJobs()).toBe(0);
    expect((await prisma.job.findUniqueOrThrow({ where: { id: done.id } })).state).toBe("DONE");
    const deadAfter = await prisma.job.findUniqueOrThrow({ where: { id: dead.id } });
    expect(deadAfter.state).toBe("DEAD");
    expect(deadAfter.attempts).toBe(5);
    // And a full batch pass does not resurrect them either.
    await runNextBatch(10);
    expect((await prisma.job.findUniqueOrThrow({ where: { id: done.id } })).state).toBe("DONE");
    expect((await prisma.job.findUniqueOrThrow({ where: { id: dead.id } })).state).toBe("DEAD");
  });

  it("G. lastError is preserved across recovery", async () => {
    const job = await seedJob({
      state: "RUNNING",
      startedAt: new Date(Date.now() - STALE_RUNNING_MS - 60_000),
      attempts: 2,
      lastError: "provider 5xx before eviction",
    });
    await recoverStaleRunningJobs();
    const after = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(after.lastError).toBe("provider 5xx before eviction");
  });
});

describe("retry/backoff semantics unchanged (Phase 1 requirement H)", () => {
  it("failure → QUEUED with 4^n backoff and lastError; not re-claimed early", async () => {
    const job = await enqueue("recovery-boom", {}, { dedupeKey: "boom-1" });
    const executed = await runNextBatch(10);
    expect(executed).toBe(1);
    const after = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(after.state).toBe("QUEUED");
    expect(after.attempts).toBe(1);
    expect(after.lastError).toContain("BOOM_FOR_TEST");
    // Backoff for attempt 1 = 60s * 4^1 = 4 min (± slop).
    const delta = after.runAt.getTime() - Date.now();
    expect(delta).toBeGreaterThan(200_000);
    expect(delta).toBeLessThan(280_000);
    // Immediate second pass: runAt is in the future → not re-claimed.
    const executedAgain = await runNextBatch(10);
    expect(executedAgain).toBe(0);
    const after2 = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(after2.attempts).toBe(1);
  });

  it("DEAD at 5 attempts is unchanged (backoff walks attempts 1→5)", async () => {
    const job = await enqueue("recovery-boom", {}, { dedupeKey: "boom-5" });
    for (let i = 0; i < 5; i++) {
      await runNextBatch(10);
      const row = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
      if (i < 4) {
        expect(row.state).toBe("QUEUED");
        // Simulate the backoff elapsing so the next pass can claim it.
        await prisma.job.update({
          where: { id: job.id },
          data: { runAt: new Date(Date.now() - 60_000) },
        });
      } else {
        expect(row.state).toBe("DEAD");
        expect(row.attempts).toBe(5);
      }
    }
    // DEAD is terminal: neither recovery nor a later batch revives it.
    await prisma.job.update({
      where: { id: job.id },
      data: { runAt: new Date(Date.now() - 60_000), startedAt: new Date(Date.now() - DAY_MS) },
    });
    expect(await recoverStaleRunningJobs()).toBe(0);
    await runNextBatch(10);
    expect((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).state).toBe("DEAD");
  });

  it("successful jobs still finish DONE with finishedAt (happy path intact)", async () => {
    const job = await enqueue("recovery-probe", { ok: true }, { dedupeKey: "probe-1" });
    expect(await runNextBatch(10)).toBe(1);
    const after = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(after.state).toBe("DONE");
    expect(after.finishedAt).not.toBeNull();
    expect(after.lastError).toBeNull();
  });
});
