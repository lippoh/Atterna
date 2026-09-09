// src/integrations/csv/importer.ts — the CSV ingestion pathway (§9, §10)
// This is the path that lets the ENTIRE product be developed, onboarded and
// tested before Google API access is approved: CSV → validate → normalize →
// dedup → PostgreSQL → analysis queue → intelligence. Tenant-fenced end to
// end; every import is audited; re-importing the same file is a no-op.
import { prisma } from "@/lib/db";
import { getScopedBusiness } from "@/lib/tenant";
import { parseCsv, splitHeader } from "./parser";
import {
  CSV_COLUMNS,
  normalizeRows,
  fallbackExternalId,
  type RowError,
} from "./normalizer";
import { enqueue } from "@/jobs/runner";
import { audit } from "@/lib/audit";

export interface ImportSummary {
  totalRows: number;
  imported: number; // genuinely new
  updated: number; // existing rows refreshed (rating/text edited at source)
  invalid: number;
  errors: RowError[]; // first 50, per-row reasons
  fileError: string | null; // FILE_TOO_LARGE | TOO_MANY_ROWS | …
}

const REPLY_LAG_HOURS = 48; // documented approximation for pre-replied rows

/**
 * Import reviews from CSV text into a business.
 * The business MUST belong to the organization (getScopedBusiness throws
 * ForbiddenError otherwise) — cross-tenant leakage is impossible by
 * construction. New rows with text are enqueued for AI analysis so the
 * intelligence pipeline picks them up exactly like synced reviews.
 */
export async function importCsv(opts: {
  organizationId: string;
  businessId: string;
  csvText: string;
  actorUserId?: string;
}): Promise<ImportSummary> {
  const business = await getScopedBusiness(opts.organizationId, opts.businessId);

  const parsed = parseCsv(opts.csvText);
  if (parsed.error) {
    return {
      totalRows: 0,
      imported: 0,
      updated: 0,
      invalid: 0,
      errors: [],
      fileError: parsed.error,
    };
  }
  const { header, data, error: headerError } = splitHeader(parsed.rows, [
    ...CSV_COLUMNS,
  ]);
  if (headerError) {
    return {
      totalRows: 0,
      imported: 0,
      updated: 0,
      invalid: 0,
      errors: [],
      fileError: headerError,
    };
  }

  const { rows, errors } = normalizeRows(header, data, { defaultSource: "csv" });

  let imported = 0;
  let updated = 0;
  const analyzeQueue: string[] = [];

  for (const row of rows) {
    const externalId = row.externalId ?? fallbackExternalId(row.source, row.receivedAt, row.rating, row.text);
    // Pre-existing reply text → mark answered (approximated lag, documented).
    const repliedAt = row.replyText
      ? new Date(Math.min(row.receivedAt.getTime() + REPLY_LAG_HOURS * 3_600_000, Date.now()))
      : null;

    const existing = await prisma.review.findUnique({
      where: {
        businessId_source_externalId: {
          businessId: business.id,
          source: row.source,
          externalId,
        },
      },
      select: { id: true },
    });

    if (!existing) {
      const created = await prisma.review.create({
        data: {
          organizationId: opts.organizationId,
          businessId: business.id,
          source: row.source,
          externalId,
          rating: row.rating,
          text: row.text,
          reviewerName: row.reviewerName,
          language: null, // authoritative after analysis
          sourceUrl: row.sourceUrl,
          createdOnPlatform: row.receivedAt,
          receivedAt: row.receivedAt,
          repliedAt,
        },
        select: { id: true },
      });
      imported++;
      if (row.text) analyzeQueue.push(created.id);
    } else {
      // Editable at source: rating/text/reply refresh, identity stays.
      await prisma.review.update({
        where: { id: existing.id },
        data: {
          rating: row.rating,
          text: row.text,
          sourceUrl: row.sourceUrl,
          ...(repliedAt ? { repliedAt } : {}),
        },
      });
      updated++;
    }
  }

  // Chain analysis for new reviews with text (same as the sync path).
  for (const reviewId of analyzeQueue) {
    await enqueue("analyze-review", { reviewId }, { dedupeKey: `analyze:${reviewId}` });
  }

  const summary: ImportSummary = {
    totalRows: data.length,
    imported,
    updated,
    invalid: errors.length,
    errors: errors.slice(0, 50),
    fileError: null,
  };

  await audit("csv.import", {
    userId: opts.actorUserId,
    organizationId: opts.organizationId,
    entity: "business",
    entityId: business.id,
  });

  // Import history (Settings → Data Sources shows the last runs).
  await prisma.reportLog.create({
    data: {
      organizationId: opts.organizationId,
      businessId: business.id,
      kind: "CSV_IMPORT",
      metrics: {
        totalRows: summary.totalRows,
        imported: summary.imported,
        updated: summary.updated,
        invalid: summary.invalid,
      } as object,
    },
  });

  return summary;
}
