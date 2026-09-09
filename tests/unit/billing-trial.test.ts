// tests/unit/billing-trial.test.ts — Stripe-trial eligibility rules
// The first-subscription-only policy: server-side, client input can never
// influence it. See src/lib/billing/trial.ts (stripeTrialEligible) and the
// checkout action that consumes it.
import { describe, expect, it } from "vitest";
import { stripeTrialEligible } from "@/lib/billing/trial";

describe("stripeTrialEligible (first Stripe subscription only)", () => {
  it("allows a trial before any Stripe subscription exists", () => {
    // Fresh organization (no Subscription row yet).
    expect(stripeTrialEligible(null)).toBe(true);
    // Onboarding product trial: local-only, no Stripe id yet.
    expect(stripeTrialEligible({ stripeSubscriptionId: null })).toBe(true);
  });

  it("refuses a trial once a Stripe subscription has ever existed", () => {
    // Active subscription.
    expect(stripeTrialEligible({ stripeSubscriptionId: "sub_123" })).toBe(false);
    // The id is retained after cancellation (first-subscription-ONLY rule —
    // re-subscribing after cancel must start billing immediately).
    expect(stripeTrialEligible({ stripeSubscriptionId: "sub_canceled" })).toBe(false);
  });
});
