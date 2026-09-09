// src/lib/reputation/seasonal.ts — seasonal + year-over-year intelligence
// (spec §23). Greek tourism rhythm: HIGH Jun–Aug, SHOULDER Mar–May +
// Sep–Nov, LOW Dec–Feb. The off-season is an improvement/planning period,
// never a reason the product looks dead.
import type { MonthBucket } from "./analytics";
import type { ThemeStat } from "./themes";

export type Season = "HIGH" | "SHOULDER" | "LOW";

export function seasonOf(month: number): Season {
  // month: 1-12
  if (month >= 6 && month <= 8) return "HIGH";
  if (month >= 3 && month <= 5) return "SHOULDER";
  if (month >= 9 && month <= 11) return "SHOULDER";
  return "LOW";
}

export function seasonLabel(season: Season, locale: string): string {
  const labels: Record<Season, { el: string; en: string }> = {
    HIGH: { el: "Κορύφωση", en: "High season" },
    SHOULDER: { el: "Ωμλή περίοδος", en: "Shoulder season" },
    LOW: { el: "Χαμηλή περίοδος", en: "Off-season" },
  };
  return locale === "en" ? labels[season].en : labels[season].el;
}

export interface SeasonStats {
  season: Season;
  year: number;
  months: string[]; // YYYY-MM keys included
  count: number;
  avgRating: number | null;
  negative: number;
}

/** Aggregate a season from monthly buckets (pure — unit-tested). */
export function aggregateSeason(
  buckets: MonthBucket[],
  season: Season,
  year: number
): SeasonStats | null {
  const months: number[] =
    season === "HIGH"
      ? [6, 7, 8]
      : season === "SHOULDER"
        ? [3, 4, 5, 9, 10, 11]
        : [12, 1, 2];
  const keys = months.map((m) => `${year}-${String(m).padStart(2, "0")}`);
  const rows = buckets.filter((b) => keys.includes(b.month));
  // A season counts as observed only when at least one of its months has
  // data (a fully empty season stays null — never a fake 0★).
  if (rows.length === 0 || rows.every((r) => r.count === 0)) return null;
  const count = rows.reduce((s, r) => s + r.count, 0);
  const rated = rows.filter((r) => r.avgRating !== null);
  return {
    season,
    year,
    months: rows.map((r) => r.month),
    count,
    avgRating: count
      ? Math.round(
          (rows.reduce((s, r) => s + (r.avgRating ?? 0) * r.count, 0) / count) * 10
        ) / 10
      : null,
    negative: rows.reduce((s, r) => s + r.negative, 0),
  };
}

export interface SeasonDeltas {
  ratingDelta: number | null;
  volumeDeltaPct: number | null;
}

export function yearOverYear(
  current: SeasonStats | null,
  previous: SeasonStats | null
): SeasonDeltas | null {
  if (!current || !previous || previous.count === 0) return null;
  return {
    ratingDelta:
      current.avgRating !== null && previous.avgRating !== null
        ? Math.round((current.avgRating - previous.avgRating) * 10) / 10
        : null,
    volumeDeltaPct: Math.round(((current.count - previous.count) / previous.count) * 100),
  };
}

export interface SeasonalComparison {
  current: SeasonStats | null;
  previous: SeasonStats | null; // same season last year
  deltas: SeasonDeltas | null;
  offSeason: boolean; // true when the current season is LOW
  /** The persistent issue to fix before next high season (off-season plan). */
  offSeasonIssue: { category: string; labelEl: string; labelEn: string } | null;
}

export function buildSeasonalComparison(
  buckets: MonthBucket[],
  themeStats: ThemeStat[],
  now = new Date()
): SeasonalComparison {
  const currentSeason = seasonOf(now.getUTCMonth() + 1);
  const year = now.getUTCFullYear();
  const currentYearStats = aggregateSeason(buckets, currentSeason, year);
  // Same season last year: seasons spanning a year boundary (LOW: Dec–Feb)
  // straddle two years — take the months from the previous calendar year.
  const previous = aggregateSeason(buckets, currentSeason, year - 1)
    ?? aggregateSeason(buckets, currentSeason, year);
  const deltas = yearOverYear(currentYearStats, previous);

  const persistent = themeStats.find((t) => t.complaintMentions >= 6);
  return {
    current: currentYearStats,
    previous,
    deltas,
    offSeason: currentSeason === "LOW",
    offSeasonIssue: persistent
      ? {
          category: persistent.category,
          labelEl: persistent.labelEl,
          labelEn: persistent.labelEn,
        }
      : null,
  };
}
