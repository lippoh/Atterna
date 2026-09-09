// src/lib/billing/trial.ts — trial period math (30-day default)
const DAY_MS = 86_400_000;
/** The moment a 30-day trial (or a new period) ends. */
export function trialEndsAt(days = 30): Date {
  return new Date(Date.now() + days * DAY_MS);
}
/** Grace window after cancellation — read-only access until this date. */
export function accessEndsAfterCancel(days = 30): Date {
  return new Date(Date.now() + days * DAY_MS);
}
/** A subscription is active for product purposes while in these states. */
export function isUsable(status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" |
    "INCOMPLETE"): boolean {
  return status === "TRIALING" || status === "ACTIVE" || status === "PAST_DUE";
}
/**
 * Stripe-trial eligibility (first-subscription-only, enforced server-side).
 * A Checkout Session may start a 30-day Stripe trial ONLY while the
 * organization has never held a Stripe subscription — the onboarding
 * product trial is local-only and does not count. Once a
 * stripeSubscriptionId exists (active, past_due or canceled), later
 * checkouts start billing immediately; plan switches belong in the
 * Billing Portal. Eligibility is computed from the LOCAL subscription
 * row's Stripe id (never from client input) because the id is written
 * exclusively by the webhook, which heard it from Stripe first.
 */
export function stripeTrialEligible(
  subscription: { stripeSubscriptionId: string | null } | null
): boolean {
  return !subscription?.stripeSubscriptionId;
}