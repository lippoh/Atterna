// src/lib/metrics.ts — the single source of every number
// V2 fixes vs the V1 listing: the helpers shareBy / topCategory /
// bucketByDay referenced by V1 are now defined and exported; the return
// object gains the three fields the dashboard page actually reads
// (complaintTrend, topComplaintLabel, topComplimentLabel); JSON columns
// are cast through typed views; getInsights() — promised by Section 26 —
// is implemented with the Section 15 evidence thresholds.
import { prisma } from "@/lib/db";
import type { Prisma, Sentiment } from "@prisma/client";
export interface TrendPoint {
  date: string; // YYYY-MM-DD
  value: number | null; // average rating that day (null = no reviews)
}
export interface DashboardMetrics {
  rating: number;
  reviewCount: number;
  velocity: number; // reviews in the last 30 days
  unanswered: number; // reviews without a published reply
  responseRate: number; // replied / total, rolling 90d
  sentimentShare: { positive: number; neutral: number; negative: number };
  topComplaint: string | null;
  topCompliment: string | null;
  topComplaintLabel: string;
  topComplimentLabel: string;
  complaintTrend: number; // complaint mentions, last 7d minus prior 7d
  rating30d: TrendPoint[]; // for TrendChart
}
export interface Insight {
  key: string;
  severity: "info" | "warning" | "critical";
  title: string;
  evidence: string;
  confidence: "high" | "medium" | "low";
  suggestedAction: string;
}
const DAY_MS = 86_400_000;
// ── Localized labels for the closed category vocabulary (ai/schemas.ts) ──
const CATEGORY_LABELS: Record<string, { el: string; en: string }> = {
  waiting_time: { el: "Χρόνος αναμονής", en: "Waiting time" },
  service: { el: "Εξυπηρέτηση", en: "Service" },
  food_quality: { el: "Ποιότητα φαγητού", en: "Food quality" },
  prices: { el: "Τιμές", en: "Prices" },
  cleanliness: { el: "Καθαριότητα", en: "Cleanliness" },
  atmosphere: { el: "Ατμόσφαιρα", en: "Atmosphere" },
  location: { el: "Τοποθεσία", en: "Location" },
  staff: { el: "Προσωπικό", en: "Staff" },
  parking: { el: "Πάρκινγκ", en: "Parking" },
  noise: { el: "Θόρυβος", en: "Noise" },
  booking: { el: "Κράτηση", en: "Booking" },
  rooms: { el: "Δωμάτια", en: "Rooms" },
  value: { el: "Αξία για τα χρήματα", en: "Value for money" },
  equipment: { el: "Εξοπλισμός", en: "Equipment" },
  safety: { el: "Ασφάλεια", en: "Safety" },
  other: { el: "Άλλο", en: "Other" },
};
export function categoryLabel(category: string | null | undefined, locale = "el"): string {
  if (!category) return "—";
  const label = CATEGORY_LABELS[category];
  if (!label) return category;
  return locale === "en" ? label.en : label.el;
}
// ── Pure helpers (unit-tested in tests/unit/metrics.test.ts) ─────────────
export function shareBy(
  sentiments: Sentiment[]
): { positive: number; neutral: number; negative: number } {
  if (sentiments.length === 0) return { positive: 0, neutral: 0, negative: 0 };
  const share = (s: Sentiment) =>
    Math.round((sentiments.filter((x) => x === s).length / sentiments.length) * 100) / 100;
  return { positive: share("POSITIVE"), neutral: share("NEUTRAL"), negative: share("NEGATIVE") };
}
export function topCategory(items: { category: string }[]): string | null {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [category, count] of counts) {
    if (count > bestCount) {
      best = category;
      bestCount = count;
    }
  }
  return best;
}
export function bucketByDay(
  reviews: { rating: number; receivedAt: Date }[],
  days: number
): TrendPoint[] {
  const points: TrendPoint[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(now.getTime() - i * DAY_MS);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);
    const sameDay = reviews.filter(
      (r) => r.receivedAt >= dayStart && r.receivedAt < dayEnd
    );
    const key = `${dayStart.getFullYear()}-${String(dayStart.getMonth() + 1).padStart(2,
    "0")}-${String(dayStart.getDate()).padStart(2, "0")}`;
    points.push({
      date: key,
      value: sameDay.length
        ? Math.round((sameDay.reduce((sum, r) => sum + r.rating, 0) / sameDay.length) * 10) / 10
        : null,
    });
  }
  return points;
}
// ── Typed view over the JSON columns written by ai/analyze.ts ────────────
interface ComplaintItem {
  category: string;
  severity: number;
  summary: string;
}
interface ComplimentItem {
  category: string;
  summary: string;
}
interface AnalysisView {
  sentiment: Sentiment;
  complaints: Prisma.JsonValue;
  compliments: Prisma.JsonValue;
  review: { receivedAt: Date };
}
function asItems(json: Prisma.JsonValue): { category: string }[] {
  if (Array.isArray(json)) {
    return json.filter(
      (item): item is { category: string } =>
        typeof item === "object" && item !== null && "category" in item
    );
  }
  return [];
}
// ── Dashboard aggregates (Table 15.1 formulas) ────────────────────────────
export async function getDashboardMetrics(
  orgId: string,
  businessId?: string,
  locale = "el"
): Promise<DashboardMetrics> {
  const scope = {
    organizationId: orgId,
    ...(businessId ? { businessId } : {}),
  };
  const since30 = new Date(Date.now() - 30 * DAY_MS);
  const since90 = new Date(Date.now() - 90 * DAY_MS);
  const [total, recent, analyses, replied] = await Promise.all([
    prisma.review.aggregate({
      where: { ...scope, deletedAt: null },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.review.findMany({
      where: { ...scope, receivedAt: { gte: since30 }, deletedAt: null },
      select: { rating: true, receivedAt: true },
    }),
    prisma.reviewAnalysis.findMany({
      where: { review: { ...scope, receivedAt: { gte: since30 } } },
      select: {
        sentiment: true,
        complaints: true,
        compliments: true,
        review: { select: { receivedAt: true } },
      },
    }),
    prisma.review.count({
      where: { ...scope, deletedAt: null, repliedAt: { not: null } },
    }),
  ]);
  const answered90 = await prisma.review.count({
    where: { ...scope, receivedAt: { gte: since90 }, deletedAt: null, repliedAt: { not: null } },
  });
  const total90 = await prisma.review.count({
    where: { ...scope, receivedAt: { gte: since90 }, deletedAt: null },
  });
  const analysisViews = analyses as AnalysisView[];
  const complaintItems = analysisViews.flatMap((a) =>
    asItems(a.complaints).map((c) => ({ ...c, receivedAt: a.review.receivedAt }))
  );
  const complaintTrend = complaintItems.filter((c) => c.receivedAt >= new Date(Date.now() - 7 *
    DAY_MS)).length 
    complaintItems.filter(
      (c) => c.receivedAt >= new Date(Date.now() - 14 * DAY_MS) && c.receivedAt < new Date
    (Date.now() - 7 * DAY_MS)
    ).length;
  const topComplaint = topCategory(analysisViews.flatMap((a) => asItems(a.complaints)));
  const topCompliment = topCategory(analysisViews.flatMap((a) => asItems(a.compliments)));
  return {
    rating: Math.round((total._avg.rating ?? 0) * 10) / 10,
    reviewCount: total._count._all,
    velocity: recent.length,
    unanswered: Math.max(0, total._count._all - replied),
    responseRate: total90 ? answered90 / total90 : 1,
    sentimentShare: shareBy(analysisViews.map((a) => a.sentiment)),
    topComplaint,
    topCompliment,
    topComplaintLabel: categoryLabel(topComplaint, locale),
    topComplimentLabel: categoryLabel(topCompliment, locale),
    complaintTrend,
    rating30d: bucketByDay(recent, 30),
  };
}
// ── Insights (What happened · Why it matters · What to do) ───────────────
const PLAYBOOK: Record<string, { el: string; en: string }> = {
  waiting_time: {
    el: "Μετρήστε τους χρόνους αιχμής και προγραμματίστε προσωπικό για τις 2 πιο δυνατές ώρες.",
    en: "Measure peak-hour wait times and staff the two busiest hours deliberately.",
  },
  service: {
    el: "Σύντομη καθημερινή συζήτηση 5' με το προσωπικό για τα σημερινά προβλήματα εξυπηρέτησης.",
    en: "Hold a 5-minute daily staff huddle on today's service issues.",
  },
  food_quality: {
    el: "Ελέγξτε την πρώτη ύλη και τη συνέπεια της κουζίνας για τα συνηθισμένα παράπονα.",
    en: "Audit ingredients and kitchen consistency against the recurring complaints.",
  },
  prices: {
    el: "Συγκρίντε τιμοκατάλογο και μερίδες με τους τρεις κοντινούς ανταγωνιστές.",
    en: "Compare menu prices and portions against the three nearby competitors.",
  },
  cleanliness: {
    el: "Προσθέστε έλεγχο καθαριότητας με λίστα ελέγχου στο κλείσιμο κάθε βάρδιας.",
    en: "Add a closing-shift cleaning checklist with a sign-off.",
  },
  atmosphere: {
    el: "Ζητήστε από κάποιον εκτός επιχείρησης να καθίσει ως πελάτης και να σημειώσει την ατμόσφαιρα.",
    en: "Ask someone outside the business to sit as a guest and note the atmosphere.",
  },
  staff: {
    el: "Επιλέξτε ένα μέλος του προσωπικού ως «πρεσβευτή πελάτη» της εβδομάδας με ανταμοιβή.",
    en: "Nominate a weekly 'guest champion' staff member with a small reward.",
  },
  other: {
    el: "Διαβάστε 3-4 πρόσφατες κριτικές της κατηγορίας και αποφασίστε μια αλλαγή.",
    en: "Read 3-4 recent reviews in this category and decide one change.",
  },
};
function playbookFor(category: string, locale: string): string {
  const entry = PLAYBOOK[category] ?? PLAYBOOK.other;
  return locale === "en" ? entry.en : entry.el;
}
function confidenceFor(mentions: number): "high" | "medium" | "low" {
  if (mentions >= 20) return "high";
  if (mentions >= 10) return "medium";
  return "low";
}
export async function getInsights(
  orgId: string,
  businessId?: string,
  opts: { window?: "7d" | "30d"; locale?: string } = {}
): Promise<Insight[]> {
  const locale = opts.locale ?? "el";
  const window = opts.window ?? "30d";
  const since = new Date(Date.now() - (window === "7d" ? 7 : 30) * DAY_MS);
  const scope = { organizationId: orgId, ...(businessId ? { businessId } : {}) };
  const [analyses, reviewStats, negativeCount] = await Promise.all([
    prisma.reviewAnalysis.findMany({
      where: { review: { ...scope, receivedAt: { gte: since }, deletedAt: null } },
      select: {
        complaints: true,
        compliments: true,
        review: { select: { receivedAt: true } },
      },
    }),
    prisma.review.aggregate({
      where: { ...scope, deletedAt: null },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.review.count({
      where: { ...scope, receivedAt: { gte: since }, deletedAt: null, rating: { lte: 3 } },
    }),
  ]);
  const analysisViews = analyses as AnalysisView[];
  const insights: Insight[] = [];
  // 1. Top complaint — only when evidence clears the threshold (>= 5 mentions)
  const complaintCounts = new Map<string, number>();
  for (const a of analysisViews) {
    for (const item of asItems(a.complaints)) {
      complaintCounts.set(item.category, (complaintCounts.get(item.category) ?? 0) + 1);
    }
  }
  let topCategoryKey: string | null = null;
  let topCategoryCount = 0;
  for (const [category, count] of complaintCounts) {
    if (count > topCategoryCount) {
      topCategoryKey = category;
      topCategoryCount = count;
    }
  }
  if (topCategoryKey && topCategoryCount >= 5) {
    const label = categoryLabel(topCategoryKey, locale);
    const share = Math.round((topCategoryCount / Math.max(1, negativeCount)) * 100);
    insights.push({
      key: "top-complaint",
      severity: share >= 40 ? "critical" : share >= 25 ? "warning" : "info",
      title:
        locale === "en"
          ? `Top complaint: ${label}`
          : `Κύριο παράπονο: ${label}`,
      evidence:
        locale === "en"
          ? `${topCategoryCount} of ${negativeCount} negative reviews in the last ${window}
    mention ${label.toLowerCase()}.`
          : `${topCategoryCount} από ${negativeCount} αρνητικές κριτικές τις τελευταίες ${window
    === "7d" ? "7" : "30"} ημέρες αναφέρουν ${label.toLowerCase()}.`,
      confidence: confidenceFor(topCategoryCount),
      suggestedAction: playbookFor(topCategoryKey, locale),
    });
  }
  // 2. Emerging problem — >50% growth week-over-week with >= 5 mentions
  const now = Date.now();
  const current = new Map<string, number>();
  const prior = new Map<string, number>();
  for (const a of analysisViews) {
    for (const item of asItems(a.complaints)) {
      if (a.review.receivedAt >= new Date(now - 7 * DAY_MS)) {
        current.set(item.category, (current.get(item.category) ?? 0) + 1);
      } else {
        prior.set(item.category, (prior.get(item.category) ?? 0) + 1);
      }
    }
  }
  for (const [category, count] of current) {
    const before = prior.get(category) ?? 0;
    if (count >= 5 && before > 0 && count > before * 1.5) {
      insights.push({
        key: `emerging-${category}`,
        severity: "warning",
        title:
          locale === "en"
            ? `Emerging problem: ${categoryLabel(category, "en")}`
            : `Νεοεμφανιζόμενο πρόβλημα: ${categoryLabel(category)}`,
        evidence:
          locale === "en"
            ? `Mentions grew from ${before} to ${count} week-over-week (+${Math.round(((count - before) / before) * 100)}%).`
            : `Οι αναφορές αυξήθηκαν από ${before} σε ${count} σε σχέση με την προηγούμενη εβδομάδα (+${Math.round(((count - before) / before) * 100)}%).`,
        confidence: "medium",
        suggestedAction: playbookFor(category, locale),
      });
    }
  }
  // 3. Unanswered backlog — digest line when > 5 (Table 32.1)
  const unanswered = Math.max(
    0,
    reviewStats._count._all -
      (await prisma.review.count({
        where: { ...scope, deletedAt: null, repliedAt: { not: null } },
      }))
  );
  if (unanswered > 5) {
    insights.push({
      key: "unanswered-backlog",
      severity: unanswered > 15 ? "warning" : "info",
      title: locale === "en" ? "Unanswered reviews" : "Κριτικές χωρίς απάντηση",
      evidence:
        locale === "en"
          ? `${unanswered} reviews are still waiting for a reply.`
          : `${unanswered} κριτικές περιμένουν ακόμα απάντηση.`,
      confidence: "high",
      suggestedAction:
        locale === "en"
          ? "Answer the oldest negative review first — visible effort matters to future guests."
          : "Απαντήστε πρώτα στην παλαιότερη αρνητική κριτική — η προσπάθεια φαίνεται στους μελλοντικούς πελάτες.",
    });
  }
  // 4. Top compliment — positive reinforcement
  const complimentCounts = new Map<string, number>();
  for (const a of analysisViews) {
    for (const item of asItems(a.compliments)) {
      complimentCounts.set(item.category, (complimentCounts.get(item.category) ?? 0) + 1);
    }
  }
  let topComplimentKey: string | null = null;
  let topComplimentCount = 0;
  for (const [category, count] of complimentCounts) {
    if (count > topComplimentCount) {
      topComplimentKey = category;
      topComplimentCount = count;
    }
  }
  if (topComplimentKey && topComplimentCount >= 5) {
    insights.push({
      key: "top-compliment",
      severity: "info",
      title:
        locale === "en"
          ? `Guests love: ${categoryLabel(topComplimentKey, "en")}`
          : `Τι ξεχωρίζουν οι πελάτες: ${categoryLabel(topComplimentKey)}`,
      evidence:
        locale === "en"
          ? `${topComplimentCount} positive reviews mention ${categoryLabel(topComplimentKey, "en").toLowerCase()} this window.`
          : `${topComplimentCount} θετικές κριτικές αναφέρουν ${categoryLabel(topComplimentKey).toLowerCase()} αυτό το διάστημα.`,
      confidence: confidenceFor(topComplimentCount),
      suggestedAction:
        locale === "en"
          ? "Say it out loud: put this strength in your Google Business description and reply templates."
          : "Πείτε το δυνατά: βάλτε αυτό το πλεονέκτημα στην περιγραφή του προφίλ σας Google και στις απαντήσεις.",
    });
  }
  return insights;
}