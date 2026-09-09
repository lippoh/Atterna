// tests/unit/reputation-score.test.ts — the deterministic Health Score (§41)
// The LLM never computes this; the formula is documented in score.ts.
import { describe, expect, it } from "vitest";
import { computeReputationScore, type ScoreInput } from "@/lib/reputation/score";

const NOW = new Date("2026-09-09T12:00:00Z");

function baseInput(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    now: NOW,
    avgRating12m: 4.6,
    avgRatingAllTime: 4.4,
    avgRating90d: 4.7,
    avgRatingPrev90d: 4.5,
    responseRate90d: 0.92,
    responseRateAllTime: 0.8,
    sentiment90d: { positive: 60, neutral: 20, negative: 8 },
    analyzed90d: 88,
    openIssues: [],
    reviews30d: 12,
    reviews90d: 40,
    avgMonthlyAllTime: 11,
    benchmark: null,
    ...overrides,
  };
}

describe("computeReputationScore", () => {
  it("scores a healthy business high", () => {
    const result = computeReputationScore(baseInput());
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.confidence.level).toBe("solid");
    expect(result.inputsSummary.openIssues).toBe(0);
  });

  it("never leaves the 0-100 range on extreme inputs", () => {
    const terrible = computeReputationScore(
      baseInput({
        avgRating12m: 1,
        avgRatingAllTime: 1,
        avgRating90d: 1,
        avgRatingPrev90d: 3,
        responseRate90d: 0,
        sentiment90d: { positive: 0, neutral: 2, negative: 48 },
        analyzed90d: 50,
        openIssues: [
          { category: "waiting_time", kind: "RECURRING", severity: "HIGH" },
          { category: "service", kind: "RECURRING", severity: "HIGH" },
          { category: "cleanliness", kind: "EMERGING", severity: "HIGH" },
          { category: "prices", kind: "RECURRING", severity: "MEDIUM" },
        ],
        reviews30d: 0,
        reviews90d: 3,
        benchmark: { competitorAvgRating: 4.8, ownRating: 1 },
      })
    );
    expect(terrible.score).toBeGreaterThanOrEqual(0);
    expect(terrible.score).toBeLessThanOrEqual(100);
    expect(terrible.score).toBeLessThan(40);
    expect(terrible.confidence.level).toBe("building"); // 3 reviews in 90d
  });

  it("weights rating at 30 and sums weights to 100", () => {
    const result = computeReputationScore(baseInput());
    const rating = result.subscores.find((s) => s.key === "rating");
    expect(rating?.weight).toBe(30);
    const total = result.subscores.reduce((sum, s) => sum + s.weight, 0);
    expect(total).toBe(100);
  });

  it("trend subscore rises with a rising 90d rating", () => {
    const rising = computeReputationScore(baseInput({ avgRating90d: 4.9, avgRatingPrev90d: 4.1 }));
    const falling = computeReputationScore(baseInput({ avgRating90d: 4.1, avgRatingPrev90d: 4.9 }));
    const risingTrend = rising.subscores.find((s) => s.key === "trend")!.value;
    const fallingTrend = falling.subscores.find((s) => s.key === "trend")!.value;
    expect(risingTrend).toBeGreaterThan(fallingTrend);
  });

  it("penalizes open issues, capped at 45 points", () => {
    const clean = computeReputationScore(baseInput()).subscores.find((s) => s.key === "issues")!.value;
    const messy = computeReputationScore(
      baseInput({
        openIssues: [
          { category: "a", kind: "RECURRING", severity: "HIGH" },
          { category: "b", kind: "RECURRING", severity: "HIGH" },
          { category: "c", kind: "EMERGING", severity: "MEDIUM" },
          { category: "d", kind: "RECURRING", severity: "HIGH" },
          { category: "e", kind: "RECURRING", severity: "HIGH" },
        ],
      })
    ).subscores.find((s) => s.key === "issues")!.value;
    expect(clean).toBe(100);
    expect(clean - messy).toBe(45); // 12+12+7+12+12=55 → capped at 45
  });

  it("applies a competitor adjustment only with benchmark data, capped ±5", () => {
    const above = computeReputationScore(baseInput({ benchmark: { competitorAvgRating: 4.0, ownRating: 4.6 } }));
    const below = computeReputationScore(baseInput({ benchmark: { competitorAvgRating: 4.9, ownRating: 4.6 } }));
    const none = computeReputationScore(baseInput({ benchmark: null }));
    expect(above.competitorAdjustment).toBe(5); // 0.6*10=6 → cap 5
    expect(below.competitorAdjustment).toBe(-3);
    expect(none.competitorAdjustment).toBeNull();
  });

  it("keeps a thin-data month useful (never 'not enough data', §14)", () => {
    const result = computeReputationScore(
      baseInput({
        reviews30d: 1,
        reviews90d: 2,
        analyzed90d: 2,
        sentiment90d: { positive: 2, neutral: 0, negative: 0 },
        responseRate90d: null,
        responseRateAllTime: 0.9,
      })
    );
    expect(result.score).toBeGreaterThan(0);
    expect(result.confidence.level).toBe("thin"); // annotated, not shrunk
  });

  it("is stable: same inputs → same score", () => {
    const input = baseInput();
    expect(computeReputationScore(input).score).toBe(computeReputationScore(baseInput()).score);
  });
});
