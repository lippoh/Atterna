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