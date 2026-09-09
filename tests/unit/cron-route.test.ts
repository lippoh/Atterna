// tests/unit/cron-route.test.ts — Step 8, Phases 2 + 7: GET /api/cron.
// The route imports cleanly under vitest (no next-auth in its import
// chain — unlike middleware, see middleware-routing.test.ts), so the
// GET handler is exercised directly with constructed NextRequests
// against the disposable test database:
//   - auth is FIRST: no/wrong secret → 401 even for a bogus type;
//   - absent ?type= and ?type=sync → the default sync pipeline;
//   - weekly-report / prune / intel → only their own pipeline;
//   - unknown types (bogus, BOGUS, empty) → 400 invalid_cron_type and
//     NO job execution;
//   - prune reports the submissions count and its retention behavior is
//     intact (90d DONE jobs, 30d ipHash, 400d submissions; business /
//     reputation rows untouched).
import { describe, it, expect, beforeEach } from "vitest";

process.env.CRON_SECRET = "unit-test-cron-secret-1234";

import { NextRequest } from "next/server";
import { GET } from "@/app/api/cron/route";
import { parseCronType, SUPPORTED_CRON_TYPES } from "@/lib/cron-types";
import { prisma, resetTestDb, seedTwoOrgs } from "./helpers";

const SECRET = process.env.CRON_SECRET;
const DAY_MS = 86_400_000;

function cronReq(type?: string, authorization?: string) {
  const qs = type !== undefined ? `?type=${type}` : "";
  const url = `http://localhost:3000/api/cron${qs}`;
  const headers: Record<string, string> = {};
  if (authorization !== undefined) headers.authorization = authorization;
  return new NextRequest(url, { headers });
}
const AUTH = `Bearer ${SECRET}`;
const WRONG = "Bearer definitely-not-the-secret";
async function body(res: Response) {
  return (await res.json()) as Record<string, unknown>;
}

beforeEach(async () => {
  await resetTestDb();
});

describe("authentication is first and fail-closed", () => {
  it("no Authorization header → 401 (even for a bogus type — no dispatch leak)", async () => {
    const res = await GET(cronReq("bogus"));
    expect(res.status).toBe(401);
    expect((await body(res)).error).toBe("unauthorized");
  });

  it("wrong Bearer → 401", async () => {
    const res = await GET(cronReq(undefined, WRONG));
    expect(res.status).toBe(401);
  });

  it("same-length wrong Bearer → 401 (timingSafeEqual mismatch path)", async () => {
    // Same byte length as the real header — only the constant-time
    // comparison itself can reject it.
    const res = await GET(cronReq(undefined, `Bearer ${"X".repeat(SECRET.length)}`));
    expect(res.status).toBe(401);
  });

  it("a correct secret is accepted (sanity — the gate passes)", async () => {
    const res = await GET(cronReq(undefined, AUTH));
    expect(res.status).toBe(200);
  });
});

describe("type dispatch (Phase 2)", () => {
  it("absent type → default sync pipeline", async () => {
    const res = await GET(cronReq(undefined, AUTH));
    expect(res.status).toBe(200);
    const json = await body(res);
    expect(json.ok).toBe(true);
    expect(json.type).toBe("sync");
    expect(json).toHaveProperty("executed"); // sync pipeline shape
  });

  it("type=sync → default sync pipeline", async () => {
    const res = await GET(cronReq("sync", AUTH));
    expect(res.status).toBe(200);
    const json = await body(res);
    expect(json.type).toBe("sync");
    expect(json).toHaveProperty("executed");
  });

  it("type=weekly-report → weekly report ONLY (no sync keys in the response)", async () => {
    const res = await GET(cronReq("weekly-report", AUTH));
    expect(res.status).toBe(200);
    const json = await body(res);
    expect(json.type).toBe("weekly-report");
    expect(json).toHaveProperty("sent");
    expect(json).toHaveProperty("failed");
    expect(json).toHaveProperty("skipped");
    expect(json).not.toHaveProperty("executed"); // sync pipeline did not run
    expect(json).not.toHaveProperty("enqueued");
  });

  it("type=prune → prune only, reporting jobs, ipHashes AND submissions", async () => {
    const res = await GET(cronReq("prune", AUTH));
    expect(res.status).toBe(200);
    const json = await body(res);
    expect(json.type).toBe("prune");
    expect(json).toHaveProperty("jobs");
    expect(json).toHaveProperty("ipHashes");
    expect(json).toHaveProperty("submissions"); // Phase 7 addition
    expect(json).not.toHaveProperty("executed");
  });

  it("type=intel → intel only (enqueued/executed shape)", async () => {
    const res = await GET(cronReq("intel", AUTH));
    expect(res.status).toBe(200);
    const json = await body(res);
    expect(json.type).toBe("intel");
    expect(json).toHaveProperty("enqueued");
    expect(json).toHaveProperty("executed");
  });

  it("type=bogus → 400 invalid_cron_type and NO job is enqueued or executed", async () => {
    const res = await GET(cronReq("bogus", AUTH));
    expect(res.status).toBe(400);
    expect((await body(res)).error).toBe("invalid_cron_type");
    expect(await prisma.job.count()).toBe(0); // nothing touched the queue
  });

  it("type=BOGUS → 400 (case-sensitive)", async () => {
    const res = await GET(cronReq("BOGUS", AUTH));
    expect(res.status).toBe(400);
    expect((await body(res)).error).toBe("invalid_cron_type");
  });

  it("type= (explicit empty) → 400", async () => {
    const res = await GET(cronReq("", AUTH));
    expect(res.status).toBe(400);
    expect((await body(res)).error).toBe("invalid_cron_type");
  });
});

describe("parseCronType matrix (the shared source of truth)", () => {
  it("maps exactly the supported set", () => {
    expect([...SUPPORTED_CRON_TYPES]).toEqual([
      "sync",
      "weekly-report",
      "prune",
      "intel",
    ]);
  });

  it("null → sync (vercel.json's bare /api/cron entry)", () => {
    expect(parseCronType(null)).toBe("sync");
  });

  it("supported values pass through", () => {
    expect(parseCronType("sync")).toBe("sync");
    expect(parseCronType("weekly-report")).toBe("weekly-report");
    expect(parseCronType("prune")).toBe("prune");
    expect(parseCronType("intel")).toBe("intel");
  });

  it("anything else is rejected (null)", () => {
    expect(parseCronType("bogus")).toBeNull();
    expect(parseCronType("BOGUS")).toBeNull();
    expect(parseCronType("SYNC")).toBeNull();
    expect(parseCronType("")).toBeNull();
    expect(parseCronType("weekly")).toBeNull();
  });
});

describe("prune retention behavior (Phase 7)", () => {
  it("deletes only what fell out of retention; business data untouched", async () => {
    const { a } = await seedTwoOrgs();
    const request = await prisma.feedbackRequest.create({
      data: {
        businessId: a.business.id,
        token: `prune-${Date.now()}`,
        label: "QR",
        active: true,
      },
    });
    const oldSub = await prisma.feedbackSubmission.create({
      data: {
        feedbackRequestId: request.id,
        businessId: a.business.id,
        organizationId: a.org.id,
        rating: 3,
        comment: "ancient",
        ipHash: "old-hash",
        createdAt: new Date(Date.now() - 401 * DAY_MS),
      },
    });
    const midSub = await prisma.feedbackSubmission.create({
      data: {
        feedbackRequestId: request.id,
        businessId: a.business.id,
        organizationId: a.org.id,
        rating: 4,
        ipHash: "mid-hash",
        createdAt: new Date(Date.now() - 35 * DAY_MS),
      },
    });
    const newSub = await prisma.feedbackSubmission.create({
      data: {
        feedbackRequestId: request.id,
        businessId: a.business.id,
        organizationId: a.org.id,
        rating: 5,
        ipHash: "new-hash",
      },
    });
    // Jobs: one DONE 91d old (deleted), one DONE recent (kept), one
    // RUNNING (kept — only DONE rows are pruned).
    await prisma.job.create({
      data: { type: "x", payload: {}, state: "DONE", finishedAt: new Date(Date.now() - 91 * DAY_MS) },
    });
    await prisma.job.create({
      data: { type: "x", payload: {}, state: "DONE", finishedAt: new Date() },
    });
    await prisma.job.create({
      data: { type: "x", payload: {}, state: "RUNNING", startedAt: new Date() },
    });

    const res = await GET(cronReq("prune", AUTH));
    expect(res.status).toBe(200);
    const json = await body(res);

    expect(json.jobs).toBe(1); // only the 91d-old DONE job
    expect(json.ipHashes).toBe(2); // 401d-old + 35d-old had ipHashes nulled
    expect(json.submissions).toBe(1); // only the 401d-old submission deleted

    // The 35d-old submission survives with its ipHash dropped (GDPR 30d).
    const mid = await prisma.feedbackSubmission.findUniqueOrThrow({
      where: { id: midSub.id },
    });
    expect(mid.ipHash).toBeNull();
    // The fresh submission is untouched.
    const fresh = await prisma.feedbackSubmission.findUniqueOrThrow({
      where: { id: newSub.id },
    });
    expect(fresh.ipHash).toBe("new-hash");
    // The ancient one is gone.
    expect(await prisma.feedbackSubmission.findUnique({ where: { id: oldSub.id } })).toBeNull();

    // Business/reputation data is NEVER pruned.
    expect(await prisma.business.count()).toBeGreaterThanOrEqual(2);
    expect(await prisma.review.count()).toBeGreaterThanOrEqual(2);
    expect(await prisma.feedbackRequest.count({ where: { id: request.id } })).toBe(1);
    expect(await prisma.reportLog.count()).toBe(0); // nothing written, nothing deleted
  });
});
