# Atterna Billing Architecture (Stripe)

This document records the billing architecture as implemented after the
Stripe fix pack (2026-09), the decisions behind it, and the one
documented exception to the single-writer rule. It is the reference for
any future billing change.

## The contract

1. **Stripe is the source of truth for billing.** Plan keys
   (`STARTER` / `GROWTH` / `PRO`) and subscription statuses are derived
   from Stripe objects (price ids, subscription status), never computed
   locally.
2. **The Atterna webhook (`src/app/api/webhooks/stripe/route.ts`) is the
   only code path that changes local subscription state.** All
   `prisma.subscription` / `prisma.invoice` write sites live in
   `src/lib/billing/handlers.ts`, which only the webhook calls. (One
   documented exception — see "Onboarding trial" below.)
3. **Synchronous server code may create Checkout / Billing Portal
   sessions and read Stripe state, but never writes subscription
   state.** `src/lib/stripe.ts` + the billing page actions follow this.
4. **The webhook verifies Stripe signatures** on the raw request body
   (`await req.text()` + `constructEvent`); missing, invalid, tampered
   or stale-timestamp signatures are rejected with 400.
5. **Webhook processing is idempotent by Stripe `event.id`.** The
   `WebhookEvent` table uses the Stripe event id as its primary key; a
   duplicate delivery returns `{ received: true, duplicate: true }`.
   The "processed" marker is written only AFTER the handler succeeds,
   so failed handlers are retried by Stripe.
6. **Stripe invoice ids are unique locally** (`Invoice.stripeInvoiceId
   @unique`); `invoice.paid` upserts by that key.
7. **Handled events:** `checkout.session.completed`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.paid`, `invoice.payment_failed`.
8. **Stripe Tax does the VAT math.** Checkout Sessions are created with
   `automatic_tax: { enabled: true }`; the recurring Prices carry an
   explicit `tax_behavior` (inclusive). Application code only READS
   Stripe's `total` / `total_excluding_tax` into `Invoice.vatCents`.
9. **Plans map through environment variables**
   (`STRIPE_PRICE_STARTER` / `STRIPE_PRICE_GROWTH` / `STRIPE_PRICE_PRO`).
   A Stripe price that maps to none of them is a misconfiguration: the
   handler fails loudly (500 → Stripe retry + Dashboard visibility)
   instead of silently defaulting to STARTER.
10. **Test and live credentials are never mixed.** Prefixes are
    validated (`sk_…`, `whsec_…`, `price_…`); see README-INSTALL.md for
    the test/live discipline.

## API routing (the 2026-09 production blocker fix)

The middleware matcher excludes `/api/*`. Before this fix, next-intl
rewrote every `/api` request into the `[locale]` segment (default
locale: internal rewrite to `/el/api/...`; detected non-default locale:
307 redirect to `/en/api/...`), and since API routes live outside
`src/app/[locale]`, the entire API surface 404'd — Stripe deliveries,
auth, cron and health included. `tests/unit/middleware-routing.test.ts`
guards the matcher; `scripts/verify-webhook-routing.mjs` proves the
route end-to-end against a running build.

## Trial policy (first Stripe subscription only)

- Onboarding grants a **local 30-day product trial** (no Stripe
  customer, no card) — see the exception below.
- The **first** Checkout Session for an organization starts a 30-day
  Stripe trial (`subscription_data.trial_period_days`); eligibility is
  computed server-side from the local Subscription row
  (`stripeTrialEligible`: no `stripeSubscriptionId` yet). The id is
  written only by the webhook, so client input can never influence
  eligibility.
- After the first subscription (active, past-due or canceled), further
  checkouts bill immediately; plan switches belong in the Billing
  Portal (Stripe proration).
- The webhook reads trial/period dates from the Stripe subscription
  object (`trial_end`, `items[].current_period_end`) — never a
  hardcoded 30 days.

## Onboarding trial: the documented single-writer exception

**Decision: the synchronous Subscription creation in onboarding stays,
as an explicitly documented pre-Stripe INITIAL state.**

`src/app/[locale]/(app)/onboarding/page.tsx` creates, atomically with
the organization:

```ts
subscription: { create: { planKey: "STARTER", status: "TRIALING",
                          currentPeriodEnd: trialEndsAt(30) } }
```

Rationale:

- It is an **initial state, not a billing transition**: there is no
  Stripe customer or subscription yet, so no Stripe event can exist to
  react to. Every SaaS with a card-free local trial needs such a seed.
- **Alternatives were considered and rejected:**
  - *Implicit derivation* (no row; "trial = organization younger than
    30 days") removes the writer but scatters implicit-state logic into
    every consumer (jobs, admin, billing, gates) — more risk, no gain.
  - *Stripe-side trial without checkout* would require creating Stripe
    customers/subscriptions at onboarding — pollutes Stripe with
    never-converted prospects and couples onboarding to Stripe uptime.
- The row is created in the same transaction as the organization
  (atomic; no partial state).
- The webhook remains the only writer of **subsequent** state: once a
  Stripe subscription exists, every status/plan/period change flows
  through the webhook only.

Any future change that adds another synchronous writer of subscription
state is by definition a violation of this architecture.

## invoice.paid attribution

An `invoice.paid` event can arrive before `checkout.session.completed`
stamps `Organization.stripeCustomerId`. When the organization cannot be
resolved, the handler **throws** — the route returns 500 and Stripe
retries on its schedule; once the customer is stamped, the retry
succeeds. A paid invoice is never attributed to a placeholder like
`"unknown"` and never silently dropped; persistently failing deliveries
are visible in the Stripe Dashboard. `Invoice.organizationId` carries a
real foreign key (RESTRICT) so an unattributable invoice cannot be
stored by mistake.

## Migration discipline

`prisma/migrations` now contains a complete, replayable chain:

1. `20260901000000_init` — the base schema (everything except the
   Reputation Intelligence objects and the billing foreign key).
2. `20260909000000_reputation_intelligence` — additive intelligence
   tables (unchanged, predates the fix pack).
3. `20260910000000_billing_constraints` — `Invoice.organizationId`
   foreign key + index (the fix pack's database delta).

Databases provisioned earlier via `db push` (including production) must
be **baselined** before `migrate deploy`: mark the first two migrations
as applied with `prisma migrate resolve --applied`, then deploy — only
the billing constraints run. The exact commands are in
README-INSTALL.md. `prisma migrate reset` is never used; the legacy
columns `Subscription.plan` and `Invoice.amount` are deprecated in the
schema but deliberately retained (retiring them is a separate,
additive-only step once proven unused).
