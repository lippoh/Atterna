// src/app/api/cron/route.ts — Vercel Cron entrypoint (CRON_SECRET gate)
// vercel.json dispatches: /api/cron (sync, every 30 min daytime UTC 5-21),
// ?type=weekly-report (Mon 05:00 UTC = 08:00 Athens), ?type=prune (02:00
// UTC nightly). Vercel sends: Authorization: Bearer ${CRON_SECRET}.
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { registerAllJobs } from "@/jobs/registry";
import { runNextBatch } from "@/jobs/runner";
import { enqueueSyncs, enqueueOvernightSyncs } from "@/jobs/sync-reviews";
import { enqueuePendingAnalyses } from "@/jobs/analyze-reviews";
import { runWeeklyReports } from "@/jobs/weekly-report";
import { enqueueRefreshes } from "@/jobs/refresh-reputation";
export const maxDuration = 300;
const DAY_MS = 86_400_000;
async function runPrune(): Promise<{ jobs: number; ipHashes: number }> {
const jobs = await prisma.job.deleteMany({
where: { state: "DONE", finishedAt: { lt: new Date(Date.now() - 90 * DAY_MS) } },
});
// GDPR: ipHash auto-drop after 30 days (Appendix 59 retention schedule)
const ipHashes = await prisma.feedbackSubmission.updateMany({
where: { createdAt: { lt: new Date(Date.now() - 30 * DAY_MS) }, NOT: { ipHash: null } },
data: { ipHash: null },
});
await prisma.feedbackSubmission.deleteMany({
where: { createdAt: { lt: new Date(Date.now() - 400 * DAY_MS) } },
});
return { jobs: jobs.count, ipHashes: ipHashes.count };
}
export async function GET(req: NextRequest) {
const authorization = req.headers.get("authorization");
if (authorization !== `Bearer ${env.CRON_SECRET}`) {
return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
registerAllJobs();
const type = req.nextUrl.searchParams.get("type") ?? "sync";
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
// Daytime (05-21 UTC = 08:00-24:00 Athens) → 30-min cadence;
// overnight → the 2h companion sweep.
const enqueued =
hourUtc >= 5 && hourUtc <= 21
? await enqueueSyncs()
: await enqueueOvernightSyncs();
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