// src/integrations/csv/parser.ts — RFC-4180-style CSV parsing, zero deps
// Handles quoted fields, escaped quotes (""), embedded commas/newlines,
// CRLF and LF line endings. Guards: size and row caps so a hostile file
// can't exhaust memory. A ragged row (wrong column count) is reported per
// row by the normalizer — the parser only splits.
export interface ParseResult {
  rows: string[][];
  error: string | null;
}

export const CSV_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
export const CSV_MAX_ROWS = 5_000;

/** Parse CSV text into rows of cells. `hasHeader` rows are data to the parser. */
export function parseCsv(text: string): ParseResult {
  if (Buffer.byteLength(text, "utf8") > CSV_MAX_BYTES) {
    return { rows: [], error: "FILE_TOO_LARGE" };
  }
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let sawAnyQuote = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field === "" && !sawAnyQuote) {
      inQuotes = true;
      sawAnyQuote = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      sawAnyQuote = false;
      i++;
      continue;
    }
    if (ch === "\r") {
      if (text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      sawAnyQuote = false;
      rows.push(row);
      row = [];
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      field = "";
      sawAnyQuote = false;
      rows.push(row);
      row = [];
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  // last field/row without trailing newline
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length > CSV_MAX_ROWS) {
    return { rows: [], error: "TOO_MANY_ROWS" };
  }
  return { rows, error: null };
}

/**
 * Split the first (header) row off a parsed matrix, matching expected
 * column names case-insensitively. Returns the normalized header keys in
 * file order plus the data rows. Unknown columns are ignored; a header is
 * REQUIRED (we never guess column order from the first data row).
 */
export function splitHeader(
  rows: string[][],
  expected: string[]
): { header: string[]; data: string[][]; error: string | null } {
  if (rows.length === 0) return { header: [], data: [], error: "EMPTY_FILE" };
  const normalize = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, "");
  const rawHeader = rows[0].map((c) => normalize(c));
  const known = new Set(expected.map(normalize));
  // A header is trusted when at least 2 recognized expected columns appear.
  const recognized = rawHeader.filter((c) => known.has(c)).length;
  if (recognized < 2) {
    return { header: [], data: [], error: "MISSING_HEADER" };
  }
  const data = rows.slice(1).filter((r) => r.some((c) => c.trim() !== ""));
  return { header: rawHeader, data, error: null };
}
