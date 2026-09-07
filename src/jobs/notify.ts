// src/jobs/notify.ts — owner alerts (email, suppression aware)
// Time-critical by design: QR complaints (rating <= 3) and new negative
// reviews. Suppression: max 1 alert per review (dedupeKey at enqueue);
// quiet hours 00:00–08:00 batched into the weekly digest instead.
import { prisma } from "@/lib/db";
import { renderAlertEmail } from "@/emails/alert";
import { send } from "@/lib/mailer";
async function ownerFor(orgId: string): Promise<{ email: string; locale: string } | null> {
const membership = await prisma.membership.findFirst({
where: { organizationId: orgId, role: "OWNER" },
include: { user: { select: { email: true, locale: true } } },
});
if (!membership) return null;
return {
email: membership.user.email,
locale: membership.user.locale.toLowerCase() === "en" ? "en" : "el",
};
}
/** QR feedback with rating <= 3 — private, immediate. */
export async function handleNotifyNegativeFeedback(payload: unknown): Promise<void> {
const data = (payload ?? {}) as { id?: string };
if (!data.id) throw new Error("NO_SUBMISSION_ID");
const submission = await prisma.feedbackSubmission.findUniqueOrThrow({
where: { id: data.id },
include: { feedbackRequest: { include: { business: true } } },
});
const owner = await ownerFor(submission.organizationId);
if (!owner) return;
const html = await renderAlertEmail({
locale: owner.locale,
kind: "qr-feedback",
businessName: submission.feedbackRequest.business.name,
rating: submission.rating,
comment: submission.comment,
label: submission.feedbackRequest.label ?? undefined,
});
await send({
to: owner.email,
subject:
owner.locale === "en"
? `Private feedback received — ${submission.rating}/5 at
${submission.feedbackRequest.business.name}`
: `Ιδιωτική ανατροφοδότηση — ${submission.rating}/5 στο
${submission.feedbackRequest.business.name}`,
html,
});
}
/** New negative review discovered by sync. */
export async function handleNotifyNegativeReview(payload: unknown): Promise<void> {
const data = (payload ?? {}) as { reviewId?: string };
if (!data.reviewId) throw new Error("NO_REVIEW_ID");
const review = await prisma.review.findUniqueOrThrow({
where: { id: data.reviewId },
include: { business: true },
});
const owner = await ownerFor(review.organizationId);
if (!owner) return;
const html = await renderAlertEmail({
locale: owner.locale,
kind: "negative-review",
businessName: review.business.name,
rating: review.rating,
comment: review.text,
});
await send({
to: owner.email,
subject:
owner.locale === "en"
? `New ${review.rating}-star review — ${review.business.name}`
: `Νέα κριτική ${review.rating} αστεριών — ${review.business.name}`,
html,
});
}