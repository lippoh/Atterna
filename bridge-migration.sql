-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_actorUserId_fkey";

-- DropForeignKey
ALTER TABLE "ReportLog" DROP CONSTRAINT "ReportLog_businessId_fkey";

-- DropIndex
DROP INDEX "AiUsageLog_organizationId_createdAt_idx";

-- DropIndex
DROP INDEX "AuditLog_action_createdAt_idx";

-- DropIndex
DROP INDEX "AuditLog_organizationId_createdAt_idx";

-- DropIndex
DROP INDEX "BusinessInsight_businessId_createdAt_idx";

-- DropIndex
DROP INDEX "Competitor_businessId_idx";

-- DropIndex
DROP INDEX "FeedbackSubmission_businessId_createdAt_idx";

-- DropIndex
DROP INDEX "ImpersonationSession_targetUserId_idx";

-- DropIndex
DROP INDEX "Invoice_organizationId_createdAt_idx";

-- DropIndex
DROP INDEX "Issue_organizationId_createdAt_idx";

-- DropIndex
DROP INDEX "Job_state_runAt_idx";

-- DropIndex
DROP INDEX "Recommendation_organizationId_createdAt_idx";

-- DropIndex
DROP INDEX "ReportLog_businessId_createdAt_idx";

-- DropIndex
DROP INDEX "ReputationSnapshot_businessId_periodStart_idx";

-- DropIndex
DROP INDEX "ReputationSnapshot_organizationId_createdAt_idx";

-- DropIndex
DROP INDEX "ResponseDraft_reviewId_status_idx";

-- AlterTable
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

-- AlterTable
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

-- AlterTable
ALTER TABLE "FeedbackRequest" ALTER COLUMN "customerEmail" SET DEFAULT '';

-- AlterTable
ALTER TABLE "FeedbackSubmission" ADD COLUMN     "requestId" TEXT;

-- AlterTable
ALTER TABLE "ImpersonationSession" ADD COLUMN     "token" TEXT NOT NULL,
ALTER COLUMN "reason" DROP NOT NULL,
ALTER COLUMN "reason" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "vatId",
ADD COLUMN     "amount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PAID',
ALTER COLUMN "totalCents" DROP NOT NULL,
ALTER COLUMN "currency" DROP NOT NULL,
ALTER COLUMN "currency" DROP DEFAULT,
ALTER COLUMN "vatCents" DROP NOT NULL,
ALTER COLUMN "hostedUrl" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Issue" DROP COLUMN "mentions",
DROP COLUMN "title",
ADD COLUMN     "category" TEXT NOT NULL,
ADD COLUMN     "mentionsCurrent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mentionsPrevious" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "kind" DROP DEFAULT,
ALTER COLUMN "firstDetectedAt" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "lastSeenAt" SET NOT NULL,
ALTER COLUMN "lastSeenAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Recommendation" DROP COLUMN "suggestedActions",
ADD COLUMN     "issueId" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'RULES',
ADD COLUMN     "steps" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "evidence" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ReportLog" ADD COLUMN     "periodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "businessId" DROP NOT NULL,
ALTER COLUMN "kind" DROP DEFAULT,
ALTER COLUMN "metrics" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ReputationSnapshot" DROP COLUMN "metrics",
DROP COLUMN "organizationId",
DROP COLUMN "periodEnd",
DROP COLUMN "periodStart",
ADD COLUMN     "breakdown" JSONB NOT NULL,
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "ResponseDraft" ADD COLUMN     "text" TEXT,
ALTER COLUMN "content" SET DEFAULT '',
ALTER COLUMN "language" DROP NOT NULL,
ALTER COLUMN "model" DROP NOT NULL,
ALTER COLUMN "promptVersion" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "sourceUrl" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "planKey" TEXT NOT NULL DEFAULT 'STARTER',
ALTER COLUMN "plan" SET DEFAULT 'STARTER';

-- AlterTable
ALTER TABLE "WebhookEvent" ADD COLUMN     "payload" JSONB;

-- CreateIndex
CREATE INDEX "BusinessInsight_businessId_kind_createdAt_idx" ON "BusinessInsight"("businessId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "Competitor_businessId_status_idx" ON "Competitor"("businessId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Competitor_businessId_name_key" ON "Competitor"("businessId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ImpersonationSession_token_key" ON "ImpersonationSession"("token");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_idx" ON "Invoice"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Issue_businessId_category_kind_key" ON "Issue"("businessId", "category", "kind");

-- CreateIndex
CREATE INDEX "ReputationSnapshot_businessId_date_idx" ON "ReputationSnapshot"("businessId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ReputationSnapshot_businessId_date_key" ON "ReputationSnapshot"("businessId", "date");

-- AddForeignKey
ALTER TABLE "FeedbackSubmission" ADD CONSTRAINT "FeedbackSubmission_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportLog" ADD CONSTRAINT "ReportLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportLog" ADD CONSTRAINT "ReportLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

