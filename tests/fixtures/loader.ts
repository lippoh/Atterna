// tests/fixtures/loader.ts — fixture loader for the schema contract tests
// readFixtures("analysis/valid") walks tests/fixtures/<dir>/*.json; the
// el/en/de samples exist so every language the P1 prompt emits is
// regression-tested. validSample / invalidSamples power the targeted
// rejection cases (the names V1's test used without defining them).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
const FIXTURES_ROOT = join(process.cwd(), "tests", "fixtures");
export interface FixtureFile {
  name: string;
  json: string;
}
export function readFixtures(subdir: string): FixtureFile[] {
  const dir = join(FIXTURES_ROOT, subdir);
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => ({
      name,
      json: readFileSync(join(dir, name), "utf8"),
    }));
}
export const validSample = JSON.parse(
  readFileSync(join(FIXTURES_ROOT, "analysis/valid/sample-el.json"), "utf8")
) as Record<string, unknown>;
export const invalidSamples: unknown[] = [
  // out-of-vocabulary category
  {
    ...validSample,
    complaints: [{ category: "vibes", severity: 9, summary: "xxxxx" }],
  },
  // unknown sentiment
  { ...validSample, sentiment: "ANGRY" },
  // severity out of 1..5
  {
    ...validSample,
    complaints: [{ category: "service", severity: 9, summary: "xxxxx" }],
  },
  // missing language
  { ...validSample, language: undefined },
  // topic outside the closed vocabulary
  { ...validSample, topics: ["weather"] },
];