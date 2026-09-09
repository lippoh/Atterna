// src/integrations/csv/normalizer.ts — row validation + normalization (§10)
// Each CSV row becomes either a NormalizedRow (ready for the importer) or a
// RowError with a human-readable reason. Rating scales are normalized to
// 1–5 stars (Booking's 1–10 halves, documented), dates accept the formats
// real exports actually use (ISO + European), and the dedup fallback
// fingerprint makes re-importing the same file idempotent.
import { createHash } from "node:crypto";
import { normalizeSourceKey, type ReviewSource } from "@/lib/sources/registry";

export interface NormalizedRow {
  line: number; // 1-based line in the file (data rows)
  source: ReviewSource;
  externalId: string | null;
  rating: number; // 1-5 stars
  text: string | null;
  reviewerName: string | null;
  receivedAt: Date;
  replyText: string | null;
  sourceUrl: string | null;
}

export interface RowError {
  line: number;
  reason: string; // machine key — the UI maps it to localized copy
}

export type NormalizedRowResult =
  | { ok: true; row: NormalizedRow }
  | { ok: false; error: RowError };

/** Column keys the importer understands (header, case-insensitive). */
export const CSV_COLUMNS = [
  "source",
  "externalid",
  "date",
  "rating",
  "review",
  "reviewer",
  "reviewername",
  "reply",
  "url",
  "sourceurl",
] as const;

function columnMap(header: string[]): Map<string, number> {
  const map = new Map<string, number>();
  header.forEach((col, i) => map.set(col, i));
  return map;
}

function cell(row: string[], map: Map<string, number>, ...keys: string[]): string {
  for (const key of keys) {
    const idx = map.get(key);
    if (idx !== undefined && idx < row.length) return row[idx].trim();
  }
  return "";
}

/**
 * Normalize a star rating to 1–5.
 * - integers 1..5 pass through (Booking-style "9" is NOT in this range)
 * - values 6..10 are treated as a 10-point scale and halved (9 → 4.5 → 5)
 * - decimals 0..5 round to the nearest star
 * Anything else (0, negative, > 10, NaN) is an error.
 */
export function normalizeRating(raw: string): number | null {
  const value = Number(raw.replace(",", "."));
  if (!Number.isFinite(value)) return null;
  if (value >= 1 && value <= 5) return Math.round(value);
  if (value > 5 && value <= 10) return Math.max(1, Math.round(value / 2));
  return null;
}

/**
 * Normalize a date to a UTC Date at 00:00.
 * Accepted: YYYY-MM-DD, YYYY/MM/DD, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY.
 * European day-first is preferred for ambiguous numeric formats (Greece).
 * Invalid dates or dates in the future → null (error).
 */
export function normalizeDate(raw: string, now = new Date()): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let year: number, month: number, day: number;
  const iso = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  const euro = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (euro) {
    day = Number(euro[1]);
    month = Number(euro[2]);
    year = Number(euro[3]);
    // 13/01/2026 vs 01/13/2026 — day>12 disambiguates; else assume day-first
    if (day <= 12 && month > 12) {
      const swap = day;
      day = month;
      month = swap;
    }
  } else {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return null;
  if (date.getTime() > now.getTime() + 86_400_000) return null; // future
  return date;
}

/**
 * Safe fallback dedup key when no external id exists (spec §10):
 * a deterministic hash of source + date + rating + normalized text.
 * Re-importing the same file creates the same keys → upserts, not
 * duplicates; two genuinely different reviews differ in at least one
 * of the four components.
 */
export function fallbackExternalId(
  source: ReviewSource,
  receivedAt: Date,
  rating: number,
  text: string | null
): string {
  const normalizedText = (text ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  const basis = `${source}|${receivedAt.toISOString().slice(0, 10)}|${rating}|${normalizedText}`;
  return `csv-${createHash("sha256").update(basis).digest("hex").slice(0, 20)}`;
}

const URL_RE = /^https?:\/\/\S+$/i;

/** Validate + normalize one CSV data row. */
export function normalizeRow(
  line: number,
  row: string[],
  header: Map<string, number>,
  opts: { defaultSource?: ReviewSource; now?: Date } = {}
): NormalizedRowResult {
  const now = opts.now ?? new Date();
  const rawSource = cell(row, header, "source");
  const source = rawSource
    ? normalizeSourceKey(rawSource)
    : (opts.defaultSource ?? null);
  if (!source) {
    return { ok: false, error: { line, reason: "BAD_SOURCE" } };
  }
  // QR/direct feedback is private first-party data, never CSV-imported.
  if (source === "qr_feedback" || source === "direct_feedback") {
    return { ok: false, error: { line, reason: "PRIVATE_SOURCE" } };
  }

  const ratingRaw = cell(row, header, "rating", "stars");
  const rating = normalizeRating(ratingRaw);
  if (rating === null) {
    return { ok: false, error: { line, reason: "BAD_RATING" } };
  }

  const dateRaw = cell(row, header, "date", "reviewdate", "publishedat");
  const receivedAt = normalizeDate(dateRaw, now);
  if (!receivedAt) {
    return { ok: false, error: { line, reason: "BAD_DATE" } };
  }

  const text = cell(row, header, "review", "text", "comment") || null;
  const reviewerName = cell(row, header, "reviewer", "reviewername", "author") || null;
  const replyText = cell(row, header, "reply", "replytext") || null;
  const sourceUrlRaw = cell(row, header, "url", "sourceurl");
  const sourceUrl = URL_RE.test(sourceUrlRaw) ? sourceUrlRaw : null;
  const externalId = cell(row, header, "externalid", "id") || null;

  if (!text && !reviewerName && !externalId) {
    return { ok: false, error: { line, reason: "EMPTY_ROW" } };
  }

  return {
    ok: true,
    row: {
      line,
      source,
      externalId:
        externalId && externalId.length <= 200 ? externalId : null,
      rating,
      text: text ? text.slice(0, 4000) : null,
      reviewerName: reviewerName ? reviewerName.slice(0, 120) : null,
      receivedAt,
      replyText: replyText ? replyText.slice(0, 4000) : null,
      sourceUrl,
    },
  };
}

/** Normalize a whole matrix (header + data rows) in one pass. */
export function normalizeRows(
  header: string[],
  data: string[][],
  opts: { defaultSource?: ReviewSource; now?: Date } = {}
): { rows: NormalizedRow[]; errors: RowError[] } {
  const map = columnMap(header);
  const rows: NormalizedRow[] = [];
  const errors: RowError[] = [];
  data.forEach((row, index) => {
    const line = index + 2; // header is line 1
    const result = normalizeRow(line, row, map, opts);
    if (result.ok) rows.push(result.row);
    else errors.push(result.error);
  });
  return { rows, errors };
}
