// src/jobs/notify.ts — owner alerts (email, retry-wired)
// Time-critical by design: QR complaints (rating <= 3) and new negative
// reviews. Suppression: max 1 alert per review (dedupeKey at enqueue).
// Quiet hours 00:00–07:59 Athens: alertRunAt() at the enqueue sites
// defers delivery to 08:00 Europe/Athens (V2.1 — the comment used to
// promise "batched into the weekly digest"; deferral is the honest,
// implemented behavior, and review alerts from the daytime sync window
// are immediate by construction).
//
// Step 7 (email deliverability): a failed send THROWS. mailer.send()
// never throws by design — it returns { ok, error } — so swallowing
// that result marked the job DONE and silently lost the alert. Now an
// { ok: false } rejects the handler, the job runner re-queues it with
// exponential backoff (up to 5 attempts, then DEAD with lastError),
// and every email also carries the template's plain-text twin.
import { prisma } from "@/lib/db";
import { renderAlertEmail, renderAlertEmailText } from "@/emails/alert";
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
/** Owner-alert contract: a rejected handler is a retried alert. */
async function sendOwnerAlert(input: {
  to: string;
  subject: string;
  props: Parameters<typeof renderAlertEmail>[0];
}): Promise<void> {
  const [html, text] = await Promise.all([
    renderAlertEmail(input.props),
    renderAlertEmailText(input.props),
  ]);
  const result = await send({ to: input.to, subject: input.subject, html, text });
  if (!result.ok) {
    // Transient provider failure (5xx / network): throw so the job runner
    // re-queues with backoff. Never swallow an owner alert.
    throw new Error(`ALERT_SEND_FAILED: ${result.error}`);
  }
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
  const props = {
    locale: owner.locale,
    kind: "qr-feedback" as const,
    businessName: submission.feedbackRequest.business.name,
    rating: submission.rating,
    comment: submission.comment,
    label: submission.feedbackRequest.label ?? undefined,
  };
  await sendOwnerAlert({
    to: owner.email,
    subject:
      owner.locale === "en"
        ? `Private feedback received — ${submission.rating}/5 at ${submission.feedbackRequest.business.name}`
        : `Ιδιωτική ανατροφοδότηση — ${submission.rating}/5 στο ${submission.feedbackRequest.business.name}`,
    props,
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
  const props = {
    locale: owner.locale,
    kind: "negative-review" as const,
    businessName: review.business.name,
    rating: review.rating,
    comment: review.text,
  };
  await sendOwnerAlert({
    to: owner.email,
    subject:
      owner.locale === "en"
        ? `New ${review.rating}-star review — ${review.business.name}`
        : `Νέα κριτική ${review.rating} αστεριών — ${review.business.name}`,
    props,
  });
}
