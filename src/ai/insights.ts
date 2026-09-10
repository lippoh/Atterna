// src/ai/insights.ts — business-level AI intelligence (spec §15, §16)
// The LLM narrates; it never calculates. Input is an AGGREGATED context
// (window metrics, theme counts, open issues — never raw review dumps),
// output is strictly validated, and every summary is cached in
// BusinessInsight keyed by a data fingerprint: it is regenerated ONLY
// when the underlying data changed. When no AI provider is configured
// (development without keys), both getters return null and the UI shows
// the deterministic explanation alone.
import { createHash } from "node:crypto";
import { z } from "zod";
import { completeObject } from "./provider";
import { getPrompt } from "./prompts";
import { recordUsage } from "./usage";
import { prisma } from "@/lib/db";
import { getWindowStats } from "@/lib/reputation/analytics";
import { getThemeStats } from "@/lib/reputation/themes";
import type { ScoreResult } from "@/lib/reputation/score";

// ── Contracts ────────────────────────────────────────────────────────────

export const quarterlySummarySchema = z.object({
  narrative: z.string().min(40).max(900),
  strengths: z.array(z.string().min(4).max(120)).max(3).default([]),
  risks: z.array(z.string().min(4).max(120)).max(3).default([]),
});
export type QuarterlySummary = z.infer<typeof quarterlySummarySchema>;

export const healthNarrativeSchema = z.object({
  text: z.string().min(20).max(400),
});
export type HealthNarrative = z.infer<typeof healthNarrativeSchema>;

// ── Fingerprint (cost control, spec §16) ─────────────────────────────────

/**
 * A cheap data fingerprint: changes ONLY when the underlying intelligence
 * data changes (new reviews, new analyses, issue changes). Summaries whose
 * fingerprint still matches are served from cache — the 90-day summary is
 * not regenerated on every page view.
 */
export async function dataFingerprint(businessId: string): Promise<string> {
  const [agg, analysisAgg, issues] = await Promise.all([
    prisma.review.aggregate({
      where: { businessId, deletedAt: null },
      _count: { _all: true },
      _max: { receivedAt: true },
    }),
    prisma.reviewAnalysis.count({ where: { review: { businessId } } }),
    prisma.issue.findMany({
      where: { businessId, status: { in: ["OPEN", "IN_PROGRESS"] } },
      select: { category: true, kind: true, mentionsCurrent: true, trend: true },
    }),
  ]);
  const basis = JSON.stringify({
    reviews: agg._count._all,
    last: agg._max.receivedAt?.toISOString() ?? null,
    analyses: analysisAgg,
    issues,
  });
  return createHash("sha256").update(basis).digest("hex").slice(0, 24);
}

// ── Aggregated context builders ──────────────────────────────────────────

function pct(value: number | null): string {
  return value === null ? "n/a" : `${Math.round(value * 100)}%`;
}

async function buildSummaryContext(orgId: string, businessId: string, locale: string) {
  const [w30, w90, w365, wAll, themes] = await Promise.all([
    getWindowStats(orgId, businessId, "30d"),
    getWindowStats(orgId, businessId, "90d"),
    getWindowStats(orgId, businessId, "365d"),
    getWindowStats(orgId, businessId, "all"),
    getThemeStats(orgId, businessId),
  ]);
  const topComplaints = themes
    .filter((t) => t.complaintMentions > 0)
    .slice(0, 5)
    .map((t) => ({
      theme: locale === "en" ? t.labelEn : t.labelEl,
      mentions90d: t.complaintMentions,
      previous90d: t.priorWindowComplaints,
      last30d: t.last30Complaints,
    }));
  const topStrengths = [...themes]
    .sort((a, b) => b.complimentMentions - a.complimentMentions)
    .filter((t) => t.complimentMentions > 0)
    .slice(0, 5)
    .map((t) => ({
      theme: locale === "en" ? t.labelEn : t.labelEl,
      mentions90d: t.complimentMentions,
    }));
  return {
    windows: {
      last30days: {
        reviews: w30.count,
        avgRating: w30.avgRating,
        responseRate: pct(w30.responseRate),
      },
      last90days: {
        reviews: w90.count,
        avgRating: w90.avgRating,
        responseRate: pct(w90.responseRate),
        sentiment: w90.sentiment,
      },
      last12months: { reviews: w365.count, avgRating: w365.avgRating },
      allTime: { reviews: wAll.count, avgRating: wAll.avgRating },
    },
    topComplaintThemes: topComplaints,
    topStrengthThemes: topStrengths,
  };
}

// ── Cached getters ───────────────────────────────────────────────────────

/**
 * The 90-day "Customer Voice" narrative + strengths/risks. Cached by
 * fingerprint; returns null when AI is unavailable or generation fails —
 * the dashboard then relies on the deterministic layer only.
 */
export async function getQuarterlySummary(
  orgId: string,
  businessId: string,
  locale: string
): Promise<QuarterlySummary | null> {
  const fingerprint = await dataFingerprint(businessId);
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - 90 * 86_400_000);

  const cached = await prisma.businessInsight.findFirst({
    where: { businessId, kind: "QUARTERLY_SUMMARY", fingerprint },
    orderBy: { createdAt: "desc" },
  });
  if (cached) {
    const parsed = quarterlySummarySchema.safeParse(cached.payload);
    if (parsed.success) return parsed.data;
  }

  const context = await buildSummaryContext(orgId, businessId, locale);
  const prompt = await getPrompt("business-summary", 1);
  try {
    const result = await completeObject({
      tier: "main",
      system: prompt.system,
      prompt: [
        "Write the summary using ONLY the aggregated data between the <data> tags.",
        `Language: ${locale === "en" ? "English" : "Greek (el)"}.`,
        "<data>",
        JSON.stringify(context, null, 1),
        "</data>",
      ].join("\n"),
      schema: quarterlySummarySchema,
      maxRetries: 1,
      timeoutMs: 25_000,
    });
    await prisma.businessInsight.create({
      data: {
        businessId,
        kind: "QUARTERLY_SUMMARY",
        windowStart,
        windowEnd,
        fingerprint,
        payload: result.data as object,
        model: result.model,
        promptVersion: String(prompt.version),
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
      },
    });
    await recordUsage(orgId, "report", result);
    return result.data;
  } catch {
    // AI unavailable (e.g. development without OPENAI_API_KEY) — the
    // deterministic layer carries the dashboard. Never crash on this.
    return null;
  }
}

/**
 * Cache-ONLY read for page rendering (never generates — page views never
 * pay for tokens; the daily intel job warms the cache via warmInsightCache).
 * Returns null when no fresh (fingerprint-matching) summary exists.
 * Stage B: accepts a precomputed fingerprint to avoid re-running the
 * aggregate queries when the caller already has one (the dashboard needs
 * both the summary and the health narrative per page view).
 */
export async function getCachedQuarterlySummary(
  businessId: string,
  fingerprint?: string
): Promise<QuarterlySummary | null> {
  const fp = fingerprint ?? (await dataFingerprint(businessId));
  const cached = await prisma.businessInsight.findFirst({
    where: { businessId, kind: "QUARTERLY_SUMMARY", fingerprint: fp },
    orderBy: { createdAt: "desc" },
  });
  if (!cached) return null;
  const parsed = quarterlySummarySchema.safeParse(cached.payload);
  return parsed.success ? parsed.data : null;
}

/**
 * Cache-only health narrative read. The fingerprint embeds score + delta,
 * so a changed score invalidates the old explanation automatically.
 * Stage B: accepts a precomputed base fingerprint (see above).
 */
export async function getCachedHealthNarrative(
  businessId: string,
  score: number,
  delta: number | null,
  baseFingerprint?: string
): Promise<HealthNarrative | null> {
  const base = baseFingerprint ?? (await dataFingerprint(businessId));
  const fingerprint = `${base}:${score}:${delta ?? 0}`;
  const cached = await prisma.businessInsight.findFirst({
    where: { businessId, kind: "HEALTH_EXPLAIN", fingerprint },
    orderBy: { createdAt: "desc" },
  });
  if (!cached) return null;
  const parsed = healthNarrativeSchema.safeParse(cached.payload);
  return parsed.success ? parsed.data : null;
}

/**
 * Warm both caches (called by the refresh-reputation job after the
 * deterministic refresh). Best-effort: failures are swallowed — the
 * deterministic layer always stands on its own.
 */
export async function warmInsightCache(
  orgId: string,
  businessId: string,
  score: ScoreResult,
  delta: number | null,
  locale: string
): Promise<void> {
  try {
    await getQuarterlySummary(orgId, businessId, locale);
  } catch {
    /* deterministic layer only */
  }
  try {
    await getHealthNarrative(orgId, businessId, score, delta, locale);
  } catch {
    /* deterministic layer only */
  }
}

export async function getHealthNarrative(
  orgId: string,
  businessId: string,
  score: ScoreResult,
  delta: number | null,
  locale: string
): Promise<HealthNarrative | null> {
  // One-sentence explanation of the health score / its change, built from
  // the deterministic breakdown only. Cached like the summary.
  const fingerprint = `${await dataFingerprint(businessId)}:${score.score}:${delta ?? 0}`;
  const cached = await prisma.businessInsight.findFirst({
    where: { businessId, kind: "HEALTH_EXPLAIN", fingerprint },
    orderBy: { createdAt: "desc" },
  });
  if (cached) {
    const parsed = healthNarrativeSchema.safeParse(cached.payload);
    if (parsed.success) return parsed.data;
  }

  const context = {
    score: score.score,
    changeVsPreviousDay: delta,
    confidence: score.confidence.level,
    inputs: score.inputsSummary,
    subscores: score.subscores.map((s) => ({ key: s.key, value: Math.round(s.value), input: s.input })),
  };
  const prompt = await getPrompt("health-explain", 1);
  try {
    const result = await completeObject({
      tier: "cheap",
      system: prompt.system,
      prompt: [
        "Explain the score using ONLY the data between the <data> tags.",
        `Language: ${locale === "en" ? "English" : "Greek (el)"}.`,
        "<data>",
        JSON.stringify(context, null, 1),
        "</data>",
      ].join("\n"),
      schema: healthNarrativeSchema,
      maxRetries: 1,
      timeoutMs: 15_000,
    });
    await prisma.businessInsight.create({
      data: {
        businessId,
        kind: "HEALTH_EXPLAIN",
        windowStart: new Date(Date.now() - 90 * 86_400_000),
        windowEnd: new Date(),
        fingerprint,
        payload: result.data as object,
        model: result.model,
        promptVersion: String(prompt.version),
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
      },
    });
    await recordUsage(orgId, "report", result);
    return result.data;
  } catch {
    return null;
  }
}
