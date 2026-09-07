// src/jobs/registry.ts — V2 addition: wires handlers into the runner
// The V1 runner left the handlers map empty with no registration point;
// every cron invocation imports this module first so queued rows always
// find their handler. Job types: sync-reviews · analyze-review ·
// publish-reply · weekly-report · notify-negative-feedback ·
// notify-negative-review.
import { registerJob } from "./runner";
import { handleSyncReviews } from "./sync-reviews";
import { handleAnalyzeReview } from "./analyze-reviews";
import { handleWeeklyReport } from "./weekly-report";
import {
handleNotifyNegativeFeedback,
handleNotifyNegativeReview,
} from "./notify";
import { handlePublishReply } from "./publish-reply";
let registered = false;
export function registerAllJobs(): void {
if (registered) return;
registered = true;
registerJob("sync-reviews", handleSyncReviews);
registerJob("analyze-review", handleAnalyzeReview);
registerJob("publish-reply", handlePublishReply);
registerJob("weekly-report", handleWeeklyReport);
registerJob("notify-negative-feedback", handleNotifyNegativeFeedback);
registerJob("notify-negative-review", handleNotifyNegativeReview);
}