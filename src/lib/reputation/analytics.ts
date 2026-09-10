// src/lib/reputation/analytics.ts — historical windows + deterministic
// aggregates (spec §12, §15). EVERY number the product shows comes from
// here (app code), never from the LLM. Windows: 7d/30d/90d/180d/365d/all.
// Suggested defaults per spec §12: 30d velocity/response, 90d sentiment +
// themes, 12m rating trend/seasonality, all-time historical reputation.
import { prisma } from "@/lib/db";
import type { Prisma, Sentiment } from "@prisma/client";
import type { TrendPoint } from "@/lib/metrics";
import { bucketByDay } from "@/lib/metrics";

export type WindowKey = "7d" | "30d" | "90d" | "180d" | "365d" | "all";

export const WINDOW_DAYS: Record<WindowKey, number | null> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "180d": 180,
  "365d": 365,
  all: null,
};

const DAY_MS = 86_400_000;

export function windowStart(key: WindowKey, now = new Date()): Date | null {
  const days = WINDOW_DAYS[key];
  return days === null ? null : new Date(now.getTime() - days * DAY_MS);
}

export interface WindowStats {
  window: WindowKey;
  count: number;
  avgRating: number | null;
  answered: number;
  responseRate: number | null; // replied/total inside the window
  negative: number; // rating <= 3
  analyzed: number;
  sentiment: { positive: number; neutral: number; negative: number };
}

export async function getWindowStats(
  orgId: string,
  businessId: string,
  key: WindowKey,
  now = new Date()
): Promise<WindowStats> {
  const since = windowStart(key, now);
  const where: Prisma.ReviewWhereInput = {
    organizationId: orgId,
    businessId,
    deletedAt: null,
    ...(since ? { receivedAt: { gte: since } } : {}),
  };
  const [agg, answered, analyzed, negative] = await Promise.all([
    prisma.review.aggregate({ where, _avg: { rating: true }, _count: { _all: true } }),
    prisma.review.count({ where: { ...where, repliedAt: { not: null } } }),
    prisma.reviewAnalysis.findMany({
      where: { review: where },
      select: { sentiment: true },
    }),
    // Stage B: was a sequential await AFTER the block above (N+1 pattern).
    prisma.review.count({ where: { ...where, rating: { lte: 3 } } }),
  ]);
  const count = agg._count._all;
  const sentiment = { positive: 0, neutral: 0, negative: 0 };
  for (const a of analyzed) {
    const key =
      a.sentiment === "POSITIVE" ? "positive" : a.sentiment === "NEGATIVE" ? "negative" : "neutral";
    sentiment[key]++;
  }
  return {
    window: key,
    count,
    avgRating: agg._avg.rating === null ? null : Math.round(agg._avg.rating * 10) / 10,
    answered,
    responseRate: count === 0 ? null : answered / count,
    negative,
    analyzed: analyzed.length,
    sentiment,
  };
}

export interface SourceCount {
  source: string; // raw stored value
  count: number;
}

export interface SourceBreakdown {
  sources: SourceCount[]; // descending by count
  feedbackCount: number; // Atterna QR/private feedback submissions
  total: number; // reviews + feedback = "total customer feedback"
}

/**
 * Multi-source panel (spec §24): review counts per source PLUS the
 * first-party Atterna feedback channel, so the owner sees one number for
 * "total customer feedback" across every voice they collect.
 */
export async function getSourceBreakdown(
  orgId: string,
  businessId: string
): Promise<SourceBreakdown> {
  const [grouped, feedbackCount] = await Promise.all([
    prisma.review.groupBy({
      by: ["source"],
      where: { organizationId: orgId, businessId, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.feedbackSubmission.count({ where: { businessId } }),
  ]);
  const sources = grouped
    .map((g) => ({ source: g.source, count: g._count._all }))
    .sort((a, b) => b.count - a.count);
  const reviewTotal = sources.reduce((sum, s) => sum + s.count, 0);
  return { sources, feedbackCount, total: reviewTotal + feedbackCount };
}

export interface MonthBucket {
  month: string; // YYYY-MM
  count: number;
  avgRating: number | null;
  negative: number;
  answered: number;
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Calendar-month buckets (spec §12 12-month trends, §23 seasonality, YoY).
 * Bounded fetch (take 5000) — deep history falls back to aggregates, never
 * unbounded scans.
 */
export async function getMonthlyBuckets(
  orgId: string,
  businessId: string,
  months = 13,
  now = new Date()
): Promise<MonthBucket[]> {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1)
  );
  const reviews = await prisma.review.findMany({
    where: {
      organizationId: orgId,
      businessId,
      deletedAt: null,
      receivedAt: { gte: start },
    },
    select: { rating: true, receivedAt: true, repliedAt: true },
    orderBy: { receivedAt: "asc" },
    take: 5000,
  });
  const buckets = new Map<string, { ratings: number[]; negative: number; answered: number }>();
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    buckets.set(monthKey(d), { ratings: [], negative: 0, answered: 0 });
  }
  for (const r of reviews) {
    const key = monthKey(new Date(r.receivedAt));
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.ratings.push(r.rating);
    if (r.rating <= 3) bucket.negative++;
    if (r.repliedAt) bucket.answered++;
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, b]) => ({
      month,
      count: b.ratings.length,
      avgRating: b.ratings.length
        ? Math.round((b.ratings.reduce((s, x) => s + x, 0) / b.ratings.length) * 10) / 10
        : null,
      negative: b.negative,
      answered: b.answered,
    }));
}

/** Monthly series shaped for the existing TrendChart component. */
export function monthlyTrendPoints(buckets: MonthBucket[]): TrendPoint[] {
  return buckets.map((b) => ({
    date: `${b.month}-01`,
    value: b.avgRating,
  }));
}

/** Average hours between arrival and reply (replied reviews only, 90d). */
export async function getResponseTimeHours(
  orgId: string,
  businessId: string,
  sinceDays = 90,
  now = new Date()
): Promise<number | null> {
  const since = new Date(now.getTime() - sinceDays * DAY_MS);
  const rows = await prisma.review.findMany({
    where: {
      organizationId: orgId,
      businessId,
      deletedAt: null,
      receivedAt: { gte: since },
      repliedAt: { not: null },
    },
    select: { receivedAt: true, repliedAt: true },
    take: 2000,
  });
  if (rows.length === 0) return null;
  const totalHours = rows.reduce((sum, r) => {
    const delta = (r.repliedAt!.getTime() - r.receivedAt.getTime()) / 3_600_000;
    // Negative deltas only occur for CSV rows whose reply pre-dated arrival
    // normalization — clamp to 0 instead of fabricating negative speed.
    return sum + Math.max(0, delta);
  }, 0);
  return Math.round((totalHours / rows.length) * 10) / 10;
}

/** Daily rating series over N days (reuses the unit-tested helper). */
export async function getRatingTrend(
  orgId: string,
  businessId: string,
  days = 90
): Promise<TrendPoint[]> {
  const since = new Date(Date.now() - days * DAY_MS);
  const reviews = await prisma.review.findMany({
    where: { organizationId: orgId, businessId, deletedAt: null, receivedAt: { gte: since } },
    select: { rating: true, receivedAt: true },
    take: 5000,
  });
  return bucketByDay(reviews, days);
}
