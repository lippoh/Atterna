// src/lib/reputation/themes.ts — customer themes over time + the
// recurring/emerging issue detection (spec §17–§19). Themes come from the
// persisted, closed-vocabulary ReviewAnalysis categories, so they are
// comparable across months and sources. Detection is DETERMINISTIC
// (thresholds below); the LLM never decides what is "recurring".
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { categoryLabel } from "@/lib/metrics";

const DAY_MS = 86_400_000;

export interface ThemeStat {
  category: string;
  labelEl: string;
  labelEn: string;
  complaintMentions: number; // window (90d)
  complimentMentions: number; // window (90d)
  priorWindowComplaints: number; // previous 90d (180d..90d)
  last30Complaints: number;
  monthly: number[]; // complaint mentions per calendar month, oldest → newest (6)
  firstSeen: Date | null;
  lastSeen: Date | null;
  sources: string[];
}

export interface IssueCandidate {
  category: string;
  kind: "RECURRING" | "EMERGING";
  severity: "LOW" | "MEDIUM" | "HIGH";
  mentionsCurrent: number;
  mentionsPrevious: number;
  trend: "UP" | "DOWN" | "STABLE";
  sources: string[];
  firstSeen: Date;
  lastSeen: Date;
}

export const RECURRING_THRESHOLD = 6; // mentions in 90d
export const RECURRING_MONTHS = 2; // …present in at least this many of the last 3 months
export const EMERGING_MIN_30D = 3; // mentions in the last 30d
export const EMERGING_DOUBLING = 1; // last-30d ≥ previous-90d total × this factor

/**
 * Pure detection (unit-tested). Rules:
 *  RECURRING — ≥ RECURRING_THRESHOLD complaint mentions in the last 90d AND
 *              present in ≥ RECURRING_MONTHS of the last 3 calendar months.
 *              Severity: ≥15 mentions (or ≥10 rising) → HIGH; ≥8 → MEDIUM;
 *              else LOW.
 *  EMERGING  — ≥ EMERGING_MIN_30D mentions in the last 30d AND the last-30d
 *              count is at least the previous-90d count (recently started
 *              increasing), AND the theme is not already RECURRING (a
 *              persistent problem is labeled recurring with an UP trend).
 */
export function detectIssueCandidates(
  stats: ThemeStat[],
  now = new Date()
): IssueCandidate[] {
  const candidates: IssueCandidate[] = [];
  const recurringCategories = new Set<string>();

  for (const stat of stats) {
    if (stat.complaintMentions < RECURRING_THRESHOLD) continue;
    const last3 = stat.monthly.slice(-3);
    const activeMonths = last3.filter((m) => m > 0).length;
    if (activeMonths < RECURRING_MONTHS) continue;

    const trend = trendOf(stat.complaintMentions, stat.priorWindowComplaints);
    const severity: IssueCandidate["severity"] =
      stat.complaintMentions >= 15 || (stat.complaintMentions >= 10 && trend === "UP")
        ? "HIGH"
        : stat.complaintMentions >= 8
          ? "MEDIUM"
          : "LOW";
    recurringCategories.add(stat.category);
    candidates.push({
      category: stat.category,
      kind: "RECURRING",
      severity,
      mentionsCurrent: stat.complaintMentions,
      mentionsPrevious: stat.priorWindowComplaints,
      trend,
      sources: stat.sources,
      firstSeen: stat.firstSeen ?? now,
      lastSeen: stat.lastSeen ?? now,
    });
  }

  for (const stat of stats) {
    if (recurringCategories.has(stat.category)) continue;
    if (stat.last30Complaints < EMERGING_MIN_30D) continue;
    if (stat.last30Complaints < stat.priorWindowComplaints * EMERGING_DOUBLING) continue;
    if (stat.priorWindowComplaints === 0 && stat.last30Complaints < EMERGING_MIN_30D + 2) {
      // brand-new blips (2 mentions, zero history) are not yet "emerging"
      continue;
    }
    candidates.push({
      category: stat.category,
      kind: "EMERGING",
      severity: stat.last30Complaints >= 6 ? "HIGH" : "MEDIUM",
      mentionsCurrent: stat.last30Complaints,
      mentionsPrevious: stat.priorWindowComplaints,
      trend: "UP",
      sources: stat.sources,
      firstSeen: stat.firstSeen ?? now,
      lastSeen: stat.lastSeen ?? now,
    });
  }

  return candidates.sort(
    (a, b) =>
      severityRank(b.severity) - severityRank(a.severity) ||
      b.mentionsCurrent - a.mentionsCurrent
  );
}

function severityRank(severity: string): number {
  return severity === "HIGH" ? 3 : severity === "MEDIUM" ? 2 : 1;
}

function trendOf(current: number, previous: number): "UP" | "DOWN" | "STABLE" {
  if (previous === 0) return current > 0 ? "UP" : "STABLE";
  const ratio = current / previous;
  if (ratio >= 1.2) return "UP";
  if (ratio <= 0.8) return "DOWN";
  return "STABLE";
}

interface AnalysisRow {
  complaints: Prisma.JsonValue;
  compliments: Prisma.JsonValue;
  review: { receivedAt: Date; source: string };
}

function asCategoryItems(json: Prisma.JsonValue): { category: string }[] {
  if (!Array.isArray(json)) return [];
  return json.filter(
    (item): item is { category: string } =>
      typeof item === "object" && item !== null && "category" in item
  );
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Theme stats for one business: complaint/compliment mentions per closed
 * category over the 90d window, the previous 90d window, the last 30d and
 * the last 6 calendar months. Bounded fetch (take 5000 analyses).
 */
export async function getThemeStats(
  orgId: string,
  businessId: string,
  now = new Date()
): Promise<ThemeStat[]> {
  const since180 = new Date(now.getTime() - 180 * DAY_MS);
  const rows = (await prisma.reviewAnalysis.findMany({
    where: {
      review: {
        organizationId: orgId,
        businessId,
        deletedAt: null,
        receivedAt: { gte: since180 },
      },
    },
    select: {
      complaints: true,
      compliments: true,
      review: { select: { receivedAt: true, source: true } },
    },
    take: 5000,
  })) as AnalysisRow[];

  const since90 = new Date(now.getTime() - 90 * DAY_MS);
  const since30 = new Date(now.getTime() - 30 * DAY_MS);
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    months.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  }

  const map = new Map<
    string,
    {
      complaints: number;
      compliments: number;
      prior: number;
      last30: number;
      byMonth: Map<string, number>;
      firstSeen: Date | null;
      lastSeen: Date | null;
      sources: Set<string>;
    }
  >();

  for (const row of rows) {
    const receivedAt = row.review.receivedAt;
    const complaintItems = asCategoryItems(row.complaints);
    const complimentItems = asCategoryItems(row.compliments);
    const categories = new Set([
      ...complaintItems.map((c) => c.category),
      ...complimentItems.map((c) => c.category),
    ]);
    for (const category of categories) {
      const stat =
        map.get(category) ??
        {
          complaints: 0,
          compliments: 0,
          prior: 0,
          last30: 0,
          byMonth: new Map<string, number>(),
          firstSeen: null,
          lastSeen: null,
          sources: new Set<string>(),
        };
      const isComplaint = complaintItems.some((c) => c.category === category);
      if (isComplaint) {
        if (receivedAt >= since90) stat.complaints++;
        else stat.prior++;
        if (receivedAt >= since30) stat.last30++;
        const key = monthKey(new Date(receivedAt));
        if (months.includes(key)) stat.byMonth.set(key, (stat.byMonth.get(key) ?? 0) + 1);
      } else {
        if (receivedAt >= since90) stat.compliments++;
      }
      if (!stat.firstSeen || receivedAt < stat.firstSeen) stat.firstSeen = receivedAt;
      if (!stat.lastSeen || receivedAt > stat.lastSeen) stat.lastSeen = receivedAt;
      stat.sources.add(row.review.source);
      map.set(category, stat);
    }
  }

  return [...map.entries()]
    .map(([category, s]) => ({
      category,
      labelEl: categoryLabel(category, "el"),
      labelEn: categoryLabel(category, "en"),
      complaintMentions: s.complaints,
      complimentMentions: s.compliments,
      priorWindowComplaints: s.prior,
      last30Complaints: s.last30,
      monthly: months.map((m) => s.byMonth.get(m) ?? 0),
      firstSeen: s.firstSeen,
      lastSeen: s.lastSeen,
      sources: [...s.sources].sort(),
    }))
    .sort((a, b) => b.complaintMentions - a.complaintMentions);
}
