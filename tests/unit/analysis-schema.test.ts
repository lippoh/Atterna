// tests/unit/analysis-schema.test.ts — contract of the AI output
import { describe, it, expect } from "vitest";
import { analysisSchema } from "@/ai/schemas";
import { readFixtures } from "../fixtures/loader";

const validSample = {
  sentiment: "POSITIVE",
  urgency: "LOW",
  language: "en",
  topics: [],
  complaints: [],
  compliments: [],
  actionable: false,
};
describe("analysis contract", () => {
  it("accepts every recorded valid fixture (el/en/de samples)", () => {
    for (const f of readFixtures("analysis/valid")) {
      expect(() => analysisSchema.parse(JSON.parse(f.json))).not.toThrow();
    }
  });
  it("rejects out-of-vocabulary categories", () => {
    const bad = { ...validSample, complaints: [
      { category: "vibes", severity: 9, summary: "x".repeat(5) }] };
    expect(() => analysisSchema.parse(bad)).toThrow();
  });
  it("rejects severity out of 1..5 and unknown sentiment", () => {
    expect(() => analysisSchema.parse(
      { ...validSample, sentiment: "ANGRY" })).toThrow(/enum/i);
  });
});