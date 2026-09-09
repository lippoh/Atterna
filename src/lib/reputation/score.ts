// src/lib/reputation/score.ts — the deterministic Reputation Health Score
// (spec §13). THE LLM NEVER COMPUTES THIS. App code calculates; the AI (if
// configured) only narrates the result from these numbers.
//
// FORMULA (documented, versioned — v1):
//   score = round( Σ weightᵢ · subscoreᵢ / 100 + competitorAdj ), clamped 0–100
//
//   subscore      input                              weight
//   ────────────────────────────────────────────────────────
//   rating        avg rating /5 × 100 (12m, else all-time)   30
//   sentiment     (pos + 0.5·neu) / analyzed × 100 (90d)     20
//   response      reply rate × 100 (90d, else all-time)      20
//   trend         50 + Δrating(90d vs prev 90d) × 100        15
//   issues        100 − severity penalties (open issues)     10
//   velocity      60..100 vs own historical monthly avg       5
//   competitorAdj own rating − competitor avg (±5 cap)      ±5
//
//   Confidence is ANNOTATED, never shrinks the score (spec §14: no
//   manufactured doubt — show the data, label how deep it is):
//   90-day review count 0–2 = "thin", 3–9 = "building", ≥10 = "solid".
import { prisma } from "@/lib/db";
import {
  getWindowStats,
  getMonthlyBuckets,
  getSourceBreakdown,
  getResponseTimeHours,
} from "./analytics";
import { computeBenchmark, type Benchmark } from "./competitors";

export interface ScoreInput {
  now: Date;
  avgRating12m: number | null;
  avgRatingAllTime: number | null;
  avgRating90d: number | null;
  avgRatingPrev90d: number | null;
  responseRate90d: number | null; // 0..1 (null = no reviews in 90d)
  responseRateAllTime: number | null;
  sentiment90d: { positive: number; neutral: number; negative: number };
  analyzed90d: number;
  openIssues: { category: string; kind: string; severity: string }[];
  reviews30d: number;
  reviews90d: number;
  avgMonthlyAllTime: number; // reviews/month since first review
  benchmark: Pick<Benchmark, "competitorAvgRating" | "ownRating"> | null;
}

export interface SubScore {
  key: "rating" | "sentiment" | "response" | "trend" | "issues" | "velocity";
  value: number; // 0-100
  weight: number; // 0-100, weights sum to 100
  input: string; // human-readable input summary (audit/explanation)
}

export type ConfidenceLevel = "thin" | "building" | "solid";

export interface ScoreResult {
  score: number;
  version: 1;
  subscores: SubScore[];
  competitorAdjustment: number | null;
  confidence: { level: ConfidenceLevel; reviews90d: number };
  inputsSummary: {
    avgRating12m: number | null;
    avgRating90d: number | null;
    ratingDelta90d: number | null;
    responseRate90d: number | null;
    negativeShare90d: number | null; // 0..1 among analyzed
    openIssues: number;
    reviews30d: number;
    reviews90d: number;
  };
}

const WEIGHTS: Record<SubScore["key"], number> = {
  rating: 30,
  sentiment: 20,
  response: 20,
  trend: 15,
  issues: 10,
  velocity: 5,
};

const ISSUE_PENALTY: Record<string, number> = { HIGH: 12, MEDIUM: 7, LOW: 3 };
const ISSUE_PENALTY_CAP = 45;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Pure computation — unit-tested, no DB. */
export function computeReputationScore(input: ScoreInput): ScoreResult {
  const subscores: SubScore[] = [];

  // 1. Rating (12m preferred; all-time fallback when the year is thin).
  const ratingBasis =
    input.avgRating12m ?? input.avgRatingAllTime;
  subscores.push({
    key: "rating",
    value: clamp((ratingBasis ?? 3) / 5 * 100, 0, 100),
    weight: WEIGHTS.rating,
    input: `${ratingBasis ?? "—"} / 5`,
  });

  // 2. Sentiment (90d, among analyzed; neutral counts half).
  const analyzed = input.analyzed90d;
  const sentimentValue =
    analyzed > 0
      ? clamp(
          ((input.sentiment90d.positive + 0.5 * input.sentiment90d.neutral) / analyzed) * 100,
          0,
          100
        )
      : 50; // no analyzed reviews → neutral, annotated via confidence
  subscores.push({
    key: "sentiment",
    value: sentimentValue,
    weight: WEIGHTS.sentiment,
    input: analyzed
      ? `+${input.sentiment90d.positive} / ~${input.sentiment90d.neutral} / −${input.sentiment90d.negative}`
      : "no analyzed reviews",
  });

  // 3. Response (90d preferred; all-time fallback so quiet months keep history).
  const responseRate = input.responseRate90d ?? input.responseRateAllTime;
  subscores.push({
    key: "response",
    value: clamp((responseRate ?? 0.5) * 100, 0, 100),
    weight: WEIGHTS.response,
    input: responseRate === null ? "no reviews yet" : `${Math.round(responseRate * 100)}%`,
  });

  // 4. Trend (90d vs previous 90d average rating; ±0.5 stars spans 0..100).
  const ratingDelta =
    input.avgRating90d !== null && input.avgRatingPrev90d !== null
      ? Math.round((input.avgRating90d - input.avgRatingPrev90d) * 10) / 10
      : null;
  subscores.push({
    key: "trend",
    value: ratingDelta === null ? 50 : clamp(50 + ratingDelta * 100, 0, 100),
    weight: WEIGHTS.trend,
    input: ratingDelta === null ? "no comparison window" : `${ratingDelta >= 0 ? "+" : ""}${ratingDelta}`,
  });

  // 5. Open issues (severity-weighted penalty, capped).
  const penalty = Math.min(
    ISSUE_PENALTY_CAP,
    input.openIssues.reduce((sum, i) => sum + (ISSUE_PENALTY[i.severity] ?? 3), 0)
  );
  subscores.push({
    key: "issues",
    value: clamp(100 - penalty, 0, 100),
    weight: WEIGHTS.issues,
    input: input.openIssues.length
      ? input.openIssues.map((i) => i.category).join(", ")
      : "none open",
  });

  // 6. Velocity vs own historical monthly average — gentle floor at 60 so
  //    off-season quiet months are never punished (spec §23).
  const expectedMonthly = Math.max(0.5, input.avgMonthlyAllTime);
  const velocityValue =
    input.reviews30d === 0 && input.avgMonthlyAllTime === 0
      ? 60 // brand new business — neutral
      : clamp(60 + 40 * Math.min(1, input.reviews30d / expectedMonthly), 60, 100);
  subscores.push({
    key: "velocity",
    value: velocityValue,
    weight: WEIGHTS.velocity,
    input: `${input.reviews30d} in 30d vs ~${Math.round(expectedMonthly * 10) / 10}/mo`,
  });

  // 7. Competitor adjustment (only with real benchmark data, ±5, spec §22:
  //    never fabricate — null benchmark means no adjustment, not a penalty).
  let competitorAdjustment: number | null = null;
  if (
    input.benchmark?.competitorAvgRating != null &&
    input.benchmark?.ownRating != null
  ) {
    competitorAdjustment = clamp(
      Math.round((input.benchmark.ownRating - input.benchmark.competitorAvgRating) * 10),
      -5,
      5
    );
  }

  const weighted = subscores.reduce((sum, s) => sum + (s.value * s.weight) / 100, 0);
  const score = clamp(Math.round(weighted + (competitorAdjustment ?? 0)), 0, 100);

  const confidenceLevel: ConfidenceLevel =
    input.reviews90d >= 10 ? "solid" : input.reviews90d >= 3 ? "building" : "thin";

  return {
    score,
    version: 1,
    subscores,
    competitorAdjustment,
    confidence: { level: confidenceLevel, reviews90d: input.reviews90d },
    inputsSummary: {
      avgRating12m: input.avgRating12m,
      avgRating90d: input.avgRating90d,
      ratingDelta90d: ratingDelta,
      responseRate90d: input.responseRate90d,
      negativeShare90d:
        analyzed > 0 ? input.sentiment90d.negative / analyzed : null,
      openIssues: input.openIssues.length,
      reviews30d: input.reviews30d,
      reviews90d: input.reviews90d,
    },
  };
}

// ── DB layer: assemble inputs, compute, snapshot, read history ──────────

export interface ScoreSnapshot {
  date: string; // YYYY-MM-DD
  score: number;
  breakdown: ScoreResult;
}

function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function avgRatingBetween(
  orgId: string,
  businessId: string,
  from: Date | null,
  to: Date | null
): Promise<number | null> {
  const agg = await prisma.review.aggregate({
    where: {
      organizationId: orgId,
      businessId,
      deletedAt: null,
      ...(from ? { receivedAt: { gte: from } } : {}),
      ...(to ? { receivedAt: { ...((from ? {} : {}) as object), lt: to } } : {}),
    },
    _avg: { rating: true },
  });
  return agg._avg.rating === null ? null : Math.round(agg._avg.rating * 10) / 10;
}

/** Collect every input the deterministic score needs (bounded queries). */
export async function collectScoreInput(
  orgId: string,
  businessId: string,
  now = new Date()
): Promise<ScoreInput> {
  const DAY = 86_400_000;
  const since30 = new Date(now.getTime() - 30 * DAY);
  const since90 = new Date(now.getTime() - 90 * DAY);
  const since180 = new Date(now.getTime() - 180 * DAY);
  const since365 = new Date(now.getTime() - 365 * DAY);

  const [w30, w90, w180, w365, wAll, s12m, sAll, s90d, sPrev90, openIssues, firstReview, monthly, breakdown] =
    await Promise.all([
      getWindowStats(orgId, businessId, "30d", now),
      getWindowStats(orgId, businessId, "90d", now),
      getWindowStats(orgId, businessId, "180d", now),
      getWindowStats(orgId, businessId, "365d", now),
      getWindowStats(orgId, businessId, "all", now),
      avgRatingBetween(orgId, businessId, since365, null),
      avgRatingBetween(orgId, businessId, null, null),
      avgRatingBetween(orgId, businessId, since90, null),
      avgRatingBetween(orgId, businessId, since180, since90),
      prisma.issue.findMany({
        where: { businessId, status: { in: ["OPEN", "IN_PROGRESS"] } },
        select: { category: true, kind: true, severity: true },
      }),
      prisma.review.findFirst({
        where: { organizationId: orgId, businessId, deletedAt: null },
        orderBy: { receivedAt: "asc" },
        select: { receivedAt: true },
      }),
      getMonthlyBuckets(orgId, businessId, 12, now),
      getSourceBreakdown(orgId, businessId),
    ]);

  // 12-month rating with all-time fallback when the year has < 5 reviews.
  const avgRating12m = (w365.count ?? 0) >= 5 ? s12m : sAll;

  const totalReviews = wAll.count;
  const monthsActive = firstReview
    ? Math.max(
        1,
        (now.getTime() - firstReview.receivedAt.getTime()) / (30.4 * DAY)
      )
    : 1;
  const avgMonthlyAllTime = Math.round((totalReviews / monthsActive) * 10) / 10;

  void monthly; // kept for future velocity-seasonality refinement
  void breakdown;

  const competitors = await prisma.competitor.findMany({
    where: { businessId, status: "CONFIRMED" },
    select: { rating: true },
  });
  const rated = competitors.filter((c) => c.rating !== null) as { rating: number }[];
  const competitorAvgRating = rated.length
    ? Math.round((rated.reduce((s, c) => s + c.rating, 0) / rated.length) * 10) / 10
    : null;

  return {
    now,
    avgRating12m,
    avgRatingAllTime: sAll,
    avgRating90d: s90d,
    avgRatingPrev90d: sPrev90,
    responseRate90d: w90.responseRate,
    responseRateAllTime: wAll.responseRate,
    sentiment90d: w90.sentiment,
    analyzed90d: w90.analyzed,
    openIssues,
    reviews30d: w30.count,
    reviews90d: w90.count,
    avgMonthlyAllTime,
    benchmark:
      competitorAvgRating !== null
        ? { competitorAvgRating, ownRating: avgRating12m ?? sAll }
        : null,
  };
}

/** Compute + persist today's snapshot (idempotent per day). */
export async function snapshotReputation(
  orgId: string,
  businessId: string,
  now = new Date()
): Promise<ScoreResult> {
  const input = await collectScoreInput(orgId, businessId, now);
  const result = computeReputationScore(input);
  const date = utcMidnight(now);
  await prisma.reputationSnapshot.upsert({
    where: { businessId_date: { businessId, date } },
    create: {
      businessId,
      date,
      score: result.score,
      breakdown: result as unknown as object,
    },
    update: { score: result.score, breakdown: result as unknown as object },
  });
  return result;
}

export interface ScoreChange {
  score: number;
  previous: number | null;
  delta: number | null;
  previousDate: string | null;
}

/** Latest snapshot vs the most recent DIFFERENT day (skip identical re-runs). */
export async function getScoreWithChange(
  businessId: string
): Promise<ScoreChange> {
  const snapshots = await prisma.reputationSnapshot.findMany({
    where: { businessId },
    orderBy: { date: "desc" },
    take: 30,
    select: { date: true, score: true },
  });
  const latest = snapshots[0];
  const previous = snapshots.find(
    (s) => s.date.getTime() !== latest?.date.getTime()
  );
  return {
    score: latest?.score ?? 0,
    previous: previous?.score ?? null,
    delta:
      latest && previous ? latest.score - previous.score : null,
    previousDate: previous
      ? previous.date.toISOString().slice(0, 10)
      : null,
  };
}

/** Snapshot history for the score trend chart (oldest → newest). */
export async function getScoreHistory(
  businessId: string,
  days = 90
): Promise<{ date: string; score: number }[]> {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await prisma.reputationSnapshot.findMany({
    where: { businessId, date: { gte: since } },
    orderBy: { date: "asc" },
    select: { date: true, score: true },
  });
  return rows.map((r) => ({ date: r.date.toISOString().slice(0, 10), score: r.score }));
}
