-- Billing fix pack (2026-09): Invoice attribution integrity.
-- additive only — no drops, no renames, no data changes.
--   * Invoice.organizationId → Organization (RESTRICT: invoices are
--     financial records; an organization with invoices is never
--     cascade-deleted)
--   * index for organization-scoped invoice lookups
-- Generated via prisma migrate diff (schema-to-schema, zero drift).
-- The deprecated legacy columns (Subscription.plan, Invoice.amount)
-- are deliberately retained — see docs/ARCHITECTURE-BILLING.md.
-- CreateIndex
CREATE INDEX "Invoice_organizationId_idx" ON "Invoice"("organizationId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

