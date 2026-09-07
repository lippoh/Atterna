// src/jobs/publish-reply.ts — V2 addition (Section 25 reply flow)
// approveDraft enqueues this; it drives the approved draft through the
// GBP reply endpoint with retry/backoff handled by the runner.
import { publishReply } from "@/integrations/gbp/reviews";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
export async function handlePublishReply(
payload: unknown,
job: { id: string }
): Promise<void> {
const data = (payload ?? {}) as { draftId?: string };
if (!data.draftId) throw new Error("NO_DRAFT_ID");
try {
await publishReply(data.draftId);
} catch (error) {
// Leave the draft APPROVED-but-unpublished for one-tap retry;
// mark FAILED only on content-shaped errors (400s).
const status = (error as { status?: number }).status;
if (status !== undefined && status < 500 && status !== 429) {
await prisma.responseDraft.update({
where: { id: data.draftId },
data: { status: "FAILED", failureReason: String(error).slice(0, 300) },
});
throw new Error(`PUBLISH_FAILED_PERMANENT: ${String(error).slice(0, 200)}`);
}
throw error; // 403 scope / 429 quota / 5xx → runner retries with backoff
}
await audit("reply.published", {
entity: "responseDraft",
entityId: data.draftId,
});
void job.id;
}