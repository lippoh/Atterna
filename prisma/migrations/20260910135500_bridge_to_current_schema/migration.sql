-- ============================================================================
-- bridge_to_current_schema — Complete reconciliation to current schema
-- ============================================================================
-- Bridges the gap between the reconcile_production_v1_to_current migration
-- and the actual current schema.prisma state (post-refactor commits a439177
-- and 8e18c86).
--
-- Changes:
-- 1. Refactor reputation intelligence tables to match consolidated design
-- 2. Add missing relations (Invoice.organization, Recommendation.issue)
-- 3. Add missing columns (ImpersonationSession.token, ResponseDraft.text, etc.)
-- 4. Update indexes to match current schema
-- 5. Adjust defaults and nullability
-- ============================================================================

-- DropForeignKey (will be recreated with correct semantics)
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_actorUserId_fkey";
ALTER TABLE "ReportLog" DROP CONSTRAINT "ReportLog_businessId_fkey";

-- DropIndex (indexes from old inferred schema that don't match current)
DROP INDEX "AiUsageLog_organizationId_createdAt_idx";
DROP INDEX "AuditLog_action_createdAt_idx";
DROP INDEX "AuditLog_organizationId_createdAt_idx";
DROP INDEX "BusinessInsight_businessId_createdAt_idx";
DROP INDEX "Competitor_businessId_idx";
DROP INDEX "FeedbackSubmission_businessId_createdAt_idx";
DROP INDEX "ImpersonationSession_targetUserId_idx";
DROP INDEX "Invoice_organizationId_createdAt_idx";
DROP INDEX "Issue_organizationId_createdAt_idx";
DROP INDEX "Job_state_runAt_idx";
DROP INDEX "Recommendation_organizationId_createdAt_idx";
DROP INDEX "ReportLog_businessId_createdAt_idx";
DROP INDEX "ReputationSnapshot_businessId_periodStart_idx";
DROP INDEX "ReputationSnapshot_organizationId_createdAt_idx";
DROP INDEX "ResponseDraft_reviewId_status_idx";

-- Refactor BusinessInsight to fingerprint-based cached AI summaries
ALTER TABLE "BusinessInsight" DROP COLUMN "data",
DROP COLUMN "organizationId",
DROP COLUMN "summary",
ADD COLUMN     "fingerprint" TEXT NOT NULL,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "payload" JSONB NOT NULL,
ADD COLUMN     "promptVersion" TEXT,
ADD COLUMN     "tokensIn" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tokensOut" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "windowEnd" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "windowStart" TIMESTAMP(3) NOT NULL;

-- Refactor Competitor to manual confirmation model
ALTER TABLE "Competitor" DROP COLUMN "lastRefreshAt",
DROP COLUMN "observations",
DROP COLUMN "placeId",
ADD COLUMN     "city" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "organizationId" TEXT NOT NULL,
ADD COLUMN     "rating" DOUBLE PRECISION,
ADD COLUMN     "reviewCount" INTEGER,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
ADD COLUMN     "suggestedReason" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- FeedbackRequest: default empty string for customerEmail
ALTER TABLE "FeedbackRequest" ALTER COLUMN "customerEmail" SET DEFAULT '';

-- FeedbackSubmission: add requestId for future request tracking
ALTER TABLE "FeedbackSubmission" ADD COLUMN "requestId" TEXT;

-- ImpersonationSession: add token, make reason optional
ALTER TABLE "ImpersonationSession" ADD COLUMN "token" TEXT NOT NULL,
ALTER COLUMN "reason" DROP NOT NULL,
ALTER COLUMN "reason" DROP DEFAULT;

-- Invoice: remove vatId, add amount and status (billing refactor)
ALTER TABLE "Invoice" DROP COLUMN "vatId",
ADD COLUMN     "amount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PAID',
ALTER COLUMN "totalCents" DROP NOT NULL,
ALTER COLUMN "currency" DROP NOT NULL,
ALTER COLUMN "currency" DROP DEFAULT,
ALTER COLUMN "vatCents" DROP NOT NULL,
ALTER COLUMN "hostedUrl" DROP NOT NULL;

-- Issue: refactor to category-based detection (no title, split mentions)
ALTER TABLE "Issue" DROP COLUMN "mentions",
DROP COLUMN "title",
ADD COLUMN     "category" TEXT NOT NULL,
ADD COLUMN     "mentionsCurrent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mentionsPrevious" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "kind" DROP DEFAULT,
ALTER COLUMN "firstDetectedAt" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "lastSeenAt" SET NOT NULL,
ALTER COLUMN "lastSeenAt" SET DEFAULT CURRENT_TIMESTAMP;

-- Job: add createdAt
ALTER TABLE "Job" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Recommendation: refactor to steps array, add issue link, make evidence optional
ALTER TABLE "Recommendation" DROP COLUMN "suggestedActions",
ADD COLUMN     "issueId" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'RULES',
ADD COLUMN     "steps" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "evidence" DROP NOT NULL;

-- ReportLog: add periodStart, make businessId optional, remove defaults
ALTER TABLE "ReportLog" ADD COLUMN "periodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "businessId" DROP NOT NULL,
ALTER COLUMN "kind" DROP DEFAULT,
ALTER COLUMN "metrics" DROP NOT NULL;

-- ReputationSnapshot: refactor to daily snapshots with date key
ALTER TABLE "ReputationSnapshot" DROP COLUMN "metrics",
DROP COLUMN "organizationId",
DROP COLUMN "periodEnd",
DROP COLUMN "periodStart",
ADD COLUMN     "breakdown" JSONB NOT NULL,
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL;

-- ResponseDraft: add text field, relax NOT NULL constraints
ALTER TABLE "ResponseDraft" ADD COLUMN "text" TEXT,
ALTER COLUMN "content" SET DEFAULT '',
ALTER COLUMN "language" DROP NOT NULL,
ALTER COLUMN "model" DROP NOT NULL,
ALTER COLUMN "promptVersion" DROP NOT NULL;

-- Review: add sourceUrl
ALTER TABLE "Review" ADD COLUMN "sourceUrl" TEXT;

-- Subscription: add planKey (new billing model)
ALTER TABLE "Subscription" ADD COLUMN "planKey" TEXT NOT NULL DEFAULT 'STARTER',
ALTER COLUMN "plan" SET DEFAULT 'STARTER';

-- WebhookEvent: add payload
ALTER TABLE "WebhookEvent" ADD COLUMN "payload" JSONB;

-- Create new indexes matching current schema
CREATE INDEX "BusinessInsight_businessId_kind_createdAt_idx" ON "BusinessInsight"("businessId", "kind", "createdAt");
CREATE INDEX "Competitor_businessId_status_idx" ON "Competitor"("businessId", "status");
CREATE UNIQUE INDEX "Competitor_businessId_name_key" ON "Competitor"("businessId", "name");
CREATE UNIQUE INDEX "ImpersonationSession_token_key" ON "ImpersonationSession"("token");
CREATE INDEX "Invoice_organizationId_idx" ON "Invoice"("organizationId");
CREATE UNIQUE INDEX "Issue_businessId_category_kind_key" ON "Issue"("businessId", "category", "kind");
CREATE INDEX "ReputationSnapshot_businessId_date_idx" ON "ReputationSnapshot"("businessId", "date");
CREATE UNIQUE INDEX "ReputationSnapshot_businessId_date_key" ON "ReputationSnapshot"("businessId", "date");

-- Add missing foreign keys
ALTER TABLE "FeedbackSubmission" ADD CONSTRAINT "FeedbackSubmission_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReportLog" ADD CONSTRAINT "ReportLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReportLog" ADD CONSTRAINT "ReportLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
