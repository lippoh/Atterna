// src/jobs/notify.ts — owner alerts (email, suppression aware)
// Time-critical by design: QR complaints (rating <= 3) and new negative
// reviews. Suppression: max 1 alert per review (dedupeKey at enqueue).
// Quiet hours 00:00–07:59 Athens: alertRunAt() at the enqueue sites
// defers delivery to 08:00 Europe/Athens (V2.1 — the comment used to
// promise "batched into the weekly digest"; deferral is the honest,
// implemented behavior, and review alerts from the daytime sync window
// are immediate by construction).
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
/**
 * Owner-alert dispatch time: immediate during the day, deferred to
 * 08:00 Europe/Athens during quiet hours (00:00–07:59). DST-safe —
 * steps hour by hour instead of assuming a fixed UTC offset, so it
 * stays correct through the EET/EEST switches.
 */
export function alertRunAt(now = new Date()): Date {
  const athensHour = (d: Date) =>
    Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Athens",
        hour: "numeric",
        hourCycle: "h23",
      }).format(d)
    );
  if (athensHour(now) >= 8) return now;
  let t = new Date(now.getTime());
  do {
    t = new Date(t.getTime() + 3_600_000); // +1h, at most 8 iterations
  } while (athensHour(t) !== 8);
  return t;
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