// tests/unit/sources-and-benchmarks.test.ts — registry + competitor math +
// seasonal aggregation (§41: provider abstraction, benchmark, seasonality)
import { describe, expect, it } from "vitest";
import {
  normalizeSourceKey,
  sourceLabel,
  isKnownSource,
  SOURCES,
  AVAILABLE_SOURCES,
  COMING_SOON_SOURCES,
} from "@/lib/sources/registry";
import { computeBenchmark } from "@/lib/reputation/competitors";
import { seasonOf, aggregateSeason, yearOverYear } from "@/lib/reputation/seasonal";
import type { MonthBucket } from "@/lib/reputation/analytics";

describe("source registry", () => {
  it("normalizes legacy and alias forms", () => {
    expect(normalizeSourceKey("GOOGLE")).toBe("google");
    expect(normalizeSourceKey("Google Business Profile")).toBe("google");
    expect(normalizeSourceKey("Booking.com")).toBe("booking");
    expect(normalizeSourceKey("QR Feedback")).toBe("qr_feedback");
    expect(normalizeSourceKey("")).toBeNull();
    expect(normalizeSourceKey("myspace")).toBeNull();
  });

  it("labels unknown sources gracefully", () => {
    expect(sourceLabel("GOOGLE", "en")).toBe("Google");
    expect(sourceLabel("weird", "el")).toBe("weird");
    expect(sourceLabel(null, "en")).toBe("—");
  });

  it("capabilities are honest: CSV cannot reply, Google can", () => {
    expect(SOURCES.csv.capabilities.reply).toBe(false);
    expect(SOURCES.csv.capabilities.import).toBe(true);
    expect(SOURCES.google.capabilities.reply).toBe(true);
    expect(SOURCES.google.capabilities.sync).toBe(true);
    expect(SOURCES.qr_feedback.capabilities.sync).toBe(false);
  });

  it("splits availability lists", () => {
    expect(AVAILABLE_SOURCES).toContain("google");
    expect(AVAILABLE_SOURCES).toContain("csv");
    expect(COMING_SOON_SOURCES).toContain("tripadvisor");
    expect(COMING_SOON_SOURCES).toContain("booking");
    expect(isKnownSource("yelp")).toBe(true);
  });
});

describe("computeBenchmark", () => {
  it("ranks the business among rated competitors (1 = best)", () => {
    const benchmark = computeBenchmark(4.6, [
      { name: "A", rating: 4.8, status: "CONFIRMED" },
      { name: "B", rating: 4.4, status: "CONFIRMED" },
      { name: "C", rating: 4.2, status: "CONFIRMED" },
    ]);
    expect(benchmark.position).toBe(2);
    expect(benchmark.totalRated).toBe(4);
    expect(benchmark.competitorAvgRating).toBe(4.5);
    expect(benchmark.ratingGap).toBe(0.1);
    expect(benchmark.behindOf).toBe(2);
    expect(benchmark.aheadOf).toBe(1);
  });

  it("never invents a benchmark without data (§22)", () => {
    const noData = computeBenchmark(null, [{ name: "A", rating: null, status: "CONFIRMED" }]);
    expect(noData.position).toBeNull();
    expect(noData.competitorAvgRating).toBeNull();
    expect(noData.ratingGap).toBeNull();
    const noCompetitors = computeBenchmark(4.5, []);
    expect(noCompetitors.position).toBeNull();
  });

  it("ignores dismissed/suggested competitors", () => {
    const benchmark = computeBenchmark(4.5, [
      { name: "A", rating: 4.9, status: "DISMISSED" },
      { name: "B", rating: 4.0, status: "SUGGESTED" },
    ]);
    expect(benchmark.confirmedCount).toBe(0);
    expect(benchmark.position).toBeNull();
  });

  it("ties share the better rank", () => {
    const benchmark = computeBenchmark(4.5, [{ name: "A", rating: 4.5, status: "CONFIRMED" }]);
    expect(benchmark.position).toBe(1);
    expect(benchmark.aheadOf).toBe(0);
    expect(benchmark.behindOf).toBe(0);
  });
});

describe("seasonal intelligence", () => {
  const buckets: MonthBucket[] = [
    { month: "2026-06", count: 30, avgRating: 4.7, negative: 4, answered: 20 },
    { month: "2026-07", count: 42, avgRating: 4.8, negative: 3, answered: 30 },
    { month: "2026-08", count: 38, avgRating: 4.6, negative: 5, answered: 28 },
    { month: "2025-06", count: 22, avgRating: 4.5, negative: 4, answered: 15 },
    { month: "2025-07", count: 30, avgRating: 4.6, negative: 4, answered: 20 },
    { month: "2025-08", count: 26, avgRating: 4.4, negative: 5, answered: 17 },
  ];

  it("maps months to Greek tourism seasons", () => {
    expect(seasonOf(7)).toBe("HIGH");
    expect(seasonOf(1)).toBe("LOW");
    expect(seasonOf(4)).toBe("SHOULDER");
    expect(seasonOf(10)).toBe("SHOULDER");
  });

  it("aggregates a season with volume-weighted average", () => {
    const summer2026 = aggregateSeason(buckets, "HIGH", 2026);
    expect(summer2026?.count).toBe(110);
    expect(summer2026?.avgRating).toBeCloseTo(4.7, 1);
  });

  it("returns null for an unobserved season (never a fake 0)", () => {
    expect(aggregateSeason(buckets, "LOW", 2026)).toBeNull();
  });

  it("computes year-over-year deltas", () => {
    const current = aggregateSeason(buckets, "HIGH", 2026);
    const previous = aggregateSeason(buckets, "HIGH", 2025);
    const deltas = yearOverYear(current, previous);
    expect(deltas?.volumeDeltaPct).toBeGreaterThan(0);
    expect(deltas?.ratingDelta).not.toBeNull();
  });
});
