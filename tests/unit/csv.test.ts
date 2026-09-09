// tests/unit/csv.test.ts — CSV parser + normalizer + dedup fallback (§41)
import { describe, expect, it } from "vitest";
import { parseCsv, splitHeader } from "@/integrations/csv/parser";
import {
  normalizeRating,
  normalizeDate,
  normalizeRow,
  normalizeRows,
  fallbackExternalId,
} from "@/integrations/csv/normalizer";

const NOW = new Date("2026-09-09T12:00:00Z");

describe("parseCsv", () => {
  it("parses quoted fields with embedded commas, quotes and newlines", () => {
    const csv = 'source,rating,review\ngoogle,5,"Amazing, truly ""great"" service"\ncsv,4,"line1\nline2"';
    const { rows, error } = parseCsv(csv);
    expect(error).toBeNull();
    expect(rows).toEqual([
      ["source", "rating", "review"],
      ["google", "5", 'Amazing, truly "great" service'],
      ["csv", "4", "line1\nline2"],
    ]);
  });

  it("handles CRLF line endings", () => {
    const { rows } = parseCsv("a,b\r\n1,2\r\n");
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("rejects oversized files", () => {
    const { error } = parseCsv("x".repeat(3 * 1024 * 1024));
    expect(error).toBe("FILE_TOO_LARGE");
  });

  it("rejects too many rows", () => {
    const rows = "a\n".repeat(6000);
    const { error } = parseCsv(rows);
    expect(error).toBe("TOO_MANY_ROWS");
  });
});

describe("splitHeader", () => {
  it("recognizes a header case-insensitively and ignores unknown columns", () => {
    const { header, data, error } = splitHeader(
      [["Source", "Date", "Rating", "Extra"], ["google", "2026-08-01", "5", "x"]],
      ["source", "date", "rating"]
    );
    expect(error).toBeNull();
    expect(header).toEqual(["source", "date", "rating", "extra"]);
    expect(data).toEqual([["google", "2026-08-01", "5", "x"]]);
  });

  it("requires at least two known columns", () => {
    const { error } = splitHeader([["foo", "bar"], ["1", "2"]], ["source", "date", "rating"]);
    expect(error).toBe("MISSING_HEADER");
  });
});

describe("normalizeRating", () => {
  it("keeps 1-5 integers and rounds decimals", () => {
    expect(normalizeRating("5")).toBe(5);
    expect(normalizeRating("4")).toBe(4);
    expect(normalizeRating("4,5")).toBe(5); // 4.5 → 5
  });
  it("halves 10-point scales (Booking)", () => {
    expect(normalizeRating("9")).toBe(5); // 4.5 → 5
    expect(normalizeRating("8")).toBe(4);
    expect(normalizeRating("7")).toBe(4); // 3.5 → 4
  });
  it("rejects nonsense", () => {
    expect(normalizeRating("0")).toBeNull();
    expect(normalizeRating("12")).toBeNull();
    expect(normalizeRating("abc")).toBeNull();
    expect(normalizeRating("")).toBeNull();
  });
});

describe("normalizeDate", () => {
  it("accepts ISO and European formats", () => {
    expect(normalizeDate("2026-08-20", NOW)?.toISOString()).toBe("2026-08-20T00:00:00.000Z");
    expect(normalizeDate("20/08/2026", NOW)?.toISOString()).toBe("2026-08-20T00:00:00.000Z");
    expect(normalizeDate("20-08-2026", NOW)?.toISOString()).toBe("2026-08-20T00:00:00.000Z");
  });
  it("disambiguates day-first when day > 12", () => {
    expect(normalizeDate("13/01/2026", NOW)?.getUTCMonth()).toBe(0);
    expect(normalizeDate("01/13/2026", NOW)?.getUTCMonth()).toBe(0); // swapped to Jan
  });
  it("rejects invalid and future dates", () => {
    expect(normalizeDate("32/13/2026", NOW)).toBeNull();
    expect(normalizeDate("not-a-date", NOW)).toBeNull();
    expect(normalizeDate("2027-01-01", NOW)).toBeNull();
  });
});

describe("normalizeRow", () => {
  const header = new Map([
    ["source", 0],
    ["date", 1],
    ["rating", 2],
    ["review", 3],
    ["reviewer", 4],
    ["reply", 5],
  ]);

  it("normalizes a full valid row", () => {
    const result = normalizeRow(2, ["GOOGLE", "20/08/2026", "5", "Great place", "Mary K.", "Thanks!"], header, { now: NOW });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.row.source).toBe("google");
      expect(result.row.rating).toBe(5);
      expect(result.row.reviewerName).toBe("Mary K.");
      expect(result.row.replyText).toBe("Thanks!");
    }
  });

  it("defaults an empty source to csv", () => {
    const result = normalizeRow(3, ["", "2026-08-01", "4", "Nice", "", ""], header, { now: NOW, defaultSource: "csv" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.row.source).toBe("csv");
  });

  it("rejects unknown sources, bad ratings, bad dates", () => {
    expect(normalizeRow(4, ["foursquare", "2026-08-01", "5", "x", "", ""], header, { now: NOW }).ok).toBe(false);
    expect(normalizeLineReason(normalizeRow(5, ["google", "2026-08-01", "0", "x", "", ""], header, { now: NOW }))).toBe("BAD_RATING");
    expect(normalizeLineReason(normalizeRow(6, ["google", "nope", "5", "x", "", ""], header, { now: NOW }))).toBe("BAD_DATE");
  });

  it("refuses private first-party sources", () => {
    const result = normalizeRow(7, ["qr_feedback", "2026-08-01", "5", "x", "", ""], header, { now: NOW });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.reason).toBe("PRIVATE_SOURCE");
  });
});

function normalizeLineReason(result: { ok: boolean; error?: { reason: string } }): string {
  return result.ok ? "" : (result.error?.reason ?? "");
}

describe("fallbackExternalId (safe dedup, §10)", () => {
  it("is deterministic for identical content", () => {
    const a = fallbackExternalId("google", new Date("2026-08-20T00:00:00Z"), 5, "Same text");
    const b = fallbackExternalId("google", new Date("2026-08-20T00:00:00Z"), 5, "Same text");
    expect(a).toBe(b);
  });
  it("differs when source, date, rating or text differ", () => {
    const base = fallbackExternalId("google", new Date("2026-08-20T00:00:00Z"), 5, "Same text");
    expect(fallbackExternalId("csv", new Date("2026-08-20T00:00:00Z"), 5, "Same text")).not.toBe(base);
    expect(fallbackExternalId("google", new Date("2026-08-21T00:00:00Z"), 5, "Same text")).not.toBe(base);
    expect(fallbackExternalId("google", new Date("2026-08-20T00:00:00Z"), 4, "Same text")).not.toBe(base);
    expect(fallbackExternalId("google", new Date("2026-08-20T00:00:00Z"), 5, "Other text")).not.toBe(base);
  });
  it("normalizes whitespace/case in the text basis", () => {
    const a = fallbackExternalId("csv", new Date("2026-08-20T00:00:00Z"), 5, "Great   PLACE");
    const b = fallbackExternalId("csv", new Date("2026-08-20T00:00:00Z"), 5, "great place");
    expect(a).toBe(b);
  });
});

describe("normalizeRows", () => {
  it("separates valid rows and per-row errors", () => {
    const { rows, errors } = normalizeRows(
      ["source", "date", "rating", "review"],
      [
        ["google", "2026-08-01", "5", "A"],
        ["google", "bad-date", "5", "B"],
        ["google", "2026-08-02", "99", "C"],
      ],
      { now: NOW }
    );
    expect(rows).toHaveLength(1);
    expect(errors.map((e) => e.reason)).toEqual(["BAD_DATE", "BAD_RATING"]);
  });
});
