// src/app/[locale]/(app)/settings/sources/actions.ts — data source
// management (spec §34, §38): CSV import, competitor curation. Every
// action is tenant-fenced through requireOrg + scoped queries and writes
// an audit row. The CSV import immediately refreshes the intelligence
// layer so the dashboard reflects the import on the next page view.
"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/session";
import { audit } from "@/lib/audit";
import { importCsv } from "@/integrations/csv/importer";
import { refreshBusinessIntelligence } from "@/lib/reputation/refresh";

export interface ImportState {
  ok?: boolean;
  error?: string; // machine key: noFile | fileTooLarge | badHeader | server
  total?: number;
  imported?: number;
  updated?: number;
  invalid?: number;
  rowErrors?: { line: number; reason: string }[];
}

const CSV_MAX_BYTES = 2 * 1024 * 1024;

export async function importCsvAction(
  _prev: ImportState,
  formData: FormData
): Promise<ImportState> {
  try {
    const { orgId, user } = await requireOrg();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "noFile" };
    if (file.size > CSV_MAX_BYTES) return { error: "fileTooLarge" };
    const business = await prisma.business.findFirst({
      where: { organizationId: orgId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!business) return { error: "noBusiness" };

    const text = await file.text();
    const summary = await importCsv({
      organizationId: orgId,
      businessId: business.id,
      csvText: text,
      actorUserId: user.id,
    });
    if (summary.fileError) {
      const map: Record<string, string> = {
        FILE_TOO_LARGE: "fileTooLarge",
        TOO_MANY_ROWS: "fileTooLarge",
        EMPTY_FILE: "badHeader",
        MISSING_HEADER: "badHeader",
      };
      return { error: map[summary.fileError] ?? "server" };
    }
    if (summary.imported > 0) {
      // Immediate deterministic refresh — no waiting for the daily cron.
      await refreshBusinessIntelligence(business.id);
    }
    revalidatePath("/dashboard");
    revalidatePath("/settings/sources");
    return {
      ok: true,
      total: summary.totalRows,
      imported: summary.imported,
      updated: summary.updated,
      invalid: summary.invalid,
      rowErrors: summary.errors,
    };
  } catch (error) {
    console.error("importCsvAction failed:", error);
    return { error: "server" };
  }
}

// ── Competitors (spec §21: the owner confirms; nothing is fabricated) ────

const competitorSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().max(60).optional().or(z.literal("")),
  city: z.string().trim().max(60).optional().or(z.literal("")),
  rating: z
    .string()
    .trim()
    .refine((v) => v === "" || (Number(v) >= 1 && Number(v) <= 5), "bad")
    .optional(),
  reviewCount: z
    .string()
    .trim()
    .refine((v) => v === "" || (Number(v) >= 0 && Number.isInteger(Number(v))), "bad")
    .optional(),
});

export interface CompetitorState {
  ok?: boolean;
  error?: string; // exists | invalid | server
}

async function scopedBusinessId(orgId: string): Promise<string> {
  const business = await prisma.business.findFirst({
    where: { organizationId: orgId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!business) throw new Error("NO_BUSINESS");
  return business.id;
}

export async function addCompetitorAction(
  _prev: CompetitorState,
  formData: FormData
): Promise<CompetitorState> {
  try {
    const { orgId, user } = await requireOrg();
    const parsed = competitorSchema.safeParse({
      name: String(formData.get("name") ?? ""),
      category: String(formData.get("category") ?? ""),
      city: String(formData.get("city") ?? ""),
      rating: String(formData.get("rating") ?? ""),
      reviewCount: String(formData.get("reviewCount") ?? ""),
    });
    if (!parsed.success) return { error: "invalid" };
    const businessId = await scopedBusinessId(orgId);
    const existing = await prisma.competitor.findFirst({
      where: { businessId, name: parsed.data.name },
      select: { id: true },
    });
    if (existing) return { error: "exists" };
    await prisma.competitor.create({
      data: {
        organizationId: orgId,
        businessId,
        name: parsed.data.name,
        category: parsed.data.category || null,
        city: parsed.data.city || null,
        rating:
          parsed.data.rating && parsed.data.rating !== ""
            ? Math.round(Number(parsed.data.rating) * 10) / 10
            : null,
        reviewCount:
          parsed.data.reviewCount && parsed.data.reviewCount !== ""
            ? Number(parsed.data.reviewCount)
            : null,
        status: "CONFIRMED",
      },
    });
    await audit("competitor.added", {
      userId: user.id,
      organizationId: orgId,
      entity: "business",
      entityId: businessId,
    });
    revalidatePath("/dashboard");
    revalidatePath("/settings/sources");
    return { ok: true };
  } catch (error) {
    console.error("addCompetitorAction failed:", error);
    return { error: "server" };
  }
}

export async function removeCompetitorAction(formData: FormData): Promise<void> {
  const { orgId, user } = await requireOrg();
  const id = String(formData.get("id") ?? "");
  // Tenant fence: only delete when the competitor's business belongs to org.
  const competitor = await prisma.competitor.findFirst({
    where: { id, business: { organizationId: orgId } },
    select: { id: true, name: true, businessId: true },
  });
  if (!competitor) return;
  await prisma.competitor.delete({ where: { id: competitor.id } });
  await audit("competitor.removed", {
    userId: user.id,
    organizationId: orgId,
    entity: "competitor",
    entityId: competitor.id,
  });
  revalidatePath("/dashboard");
  revalidatePath("/settings/sources");
}
