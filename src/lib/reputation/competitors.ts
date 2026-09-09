// src/lib/reputation/competitors.ts — competitor benchmarking (spec §21, §22)
// The owner is the authority: competitors are added manually (or confirmed
// from suggestions). We NEVER fabricate stats — nullable ratings mean "not
// provided", and the UI hides the benchmark when there is no data.
import { prisma } from "@/lib/db";

export interface CompetitorRow {
  id: string;
  name: string;
  city: string | null;
  rating: number | null;
  reviewCount: number | null;
  status: string;
  suggestedReason: string | null;
}

export interface Benchmark {
  confirmedCount: number;
  ratedCount: number;
  competitorAvgRating: number | null;
  position: number | null; // 1-based among rated (own + competitors)
  totalRated: number | null;
  ownRating: number | null;
  ratingGap: number | null; // own − competitor average
  aheadOf: number;
  behindOf: number;
}

/** Pure benchmark math — unit-tested, no DB. */
export function computeBenchmark(
  ownRating: number | null,
  competitors: { name: string; rating: number | null; status: string }[]
): Benchmark {
  const confirmed = competitors.filter((c) => c.status === "CONFIRMED");
  const rated = confirmed.filter(
    (c): c is { name: string; rating: number; status: string } => c.rating !== null
  );
  const competitorAvgRating = rated.length
    ? Math.round((rated.reduce((s, c) => s + c.rating, 0) / rated.length) * 10) / 10
    : null;

  if (ownRating === null || rated.length === 0) {
    return {
      confirmedCount: confirmed.length,
      ratedCount: rated.length,
      competitorAvgRating,
      position: null,
      totalRated: null,
      ownRating,
      ratingGap: null,
      aheadOf: 0,
      behindOf: 0,
    };
  }

  // Rank 1 = highest rating; own position among all rated businesses.
  const all = [...rated.map((c) => c.rating), ownRating].sort((a, b) => b - a);
  const position = all.findIndex((v) => v === ownRating) + 1;
  // Ties share the better rank; behind/ahead counts ignore ties.
  const behindOf = rated.filter((c) => c.rating < ownRating).length;
  const aheadOf = rated.filter((c) => c.rating > ownRating).length;

  return {
    confirmedCount: confirmed.length,
    ratedCount: rated.length,
    competitorAvgRating,
    position,
    totalRated: all.length,
    ownRating,
    ratingGap:
      competitorAvgRating === null
        ? null
        : Math.round((ownRating - competitorAvgRating) * 10) / 10,
    aheadOf,
    behindOf,
  };
}

export async function getCompetitors(businessId: string): Promise<CompetitorRow[]> {
  return prisma.competitor.findMany({
    where: { businessId, status: { in: ["CONFIRMED", "SUGGESTED"] } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      city: true,
      rating: true,
      reviewCount: true,
      status: true,
      suggestedReason: true,
    },
  });
}

export async function getBenchmark(
  orgId: string,
  businessId: string
): Promise<Benchmark> {
  const [competitors, agg] = await Promise.all([
    prisma.competitor.findMany({
      where: { businessId },
      select: { name: true, rating: true, status: true },
    }),
    prisma.review.aggregate({
      where: { organizationId: orgId, businessId, deletedAt: null },
      _avg: { rating: true },
    }),
  ]);
  const ownRating =
    agg._avg.rating === null ? null : Math.round(agg._avg.rating * 10) / 10;
  return computeBenchmark(ownRating, competitors);
}
