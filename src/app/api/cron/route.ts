// src/app/api/cron/route.ts — Vercel Cron entrypoint (CRON_SECRET gate)
// vercel.json dispatches: /api/cron (sync, every 30 min daytime UTC 5-21),
// ?type=weekly-report (Mon 05:00 UTC = 08:00 Athens in summer / 07:00 in
// winter), ?type=prune (02:00 UTC nightly), ?type=intel (03:30 UTC daily).
// Vercel sends: Authorization: Bearer ${CRON_SECRET}.
//
// Step 8 fix pack:
// - Authentication is FIRST and constant-time (timingSafeEqual) — an
//   unauthenticated caller gets 401 before learning anything else.
// - Unknown ?type= values are rejected with 400 invalid_cron_type
//   instead of silently falling through to the sync pipeline (the
//   supported set lives in src/lib/cron-types.ts, shared with the
//   vercel.json parity test).
// - ?type=prune reports the number of FeedbackSubmission rows deleted
//   ("submissions") next to jobs and ipHashes.
// - The dead overnight-sync branch is gone: the master cron schedule
//   (*/30 5-21 * * *) never fires 22:00–04:59 UTC, so it was unreachable.
// - Stale-RUNNING job recovery runs inside runNextBatch before claiming.
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { registerAllJobs } from "@/jobs/registry";
import { runNextBatch } from "@/jobs/runner";
import { enqueueSyncs } from "@/jobs/sync-reviews";
import { enqueuePendingAnalyses } from "@/jobs/analyze-reviews";
import { runWeeklyReports } from "@/jobs/weekly-report";
import { enqueueRefreshes } from "@/jobs/refresh-reputation";
import { parseCronType } from "@/lib/cron-types";
export const maxDuration = 300;
const DAY_MS = 86_400_000;
async function runPrune(): Promise<{ jobs: number; ipHashes: number; submissions: number }> {
const jobs = await prisma.job.deleteMany({
where: { state: "DONE", finishedAt: { lt: new Date(Date.now() - 90 * DAY_MS) } },
});
// GDPR: ipHash auto-drop after 30 days (Appendix 59 retention schedule)
const ipHashes = await prisma.feedbackSubmission.updateMany({
where: { createdAt: { lt: new Date(Date.now() - 30 * DAY_MS) }, NOT: { ipHash: null } },
data: { ipHash: null },
});
// Anonymous feedback submissions fall out of retention after 400 days.
// Only Job rows and FeedbackSubmission rows are ever pruned — Review,
// Business, ReportLog, FeedbackRequest and all other business/reputation
// data are NEVER deleted here.
const submissions = await prisma.feedbackSubmission.deleteMany({
where: { createdAt: { lt: new Date(Date.now() - 400 * DAY_MS) } },
});
return { jobs: jobs.count, ipHashes: ipHashes.count, submissions: submissions.count };
}
/**
 * Constant-time Bearer check (Step 8, Phase 8). Length is compared first
 * because timingSafeEqual throws on unequal buffer lengths — and the
 * header length rides on the wire anyway, so comparing it leaks nothing.
 * No larger auth abstraction on purpose.
 */
function isAuthorizedCron(authorization: string | null): boolean {
if (authorization === null) return false;
const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`, "utf8");
const provided = Buffer.from(authorization, "utf8");
return expected.length === provided.length && timingSafeEqual(expected, provided);
}
export async function GET(req: NextRequest) {
// Authentication FIRST: an unauthenticated (or wrong-secret) caller
// must receive 401 even for an invalid ?type= — never a hint about the
// route's dispatch behavior. Fail-closed: if CRON_SECRET is unset the
// lazy env validator throws → 500, not an auth bypass.
if (!isAuthorizedCron(req.headers.get("authorization"))) {
return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
const type = parseCronType(req.nextUrl.searchParams.get("type"));
if (type === null) {
// Unknown/unsupported ?type= — reject loudly instead of silently
// running the default sync pipeline. Nothing is enqueued or executed.
return NextResponse.json({ error: "invalid_cron_type" }, { status: 400 });
}
registerAllJobs();
const hourUtc = new Date().getUTCHours();
switch (type) {
case "weekly-report": {
const result = await runWeeklyReports();
return NextResponse.json({ ok: true, type, ...result });
}
case "prune": {
const result = await runPrune();
return NextResponse.json({ ok: true, type, ...result });
}
case "intel": {
// Daily 03:30 UTC: refresh issues, recommendations and the
// deterministic health snapshot for every active business.
const enqueued = await enqueueRefreshes();
const executed = await runNextBatch(50);
return NextResponse.json({ ok: true, type: "intel", enqueued, executed });
}
case "sync":
default: {
// Master schedule */30 5-21 * * * → 30-min cadence inside the window;
// enqueueSyncs applies its own 25-min staleness guard, so a manual
// invocation outside the window still only picks up stale connections.
// (The overnight 2h-sweep branch was unreachable dead code — the cron
// never fires 22:00–04:59 UTC — and was removed by the Step 8 pack.)
const enqueued = await enqueueSyncs();
const pending = await enqueuePendingAnalyses();
let executed = await runNextBatch(25);
// After a daytime sync, keep the intelligence fresh (daily dedupe).
if (hourUtc >= 5 && hourUtc <= 21) {
await enqueueRefreshes();
executed += await runNextBatch(25);
}
return NextResponse.json({ ok: true, type: "sync", enqueued, pending, executed });
}
}
}
