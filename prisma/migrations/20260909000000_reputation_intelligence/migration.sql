-- Reputation Intelligence refactor (ADDITIVE ONLY — safe on populated
-- databases; no drops/renames. Generated via `prisma migrate diff` from
-- the schema, then trimmed to the new objects only — zero drift.

-- Review.sourceUrl: deep link for imported reviews
ALTER TABLE "Review" ADD COLUMN "sourceUrl" TEXT;

-- CreateTable
CREATE TABLE "ReputationSnapshot" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "score" INTEGER NOT NULL,
    "breakdown" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReputationSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "mentionsCurrent" INTEGER NOT NULL DEFAULT 0,
    "mentionsPrevious" INTEGER NOT NULL DEFAULT 0,
    "trend" TEXT NOT NULL DEFAULT 'STABLE',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "sources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "issueId" TEXT,
    "title" TEXT NOT NULL,
    "impact" TEXT NOT NULL DEFAULT 'MEDIUM',
    "steps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "source" TEXT NOT NULL DEFAULT 'RULES',
    "evidence" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competitor" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "city" TEXT,
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "suggestedReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessInsight" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "model" TEXT,
    "promptVersion" TEXT,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessInsight_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BusinessInsight_businessId_kind_createdAt_idx" ON "BusinessInsight"("businessId", "kind", "createdAt");

CREATE INDEX "Competitor_businessId_status_idx" ON "Competitor"("businessId", "status");

CREATE INDEX "Issue_businessId_status_idx" ON "Issue"("businessId", "status");

CREATE INDEX "Recommendation_businessId_status_idx" ON "Recommendation"("businessId", "status");

CREATE INDEX "ReputationSnapshot_businessId_date_idx" ON "ReputationSnapshot"("businessId", "date");

CREATE UNIQUE INDEX "Competitor_businessId_name_key" ON "Competitor"("businessId", "name");

CREATE UNIQUE INDEX "Issue_businessId_category_kind_key" ON "Issue"("businessId", "category", "kind");

CREATE UNIQUE INDEX "ReputationSnapshot_businessId_date_key" ON "ReputationSnapshot"("businessId", "date");

-- AddForeignKey
ALTER TABLE "ReputationSnapshot" ADD CONSTRAINT "ReputationSnapshot_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "BusinessInsight" ADD CONSTRAINT "BusinessInsight_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
