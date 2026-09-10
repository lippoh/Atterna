-- ============================================================================
-- reconcile_production_v1_to_current — PROPOSED MIGRATION (FOR REVIEW ONLY)
-- ============================================================================
-- Target database : Atterna production Neon (V1-era db push state)
-- Target schema   : current prisma/schema.prisma (V2 consolidated +
--                   reputation-intelligence)
--
-- STATUS: DO NOT RUN. This file is a human-review artifact. It has been
-- rehearsed against a local scratch PostgreSQL 16 replica of the evidenced
-- production shape, NOT against production.
--
-- DESIGN RULES
--   1. Additive wherever possible: ADD COLUMN / CREATE TABLE / CREATE INDEX.
--   2. Idempotency-conscious: every statement tolerates partial application
--      (IF NOT EXISTS guards, guarded CREATE TYPE, guarded ADD CONSTRAINT).
--   3. NO DROP TABLE, NO DROP COLUMN, NO db push, NO reset logic.
--   4. The three TEXT -> ENUM conversions use explicit
--      ALTER COLUMN ... TYPE ... USING casts that PRESERVE existing data,
--      replacing Prisma's destructive DROP COLUMN + re-ADD proposals.
--   5. Every NOT NULL column without a SQL default is added nullable first,
--      backfilled deterministically, then tightened with SET NOT NULL.
--
-- MANDATORY PRE-FLIGHT (read-only, see preflight-verification.sql):
--   P1. `prisma migrate status` still reports 0 applied migrations.
--   P2. `prisma migrate diff --from-config-datasource --to-schema-datamodel
--        prisma/schema.prisma --script` matches the drift this migration
--        claims to fix (enums Locale/Sentiment; 12 tables; columns listed
--       below; indexes; FKs). Any EXTRA drift must be appended here first.
--   P3. Preflight SQL returns ZERO rows for:
--         - invalid User.locale values (anything outside EL / EN)
--         - invalid Business.locale values (anything outside EL / EN)
--         - invalid ReviewAnalysis.sentiment values
--           (anything outside POSITIVE / NEUTRAL / NEGATIVE)
--         - NULLs in User.locale / Business.locale / ReviewAnalysis.sentiment
--       If any of these return rows: STOP. Report the values. Do not run.
--   P4. Row counts recorded for User, Business, Review, ReviewAnalysis,
--       ResponseDraft, FeedbackRequest, Subscription, AuditLog (drives the
--       Section 2 backfill review).
--
-- [INFERRED] markers flag the 4 reputation tables whose field-level shape was
-- reconstructed from the refactor specification, not byte-verified against
-- the master tree. Verify them against master prisma/schema.prisma before
-- approving (P2 covers this automatically).
-- ============================================================================

-- ============================================================================
-- SECTION 0 — Missing enum types (guarded, idempotent)
-- ============================================================================
-- Production lacks "Locale" and "Sentiment" (evidenced by migrate diff).
-- Postgres has no CREATE TYPE IF NOT EXISTS, hence the duplicate_object trap.

DO $$ BEGIN
  CREATE TYPE "Locale" AS ENUM ('EL', 'EN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "Sentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- SECTION 1 — Additive columns on EXISTING tables (all data-preserving)
-- ============================================================================
-- NOT NULL + DEFAULT columns backfill existing rows automatically
-- (PostgreSQL 11+ fast default: no table rewrite).

-- User: +isAdmin (restores registration/login — the P2022 columns),
--       +passwordChangedAt (single-use reset tokens).
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3);

-- Business: +reviewUrl (Google write-review deep link from GBP placeId).
ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "reviewUrl" TEXT;

-- Review: +createdAt (fresh-row detection in sync), +repliedAt (published
-- replies), +deletedAt (soft delete), +language (BCP-47 from analysis).
ALTER TABLE "Review"
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "language" TEXT,
  ADD COLUMN IF NOT EXISTS "repliedAt" TIMESTAMP(3);

-- AuditLog: +actorUserId (+relation below), +entity, +entityId, +ip.
ALTER TABLE "AuditLog"
  ADD COLUMN IF NOT EXISTS "actorUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "entity" TEXT,
  ADD COLUMN IF NOT EXISTS "entityId" TEXT,
  ADD COLUMN IF NOT EXISTS "ip" TEXT;

-- FeedbackRequest: +active, +label, +token.
-- "token" is NOT NULL + @unique in the target schema but has no SQL default,
-- so it is added NULLABLE here, backfilled in Section 2, then tightened.
ALTER TABLE "FeedbackRequest"
  ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "label" TEXT,
  ADD COLUMN IF NOT EXISTS "token" TEXT;

-- ResponseDraft: the 10 evidenced-missing columns. "language", "model" and
-- "promptVersion" are NOT NULL without default in the target schema ->
-- added nullable, backfilled in Section 2, then tightened.
ALTER TABLE "ResponseDraft"
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "editedText" TEXT,
  ADD COLUMN IF NOT EXISTS "externalReplyId" TEXT,
  ADD COLUMN IF NOT EXISTS "failureReason" TEXT,
  ADD COLUMN IF NOT EXISTS "language" TEXT,
  ADD COLUMN IF NOT EXISTS "model" TEXT,
  ADD COLUMN IF NOT EXISTS "promptVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);

-- Subscription: the 4 evidenced-missing billing columns.
ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "accessEndsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "canceledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;

-- ============================================================================
-- SECTION 2 — Deterministic backfills for NOT NULL columns (REVIEW CAREFULLY)
-- ============================================================================
-- These UPDATEs only touch rows where the new column is still NULL, so they
-- are idempotent. Values are the minimum deterministic placeholders that keep
-- historical rows valid; they are NOT invented business data:
--   token          -> gen_random_uuid() (opaque unique secret, no semantics)
--   language       -> 'el'  (the product's default locale, schema default EL)
--   model/promptVersion -> 'unknown' (honest marker for pre-migration rows)
-- If preflight P4 shows non-zero ResponseDraft / FeedbackRequest counts and
-- you prefer different values, EDIT THESE STATEMENTS BEFORE APPROVING.

UPDATE "FeedbackRequest" SET "token" = gen_random_uuid()::text
  WHERE "token" IS NULL;

UPDATE "ResponseDraft" SET "language" = 'el'
  WHERE "language" IS NULL;
UPDATE "ResponseDraft" SET "model" = 'unknown'
  WHERE "model" IS NULL;
UPDATE "ResponseDraft" SET "promptVersion" = 'unknown'
  WHERE "promptVersion" IS NULL;

-- Tighten the backfilled columns to match the target schema.
ALTER TABLE "FeedbackRequest" ALTER COLUMN "token" SET NOT NULL;
ALTER TABLE "ResponseDraft" ALTER COLUMN "language" SET NOT NULL;
ALTER TABLE "ResponseDraft" ALTER COLUMN "model" SET NOT NULL;
ALTER TABLE "ResponseDraft" ALTER COLUMN "promptVersion" SET NOT NULL;

-- ============================================================================
-- SECTION 3 — TEXT -> ENUM conversions (data-preserving; replaces Prisma's
-- destructive DROP COLUMN + re-ADD proposals)
-- ============================================================================
-- DANGEROUS-TRANSFORMATION NOTES:
--   * The USING cast requires every existing value to be a valid enum label,
--     EXACTLY as cased ('EL'/'EN', 'POSITIVE'/'NEUTRAL'/'NEGATIVE'). An
--     invalid or NULL value aborts the whole migration transaction — a
--     deliberate fail-safe (verified by preflight P3 before you ever run).
--   * If preflight shows lowercase values ('el'/'en'), replace the USING
--     clause with USING (UPPER("locale")::"Locale") — with your approval.
--   * If preflight shows NULLs, backfill first (e.g. SET "locale"='EL'
--     WHERE NULL) — with your approval. Do NOT silently convert NULLs.

-- User.locale : TEXT -> "Locale" (keeps NOT NULL and DEFAULT 'EL')
ALTER TABLE "User" ALTER COLUMN "locale" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "locale" TYPE "Locale" USING ("locale"::"Locale");
ALTER TABLE "User" ALTER COLUMN "locale" SET DEFAULT 'EL';

-- Business.locale : TEXT -> "Locale" (keeps NOT NULL and DEFAULT 'EL')
ALTER TABLE "Business" ALTER COLUMN "locale" DROP DEFAULT;
ALTER TABLE "Business" ALTER COLUMN "locale" TYPE "Locale" USING ("locale"::"Locale");
ALTER TABLE "Business" ALTER COLUMN "locale" SET DEFAULT 'EL';

-- ReviewAnalysis.sentiment : TEXT -> "Sentiment" (keeps NOT NULL, no default)
ALTER TABLE "ReviewAnalysis" ALTER COLUMN "sentiment" TYPE "Sentiment" USING ("sentiment"::"Sentiment");

-- ============================================================================
-- SECTION 4 — Missing tables (12). CREATE TABLE is safe here: production has
-- NONE of these tables (evidenced), so nothing is replaced. IF NOT EXISTS
-- keeps the migration re-runnable / partially-applied tolerant.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "Invoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stripeInvoiceId" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "vatCents" INTEGER NOT NULL,
    "vatId" TEXT,
    "hostedUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FeedbackSubmission" (
    "id" TEXT NOT NULL,
    "feedbackRequestId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedbackSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AiUsageLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL,
    "tokensOut" INTEGER NOT NULL,
    "costMicros" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Job" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "dedupeKey" TEXT,
    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WebhookEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Competitor" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "placeId" TEXT,
    "category" TEXT,
    "observations" JSONB NOT NULL,
    "lastRefreshAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ImpersonationSession" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'support',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImpersonationSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReportLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'WEEKLY',
    "metrics" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReportLog_pkey" PRIMARY KEY ("id")
);

-- [INFERRED] — verify exact shape against master prisma/schema.prisma (P2).
CREATE TABLE IF NOT EXISTS "ReputationSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "score" INTEGER NOT NULL,
    "metrics" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReputationSnapshot_pkey" PRIMARY KEY ("id")
);

-- [INFERRED] — verify exact shape against master prisma/schema.prisma (P2).
CREATE TABLE IF NOT EXISTS "Issue" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'RECURRING',
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "trend" TEXT NOT NULL DEFAULT 'STABLE',
    "mentions" INTEGER NOT NULL DEFAULT 0,
    "sources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "firstDetectedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- [INFERRED] — verify exact shape against master prisma/schema.prisma (P2).
CREATE TABLE IF NOT EXISTS "Recommendation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "impact" TEXT NOT NULL DEFAULT 'MEDIUM',
    "suggestedActions" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- [INFERRED] — verify exact shape against master prisma/schema.prisma (P2).
CREATE TABLE IF NOT EXISTS "BusinessInsight" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessInsight_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- SECTION 5 — Missing indexes / unique indexes (all IF NOT EXISTS).
-- ============================================================================
-- NOTE: plain CREATE INDEX (not CONCURRENTLY) is intentional: migrations run
-- inside a transaction and the affected tables are expected small (preflight
-- P4 records counts). If counts turn out large (> ~100k), split these into a
-- separate CONCURRENTLY migration instead.

CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_stripeInvoiceId_key" ON "Invoice"("stripeInvoiceId");
CREATE INDEX IF NOT EXISTS "Invoice_organizationId_createdAt_idx" ON "Invoice"("organizationId", "createdAt");

CREATE INDEX IF NOT EXISTS "FeedbackSubmission_businessId_createdAt_idx" ON "FeedbackSubmission"("businessId", "createdAt");

CREATE INDEX IF NOT EXISTS "AiUsageLog_organizationId_createdAt_idx" ON "AiUsageLog"("organizationId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "Job_dedupeKey_key" ON "Job"("dedupeKey");
CREATE INDEX IF NOT EXISTS "Job_state_runAt_idx" ON "Job"("state", "runAt");

CREATE INDEX IF NOT EXISTS "Competitor_businessId_idx" ON "Competitor"("businessId");

CREATE INDEX IF NOT EXISTS "ImpersonationSession_targetUserId_idx" ON "ImpersonationSession"("targetUserId");

CREATE INDEX IF NOT EXISTS "ReportLog_businessId_createdAt_idx" ON "ReportLog"("businessId", "createdAt");

CREATE INDEX IF NOT EXISTS "ReputationSnapshot_businessId_periodStart_idx" ON "ReputationSnapshot"("businessId", "periodStart");
CREATE INDEX IF NOT EXISTS "ReputationSnapshot_organizationId_createdAt_idx" ON "ReputationSnapshot"("organizationId", "createdAt");

CREATE INDEX IF NOT EXISTS "Issue_businessId_status_idx" ON "Issue"("businessId", "status");
CREATE INDEX IF NOT EXISTS "Issue_organizationId_createdAt_idx" ON "Issue"("organizationId", "createdAt");

CREATE INDEX IF NOT EXISTS "Recommendation_businessId_status_idx" ON "Recommendation"("businessId", "status");
CREATE INDEX IF NOT EXISTS "Recommendation_organizationId_createdAt_idx" ON "Recommendation"("organizationId", "createdAt");

CREATE INDEX IF NOT EXISTS "BusinessInsight_businessId_createdAt_idx" ON "BusinessInsight"("businessId", "createdAt");

-- Existing tables: indexes evidentially missing in production.
CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- FeedbackRequest_token_key MUST come after the Section 2 token backfill.
CREATE UNIQUE INDEX IF NOT EXISTS "FeedbackRequest_token_key" ON "FeedbackRequest"("token");

CREATE INDEX IF NOT EXISTS "ResponseDraft_reviewId_status_idx" ON "ResponseDraft"("reviewId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- ============================================================================
-- SECTION 6 — Missing foreign keys (guarded; Postgres has no
-- ADD CONSTRAINT IF NOT EXISTS, hence the pg_constraint checks).
-- ============================================================================
-- FKs on EXISTING tables (AuditLog) validate existing data at ADD time —
-- deliberate: any orphan would abort the transaction (fail-safe).
-- FKs on the NEW tables are guarded purely for re-runnability.

-- AuditLog.actorUserId -> User.id  (missing relation, evidenced)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_actorUserId_fkey'
                 AND conrelid = '"AuditLog"'::regclass) THEN
    ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey"
      FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AuditLog.organizationId -> Organization.id  (missing relation, evidenced)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_organizationId_fkey'
                 AND conrelid = '"AuditLog"'::regclass) THEN
    ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- FeedbackSubmission.feedbackRequestId -> FeedbackRequest.id (new table)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FeedbackSubmission_feedbackRequestId_fkey'
                 AND conrelid = '"FeedbackSubmission"'::regclass) THEN
    ALTER TABLE "FeedbackSubmission" ADD CONSTRAINT "FeedbackSubmission_feedbackRequestId_fkey"
      FOREIGN KEY ("feedbackRequestId") REFERENCES "FeedbackRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ReportLog.businessId -> Business.id (new table)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReportLog_businessId_fkey'
                 AND conrelid = '"ReportLog"'::regclass) THEN
    ALTER TABLE "ReportLog" ADD CONSTRAINT "ReportLog_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ReputationSnapshot.businessId -> Business.id ([INFERRED] table)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReputationSnapshot_businessId_fkey'
                 AND conrelid = '"ReputationSnapshot"'::regclass) THEN
    ALTER TABLE "ReputationSnapshot" ADD CONSTRAINT "ReputationSnapshot_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Issue.businessId -> Business.id ([INFERRED] table)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Issue_businessId_fkey'
                 AND conrelid = '"Issue"'::regclass) THEN
    ALTER TABLE "Issue" ADD CONSTRAINT "Issue_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Recommendation.businessId -> Business.id ([INFERRED] table)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Recommendation_businessId_fkey'
                 AND conrelid = '"Recommendation"'::regclass) THEN
    ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- BusinessInsight.businessId -> Business.id ([INFERRED] table)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BusinessInsight_businessId_fkey'
                 AND conrelid = '"BusinessInsight"'::regclass) THEN
    ALTER TABLE "BusinessInsight" ADD CONSTRAINT "BusinessInsight_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
