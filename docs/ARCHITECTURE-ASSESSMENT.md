# Atterna — Multi-Source Reputation Intelligence Refactor
## Phase 1 Architecture Assessment (required by the spec's FINAL INSTRUCTION)

### 1. Current architecture (inspected at master 1012508)

- **Stack**: Next.js 16.3.4 (App Router, Turbopack), React 19, next-intl 4 (el/en with en→el
  fallback merge), Prisma 7.10 + `@prisma/adapter-pg`, next-auth v5 beta (credentials, JWT
  locale), Postgres job queue (SKIP LOCKED, dedupe keys, backoff, DEAD parking), Vercel + cron
  (`/api/cron` gated by `CRON_SECRET`), pnpm 10.18.3.
- **Tenancy**: `Organization → Membership (OWNER/MANAGER) → Business`; every `Review` carries
  `organizationId + businessId`; guards `requireOrg()`, `getScopedBusiness/Review/FeedbackRequest`
  (`src/lib/tenant.ts`); tenant-isolation integration test exists.
- **Review model is ALREADY provider-neutral**: `Review.source` is a string, uniqueness on
  `(businessId, source, externalId)` — Google writes `source="GOOGLE"` through one narrow
  integration (`src/integrations/gbp/*`: OAuth w/ signed org-bound state, encrypted tokens in
  `GbpConnection`, quota-aware paged sync, reply publishing).
- **AI layer is already vendor-swappable and cost-aware**: `completeObject()` (env-selected
  model, retry/backoff/timeout), per-review analysis idempotent + cached by prompt version,
  closed 16-category vocabulary (themes are ALREADY normalized — `CATEGORY_VOCAB`),
  token/cost logging + budget gate.
- **Metrics**: 30d velocity, 90d response rate, sentiment share, top complaint/compliment,
  week-over-week complaint trend, 30-day daily buckets, evidence-thresholded insights with
  localized playbooks (incl. an emerging-problem rule).
- **Feedback**: first-party QR channel exists (`FeedbackRequest`/`FeedbackSubmission` + alert
  job with quiet hours).
- **What is Google-coupled today**: the *dashboard gate* (`connectFirst` when no
  `gbpConnection`), onboarding step 2 (Google-only), reviews empty state (Google CTA), sync
  cron (GBP connections only). The data layer is not coupled.

### 2. Existing components reused (no rewrite)

Tenant fences · job queue + registry + cron route · AI provider/prompts/usage · analysis schema ·
metrics pure helpers · MetricCard/InsightCard/TrendChart · review→draft→approve→publish state
machine · GBP client/oauth/mapper/reviews (wrapped, not rewritten) · email infra · QR feedback ·
billing/auth · i18n merge machinery.

### 3. Schema changes (all additive — no destructive migration)

| Change | Purpose |
|---|---|
| `Review.sourceUrl String?` | deep link for imported reviews |
| `ReputationSnapshot` (unique `businessId+date`) | daily deterministic Health Score history → score, change, trend |
| `Issue` (unique `businessId+category+kind`) | first-class recurring/emerging problems with status workflow |
| `Recommendation` | recommended actions with status (Open/In progress/Resolved/Dismissed), evidence, steps |
| `Competitor` (unique `businessId+name`) | manual/suggested competitors the owner confirms — no scraping, no fabrication |
| `BusinessInsight` | cached AI business-level summaries keyed by a data fingerprint (cost control §16) |

Controlled source list is enforced **in code** (`src/lib/sources/registry.ts`, zod at ingestion
boundaries) — `Review.source` stays a string so existing rows and future providers need no
migration.

### 4. Backend changes

- `src/lib/sources/{registry,provider}.ts` — source registry (capabilities: sync/reply/import/
  oauth; availability: AVAILABLE/COMING_SOON; el/en labels) + `ReviewProvider` interface.
- `src/integrations/csv/{parser,normalizer,importer}.ts` — RFC-4180-style parser (no new deps),
  row validation, rating/date normalization, source normalization, idempotent dedup
  (externalId or content-hash fallback), per-row error report, tenant-fenced, audit-logged.
- `src/integrations/gbp/provider.ts` — Google as one `ReviewProvider` implementation.
- `src/lib/reputation/` — `score.ts` (deterministic 0-100 Health Score, documented weights,
  confidence annotation, deterministic localized explanation), `analytics.ts` (7d/30d/90d/180d/
  365d/all windows, source breakdown incl. Atterna feedback, monthly buckets, response time),
  `themes.ts` (deterministic theme stats over time + recurring/emerging detection → Issue
  upserts), `seasonal.ts` (Greek tourism seasons, YoY, off-season recommendations),
  `competitors.ts` (benchmark math, rank, gaps — nulls when no data), `refresh.ts`
  (orchestrator: themes→issues→recommendations→snapshot→AI cache invalidation).
- `src/ai/insights.ts` + prompt P6 — business-level quarterly summary + health explanation from
  AGGREGATED context only (never raw review dumps), zod-validated, cached in `BusinessInsight`
  by fingerprint; deterministic fallback when AI is unavailable (dev without keys).
- `src/jobs/refresh-reputation.ts` + registry/cron wiring + `vercel.json` (daily 03:30 UTC
  intel cron; sync stays 30-min; weekly report Mon 05:00; prune 02:00).
- Server actions in `settings/sources/actions.ts`: CSV import, competitor
  add/confirm/dismiss, issue & recommendation status workflow (all tenant-fenced + audited).

### 5. Frontend changes

- **Dashboard** refactored to the spec IA: Health → What changed → Customer Voice →
  Recurring/Emerging Issues → Recommendations → Competitor position → Source breakdown →
  Historical trend (12-month chart + seasonal YoY). Google gate REMOVED — works from any
  source. Honest low-review-month framing (current month vs 90-day vs 12-month clearly
  labeled, §14). Source filter via `?source=`.
- **Onboarding** step 2 → "Add your customer feedback": Connect Google OR Import CSV OR skip;
  coming-soon chips for Tripadvisor/Facebook/Booking.
- **Settings → Data Sources** page (`/settings/sources`): connected / available / coming soon
  with capabilities, CSV import form, import history.
- **Reviews** list gains a source badge + per-source filter chips when >1 source exists.
- New dashboard intel components under `src/components/dashboard/intel/`.

### 6. AI changes

Deterministic ↔ AI split made explicit: every number is computed by app code (windows, score,
theme counts, issue detection, benchmarks); the LLM only *explains and narrates* from those
numbers (P6 prompt, strict schema, aggregated context ≤ ~1.5k tokens), cached by fingerprint.
Per-review analysis stays as-is (analyze once, cached).

### 7. Integration changes

Google stays behind its existing module and is additionally exposed as a `ReviewProvider`.
Sync scheduling becomes provider-registry-driven (today: only Google can sync; CSV/manual are
import-based; QR is first-party) — adding Tripadvisor later = new provider file, zero core
changes. No scraping, no unofficial endpoints (spec §33).

### 8. Migration risks

- Additive-only migration (hand-written SQL under `prisma/migrations/…_reputation_intelligence/`),
  no column drops/renames; existing rows untouched (`source` strings remain valid).
- New unique constraints only touch new tables + nullable column, so `prisma migrate deploy`
  is safe on populated databases.
- Risk: dashboards/pages render slower on very old review sets — mitigated by bounded queries
  (take limits) and snapshot caching.
- Risk: seed/demo script run twice → idempotent by design (upserts on natural keys, fixed PRNG).

### 9. Recommended sequence (followed during implementation)

P2 source/provider abstraction + CSV ingestion → P3 windows/metrics → P4 health score →
P5 CSV import UI/actions → P6 demo data → P7 AI intelligence + caching → P8 dashboard →
P9 seasonal/YoY → P10 Google-as-provider wrap. Verification after each phase: `tsc --noEmit`,
`vitest run` (pure tests), `next build`.
