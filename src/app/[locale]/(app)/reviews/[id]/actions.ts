// src/app/[locale]/(app)/reviews/[id]/actions.ts — draft state machine
// generate → edit → approve (DRAFT → EDITED → APPROVED → enqueue publish).
// Every action re-validates tenant scope through getScopedReview; an
// impersonated support session can read but never approve.
"use server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getScopedReview } from "@/lib/tenant";
import { composeReply } from "@/ai/compose";
import { enqueue } from "@/jobs/runner";
import { audit } from "@/lib/audit";
import { requireOrg } from "@/lib/session";
export interface DraftActionState {
ok: boolean;
text?: string;
error?: string;
}
export async function generateDraft(reviewId: string): Promise<DraftActionState> {
try {
const { orgId } = await requireOrg();
await getScopedReview(orgId, reviewId); // tenant fence
const text = await composeReply(reviewId);
return { ok: true, text };
} catch (error) {
return { ok: false, error: String(error).slice(0, 200) };
}
}
export async function saveDraft(
reviewId: string,
text: string
): Promise<DraftActionState> {
try {
const { orgId } = await requireOrg();
await getScopedReview(orgId, reviewId);
const existing = await prisma.responseDraft.findFirst({
where: { reviewId },
orderBy: { createdAt: "desc" },
});
if (existing) {
await prisma.responseDraft.update({
where: { id: existing.id },
data: { editedText: text.slice(0, 4000), status: "EDITED" },
});
} else {
await prisma.responseDraft.create({
data: {
reviewId,
status: "EDITED",
text: text.slice(0, 4000),
language: "manual",
model: "manual",
promptVersion: "manual",
editedText: text.slice(0, 4000),
},
});
}
return { ok: true };
} catch (error) {
return { ok: false, error: String(error).slice(0, 200) };
}
}
export async function approveDraft(
reviewId: string,
text: string
): Promise<DraftActionState> {
try {
const session = await auth();
if (session?.user?.impersonatedBy) {
return { ok: false, error: "IMPERSONATION_READONLY" };
}
const { orgId } = await requireOrg();
await getScopedReview(orgId, reviewId);
const draft = await prisma.responseDraft.findFirst({
where: { reviewId },
orderBy: { createdAt: "desc" },
});
const saved = draft
? await prisma.responseDraft.update({
where: { id: draft.id },
data: {
editedText: text.slice(0, 4000),
status: "APPROVED",
approvedAt: new Date(),
approvedBy: session?.user?.id,
},
})
: await prisma.responseDraft.create({
data: {
reviewId,
status: "APPROVED",
text: text.slice(0, 4000),
language: "manual",
model: "manual",
promptVersion: "manual",
approvedAt: new Date(),
approvedBy: session?.user?.id,
},
});
// Draft → APPROVED → enqueue publish (Appendix 56 route contract)
await enqueue("publish-reply", { draftId: saved.id }, {
dedupeKey: `publish:${saved.id}`,
});
await audit("draft.approved", {
userId: session?.user?.id,
entity: "responseDraft",
entityId: saved.id,
});
return { ok: true };
} catch (error) {
return { ok: false, error: String(error).slice(0, 200) };
}
}