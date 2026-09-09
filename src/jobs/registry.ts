// src/jobs/registry.ts — V2 addition: wires handlers into the runner
// The V1 runner left the handlers map empty with no registration point;
// every cron invocation imports this module first so queued rows always
// find their handler. Job types: sync-reviews · analyze-review ·
// publish-reply · weekly-report · notify-negative-feedback ·
// notify-negative-review · refresh-reputation (daily intel: issues →
// recommendations → deterministic score snapshot).
import { registerJob } from "./runner";
import { handleSyncReviews } from "./sync-reviews";
import { handleAnalyzeReview } from "./analyze-reviews";
import { handleWeeklyReport } from "./weekly-report";
import {
handleNotifyNegativeFeedback,
handleNotifyNegativeReview,
} from "./notify";
import { handlePublishReply } from "./publish-reply";
import { handleRefreshReputation } from "./refresh-reputation";
import { registerProvider } from "@/lib/sources/provider";
import { googleProvider } from "@/integrations/gbp/provider";
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
registerJob("refresh-reputation", handleRefreshReputation);
// Google is one provider among many — future connectors register here.
registerProvider(googleProvider);
}