// tests/unit/analysis-schema.test.ts — contract of the AI output
// V2 fix vs the V1 listing: validSample and readFixtures resolve from
// ../fixtures/loader (V1 used both names without the module existing);
// the invalid cases assert the closed vocabulary and bounded severity.
import { describe, expect, it } from "vitest";
import { analysisSchema } from "@/ai/schemas";
import { invalidSamples, readFixtures, validSample } from "../fixtures/loader";
describe("analysis contract", () => {
  it("accepts every recorded valid fixture (el/en/de samples)", () => {
    for (const f of readFixtures("analysis/valid")) {
      expect(() => analysisSchema.parse(JSON.parse(f.json))).not.toThrow();
    }
  });
  it("accepts the canonical valid sample", () => {
    expect(() => analysisSchema.parse(validSample)).not.toThrow();
  });
  it("rejects out-of-vocabulary categories", () => {
    const bad = {
      ...validSample,
      complaints: [
        { category: "vibes", severity: 9, summary: "x".repeat(5) },
      ],
    };
    expect(() => analysisSchema.parse(bad)).toThrow();
  });
  it("rejects severity out of 1..5 and unknown sentiment", () => {
    expect(() => analysisSchema.parse({ ...validSample, sentiment: "ANGRY" })).toThrow();
  });
  it("rejects every recorded invalid sample", () => {
    for (const sample of invalidSamples) {
      expect(() => analysisSchema.parse(sample)).toThrow();
    }
  });
});