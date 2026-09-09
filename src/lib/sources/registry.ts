// src/lib/sources/registry.ts — the controlled source/provider model (§4–§6)
// One registry to rule them all: capabilities, availability and localized
// labels for every customer-voice source. `Review.source` stays a string in
// the database (existing "GOOGLE" rows keep working); this registry is the
// single place that knows the closed list, so adding a provider later never
// touches domain logic. Nothing here is Google-specific.
export const REVIEW_SOURCES = [
  "google",
  "tripadvisor",
  "facebook",
  "booking",
  "expedia",
  "thefork",
  "yelp",
  "trustpilot",
  "manual",
  "csv",
  "qr_feedback",
  "direct_feedback",
] as const;

export type ReviewSource = (typeof REVIEW_SOURCES)[number];

export interface SourceCapability {
  /** Scheduled incremental sync is supported. */
  sync: boolean;
  /** Replying from inside Atterna is supported. */
  reply: boolean;
  /** Bulk import (CSV) is supported. */
  import: boolean;
  /** OAuth connection flow exists. */
  oauth: boolean;
}

export interface SourceMeta {
  key: ReviewSource;
  /** UI label, per locale. */
  label: { el: string; en: string };
  /** One-line description for the Data Sources page, per locale. */
  description: { el: string; en: string };
  availability: "AVAILABLE" | "COMING_SOON";
  capabilities: SourceCapability;
}

export const SOURCES: Record<ReviewSource, SourceMeta> = {
  google: {
    key: "google",
    label: { el: "Google", en: "Google" },
    description: {
      el: "Κριτικές Google Business Profile με αυτόματο συγχρονισμό και απαντήσεις.",
      en: "Google Business Profile reviews with automatic sync and replies.",
    },
    availability: "AVAILABLE",
    capabilities: { sync: true, reply: true, import: false, oauth: true },
  },
  csv: {
    key: "csv",
    label: { el: "Εισαγωγή CSV", en: "CSV import" },
    description: {
      el: "Εισάγετε ιστορικές κριτικές από οποιαδήποτε πλατφόρμα μέσω αρχείου CSV.",
      en: "Import historical reviews from any platform via a CSV file.",
    },
    availability: "AVAILABLE",
    capabilities: { sync: false, reply: false, import: true, oauth: false },
  },
  manual: {
    key: "manual",
    label: { el: "Χειροκίνητη καταχώρηση", en: "Manual entry" },
    description: {
      el: "Καταχώρηση κριτικών μία προς μία (μετανάστευση ή χωρίς πλατφόρμα).",
      en: "Enter reviews one by one (migration or platform-less businesses).",
    },
    availability: "AVAILABLE",
    capabilities: { sync: false, reply: false, import: true, oauth: false },
  },
  qr_feedback: {
    key: "qr_feedback",
    label: { el: "Atterna QR", en: "Atterna QR" },
    description: {
      el: "Ιδιωτικά σχόλια πελατών μέσω QR — πριν γίνουν δημόσιο πρόβλημα.",
      en: "Private customer feedback via QR — before it becomes a public problem.",
    },
    availability: "AVAILABLE",
    capabilities: { sync: false, reply: false, import: false, oauth: false },
  },
  direct_feedback: {
    key: "direct_feedback",
    label: { el: "Atterna φόρμα", en: "Atterna feedback" },
    description: {
      el: "Ιδιωτική φόρμα σχολίων Atterna.",
      en: "Atterna's private feedback form.",
    },
    availability: "AVAILABLE",
    capabilities: { sync: false, reply: false, import: false, oauth: false },
  },
  tripadvisor: {
    key: "tripadvisor",
    label: { el: "Tripadvisor", en: "Tripadvisor" },
    description: {
      el: "Κριτικές Tripadvisor.",
      en: "Tripadvisor reviews.",
    },
    availability: "COMING_SOON",
    capabilities: { sync: false, reply: false, import: false, oauth: false },
  },
  facebook: {
    key: "facebook",
    label: { el: "Facebook", en: "Facebook" },
    description: {
      el: "Συστάσεις και κριτικές Facebook.",
      en: "Facebook recommendations and reviews.",
    },
    availability: "COMING_SOON",
    capabilities: { sync: false, reply: false, import: false, oauth: false },
  },
  booking: {
    key: "booking",
    label: { el: "Booking.com", en: "Booking.com" },
    description: {
      el: "Βαθμολογίες διαμονής Booking.com (κλίμακα 1–10).",
      en: "Booking.com stay scores (1–10 scale).",
    },
    availability: "COMING_SOON",
    capabilities: { sync: false, reply: false, import: true, oauth: false },
  },
  expedia: {
    key: "expedia",
    label: { el: "Expedia", en: "Expedia" },
    description: {
      el: "Κριτικές Expedia.",
      en: "Expedia reviews.",
    },
    availability: "COMING_SOON",
    capabilities: { sync: false, reply: false, import: false, oauth: false },
  },
  thefork: {
    key: "thefork",
    label: { el: "TheFork", en: "TheFork" },
    description: {
      el: "Κριτικές TheFork για εστιατόρια.",
      en: "TheFork restaurant reviews.",
    },
    availability: "COMING_SOON",
    capabilities: { sync: false, reply: false, import: false, oauth: false },
  },
  yelp: {
    key: "yelp",
    label: { el: "Yelp", en: "Yelp" },
    description: {
      el: "Κριτικές Yelp.",
      en: "Yelp reviews.",
    },
    availability: "COMING_SOON",
    capabilities: { sync: false, reply: false, import: false, oauth: false },
  },
  trustpilot: {
    key: "trustpilot",
    label: { el: "Trustpilot", en: "Trustpilot" },
    description: {
      el: "Κριτικές Trustpilot.",
      en: "Trustpilot reviews.",
    },
    availability: "COMING_SOON",
    capabilities: { sync: false, reply: false, import: false, oauth: false },
  },
};

/** Sources the Data Sources page lists as connectable/importable today. */
export const AVAILABLE_SOURCES: ReviewSource[] = REVIEW_SOURCES.filter(
  (s) => SOURCES[s].availability === "AVAILABLE"
);

/** Sources shown as "coming soon" (honest availability, spec §38). */
export const COMING_SOON_SOURCES: ReviewSource[] = REVIEW_SOURCES.filter(
  (s) => SOURCES[s].availability === "COMING_SOON"
);

/**
 * Normalize anything the wild throws at us into a registry key.
 * Case-insensitive; accepts the legacy uppercase DB values ("GOOGLE"),
 * spaced forms ("Google Business Profile") and common aliases.
 * Returns null for unknown sources — callers decide whether that is a
 * row error (import validation) or a graceful label fallback (display).
 */
export function normalizeSourceKey(raw: string | null | undefined): ReviewSource | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase().replace(/[\s._-]+/g, "");
  if (REVIEW_SOURCES.includes(cleaned as ReviewSource)) return cleaned as ReviewSource;
  const ALIASES: Record<string, ReviewSource> = {
    googlebusinessprofile: "google",
    gbp: "google",
    googleplaces: "google",
    bookingcom: "booking",
    qrfeedback: "qr_feedback",
    directfeedback: "direct_feedback",
    atterna: "qr_feedback",
    atternafeedback: "qr_feedback",
    import: "csv",
    file: "csv",
  };
  return ALIASES[cleaned] ?? null;
}

/** True when the stored source string is a known registry key/legacy value. */
export function isKnownSource(raw: string | null | undefined): boolean {
  return normalizeSourceKey(raw) !== null;
}

/** Localized label for any stored source value (unknown → raw key). */
export function sourceLabel(raw: string | null | undefined, locale = "el"): string {
  const key = normalizeSourceKey(raw);
  if (!key) return raw ?? "—";
  const meta = SOURCES[key];
  return locale === "en" ? meta.label.en : meta.label.el;
}

/** Canonical DB value for a source (importers write the lowercase key). */
export function sourceValue(key: ReviewSource): string {
  return key;
}
