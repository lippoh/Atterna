# Atterna — Multi-Source Reputation Intelligence Refactor

Baseline: your current `master` (1012508, "fix:duplicate review section bug").
This zip contains **45 new/changed files** — the complete, verified delta.

> Read `docs/ARCHITECTURE-ASSESSMENT.md` (included) for the Phase-1
> assessment: what was inspected, what is reused, and why each change is
> shaped the way it is. The spec's FINAL INSTRUCTION asked for it first —
> it is the map to everything below.

## What this delivers (spec → code)

| Spec section | Where |
|---|---|
| §4–§8 Provider abstraction, Google as one provider | `src/lib/sources/{registry,provider}.ts`, `src/integrations/gbp/provider.ts` |
| §9–§10 CSV ingestion (dev without Google approval) | `src/integrations/csv/{parser,normalizer,importer}.ts`, `settings/sources` page + form |
| §11 Realistic demo data (taverna/hotel/clinic) | `scripts/demo-seed.ts` |
| §12 Historical windows (7/30/90/180/365/all) | `src/lib/reputation/analytics.ts` |
| §13 Deterministic Reputation Health Score | `src/lib/reputation/score.ts` (documented formula; LLM never computes) |
| §14 Low-review months stay useful | Dashboard context lines + score confidence annotation |
| §15–§16 Deterministic/AI split + cost control | `src/ai/insights.ts` (fingerprint-cached), prompt P6/P7 |
| §17–§19 Themes, recurring + emerging issues | `src/lib/reputation/themes.ts` (detection thresholds documented + tested) |
| §20 Recommendations with status workflow | `Issue`/`Recommendation` models, `refresh.ts` playbook, dashboard actions |
| §21–§22 Competitor benchmarking (no fabrication) | `Competitor` model, `competitors.ts` + dashboard card |
| §23 Seasonal / YoY intelligence | `src/lib/reputation/seasonal.ts` |
| §24 Multi-source dashboard + source filters | Refactored `dashboard/page.tsx`, reviews source chips |
| §25 QR/direct feedback | Already existed — now counted in "total customer feedback" |
| §26 Intelligence report | `weekly-report.ts` + `emails/weekly.tsx` intel section |
| §34 Onboarding with CSV/skip | Updated `onboarding/page.tsx` |
| §35–§38 Empty states, Data Sources page | `settings/sources/page.tsx` |
| §39 Additive migration | `prisma/migrations/20260909000000_reputation_intelligence/` |
| §41 Tests | 4 new test files, 48 new cases |

## Install

1. **Copy everything over your repo** (paths mirror the repo root):

   ```
   docs/  messages/  prisma/  scripts/  src/  tests/  vercel.json
   ```

   No file deletions, no renames, no route moves — every change is additive
   or an in-place edit.

2. **Apply the migration** (additive only — safe on populated databases):

   ```bash
   pnpm exec prisma migrate deploy
   # or, if you manage schema by push on a dev branch:
   pnpm exec prisma db push
   ```

3. **Regenerate the Prisma client** (new models):

   ```bash
   pnpm install && pnpm exec prisma generate
   ```

4. **(Optional, recommended) Demo data** — the whole intelligence pipeline
   with ZERO API keys (analyses are seeded, since the generator knows the
   ground truth):

   ```bash
   DATABASE_URL=postgres://… pnpm tsx scripts/demo-seed.ts
   # login: demo@atterna.gr / demo-password-123  (override: DEMO_PASSWORD)
   ```

   Expect on the taverna: recurring `waiting_time` issue, an **emerging
   `booking` issue** (deliberate — 7 complaint injections this month),
   open recommendations, competitor benchmark, 60 days of honest score
   history, seasonal comparison.

5. **Deploy.** `vercel.json` now carries the cron schedule exactly as the
   code documents it: 30-min daytime sync, **daily 03:30 UTC intel refresh**
   (issues → recommendations → score snapshot → AI cache warming), Monday
   05:00 UTC weekly report, 02:00 UTC prune. If you configure crons in the
   Vercel dashboard instead, add `GET /api/cron?type=intel` daily.

## Running the test suite (all 8 files, 63 tests)

The five pure suites need nothing. The tenant-isolation suite is a REAL
integration test: `resetTestDb()` **truncates every table** in the
database it connects to, so it must never see your production database.

Vitest does not load `.env` on its own (the Prisma CLI does, via
`prisma7.config.ts` → `dotenv`). `tests/setup.ts` (wired through
`vitest.config.ts` → `setupFiles`) closes that gap: it loads `.env`, then
routes the app's Prisma singleton at the test database:

- `TEST_DATABASE_URL` — the database the tests may truncate. Set it to a
  disposable Postgres: local or a Neon branch. **Required for anything
  not on localhost.**
- Without it, `DATABASE_URL` is used only when it points at `localhost`/
  `127.0.0.1` — otherwise the suite refuses to run (protecting your
  remote/production database) and tells you exactly what to set.

One-time setup for a local test database (never run these against
production):

```bash
createdb atterna_test
# .env:
#   TEST_DATABASE_URL=postgresql://postgres@localhost:5432/atterna_test
# A FRESH test database can now be provisioned by the migration chain
# itself (init → intelligence → billing constraints — fully replayable):
TEST_DATABASE_URL=postgresql://postgres@localhost:5432/atterna_test \
  pnpm exec prisma migrate deploy
# (or `prisma db push` — same schema, no migration history)

pnpm test   # Test Files 8 passed (8) · Tests 63 passed (63)
```

CI (`.github/workflows/ci.yml` → `test` job) does the same automatically:
a `postgres:17` service container, `TEST_DATABASE_URL` pointing at it,
`prisma db push` provisioning the schema, then `vitest run`.

## How the intelligence engine works

```
CSV / Google sync / QR        ← sources; Google is one provider
        ↓
Review rows (source-neutral)  ← dedup on (business, source, externalId)
        ↓
ReviewAnalysis (per review)   ← AI, idempotent, cached by prompt version
        ↓
daily refresh-reputation job
  ├─ theme stats (deterministic counts over windows)
  ├─ issue detection (recurring ≥6 mentions/90d in ≥2 of 3 months;
  │                    emerging: ≥3 in 30d ≥ prior-90d total)
  ├─ recommendations (playbook per theme, status workflow)
  ├─ ReputationSnapshot (deterministic score, documented weights)
  └─ AI cache warming (fingerprint-keyed — page views never pay tokens)
        ↓
Dashboard: Health → What changed → Customer Voice → Issues →
           Recommendations → Competitors → Sources → Seasonal → Trend
```

The score formula (weights 30/20/20/15/10/5 + capped competitor ±5) and
every threshold are documented in the source files and covered by unit
tests — the LLM only narrates what app code already computed.

## Verified before packing

- `tsc --noEmit` → **0 errors**
- `vitest run` → **63/63 passed** across all 8 suites (tenant-isolation
  included — it runs against a disposable Postgres, locally via
  `TEST_DATABASE_URL`, in CI via the `postgres:17` service container; the
  Stripe fix pack added middleware-routing and billing-trial suites)
- `next build` → **full pass**, new route `/{locale}/settings/sources`
  included
- Migration SQL generated from `prisma migrate diff` (zero drift) and
  hand-verified statement-by-statement against the authoritative DDL
- i18n: `messages/en.json` ↔ `el.json` key parity — 381 = 381 keys
- `vercel.json` crons match the cron route contract

## Notes & honest limits

- **No new dependencies** (CSV parser is hand-rolled, charts reused).
- The AI layer is optional at runtime: without `OPENAI_API_KEY` the
  dashboard shows the deterministic explanation only — nothing crashes.
- Competitor stats are owner-entered; the UI says so and hides the
  benchmark when data is missing (spec §22 — never fabricate).
- `marquee.tsx` and the old `connectFirst` dashboard gate are untouched /
  removed respectively per spec; nothing else on the marketing site moved.
- Existing Google sync/reply flow is wrapped, not rewritten — the GBP
  module's internals are byte-identical to master.

---

# Stripe fix pack (2026-09) — setup & operations

Read `docs/ARCHITECTURE-BILLING.md` for the architecture contract
(Stripe is the source of truth; the webhook is the only writer of
subscription state). This section is the operational how-to.

## What the fix pack changed

- **`middleware.ts`**: `/api/*` is excluded from next-intl locale routing.
  Before, every API request was rewritten into the `[locale]` segment and
  404'd — Stripe webhooks, auth, cron and health included.
- **`src/lib/stripe.ts`**: Checkout Sessions now send
  `automatic_tax: { enabled: true }` — Stripe Tax computes Greek/EU VAT.
- **`src/lib/billing/handlers.ts`**: plan resolution reads the LIVE Stripe
  subscription (price → plan, metadata fallback, loud failure instead of
  silent STARTER); trial/period dates come from Stripe, never hardcoded;
  `invoice.paid` never writes `organizationId "unknown"` — an
  unattributable invoice defers to Stripe's retry schedule.
- **Billing page**: the 30-day Stripe trial is granted on the FIRST
  subscription only, enforced server-side (client input cannot influence
  eligibility).
- **Database**: `Invoice.organizationId` foreign key + index
  (`20260910000000_billing_constraints`), plus a complete, replayable
  migration chain (`20260901000000_init` baseline).
- **Tests**: middleware-routing + billing-trial suites; the production-style
  HTTP regression below.

## Stripe Dashboard setup (test mode FIRST)

Work entirely in **test mode** (the "Test mode" toggle in the Dashboard)
until the smoke test passes end-to-end. Never let live keys touch your
development environment.

1. **Register for Stripe Tax** — Settings → Stripe Tax → activate and add
   your Greek business details (default rate: 24% VAT). Registration can
   start in test mode.
2. **Create one Product** (e.g. "Atterna") and **three recurring Prices**,
   monthly interval, EUR, and — crucially — an **explicit
   `tax_behavior: inclusive`** on each (the UI shows VAT-included pricing):

   | Price | Amount | Tax behavior |
   |---|---|---|
   | STARTER | €19 / month | inclusive |
   | GROWTH | €39 / month | inclusive |
   | PRO | €79 / month | inclusive |

   Copy each `price_…` id.
3. **Webhook endpoint**: Developers → Webhooks → Add endpoint.
   - URL: `https://<your-deployment-domain>/api/webhooks/stripe`
     (locally: a tunnel URL, e.g. `https://…trycloudflare.com/api/…`)
   - Events (exactly these five):
     `checkout.session.completed`, `customer.subscription.updated`,
     `invoice.paid`, `invoice.payment_failed`,
     `customer.subscription.deleted`
   - Copy the signing secret `whsec_…`.
4. **Environment** (Vercel → Settings → Environment Variables, and `.env`
   locally; see `.env.example`): `APP_URL`, `STRIPE_SECRET_KEY`
   (`sk_test_…`), `STRIPE_WEBHOOK_SECRET` (`whsec_…`),
   `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_GROWTH` / `STRIPE_PRICE_PRO`
   (the three `price_…` ids). Redeploy after setting them.

## Test/live credential separation

- Test-mode values only ever pair with test-mode values: `sk_test_…` with
  `whsec_…` from a test-mode endpoint and test-mode `price_…` ids. Live
  equivalents exist only in the live-mode Dashboard view.
- Keep live values ONLY in the production Vercel environment — never in
  your local `.env`, never in CI.
- The smoke test below is designed for TEST mode.
  **Warning: do not use live keys during smoke testing** — a live
  webhook/checkout exercised by tests creates real customers and may
  charge real cards.

## Smoke test (idempotency / replay)

With the server running (locally or on a preview deployment) and its env
set, run the built-in regression — it posts validly signed, ignored-type
events and proves route reachability, signature enforcement, idempotent
processing and duplicate-event safety:

```bash
STRIPE_WEBHOOK_SECRET=<the same whsec_ the server uses> \
  node scripts/verify-webhook-routing.mjs --url http://localhost:3000
```

Expected: every check `[PASS]`, including `duplicate event.id is ignored`.
For a full replay test, use the Dashboard's "Send test webhook" on
`checkout.session.completed` twice — the second delivery must log
`{"received":true,"duplicate":true}` (server logs) and never double-apply.
Then complete one test-mode Checkout (Stripe test card 4242 4242 4242
4242) and watch the five events land.

## Database migration (existing deployments — READ THIS)

`prisma/migrations` now contains a complete chain:

```
20260901000000_init                      ← base schema (baseline)
20260909000000_reputation_intelligence   ← (pre-existing)
20260910000000_billing_constraints       ← Invoice FK + index
```

Databases provisioned earlier via `db push` (including **production**)
already contain the first two states. Baseline them ONCE, then deploy —
only the billing constraints actually run (additive: one index + one
foreign key; no data is touched, nothing is reset):

```bash
# 1. Inspect state first (read-only):
pnpm exec prisma migrate status
# 2. Baseline the states that already exist (skip any row already applied):
pnpm exec prisma migrate resolve --applied 20260901000000_init
pnpm exec prisma migrate resolve --applied 20260909000000_reputation_intelligence
# 3. Apply the billing constraints:
pnpm exec prisma migrate deploy
```

NEVER run `prisma migrate reset` against production — it drops the
database. Fresh environments (CI, new branches) can simply
`prisma migrate deploy` from empty. The legacy columns `Subscription.plan`
and `Invoice.amount` are deprecated in the schema but deliberately
retained; retiring them is a separate, additive-only step.
