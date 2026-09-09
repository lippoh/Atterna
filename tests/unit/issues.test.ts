// tests/unit/issues.test.ts — recurring/emerging detection (§18, §19)
import { describe, expect, it } from "vitest";
import { detectIssueCandidates, type ThemeStat } from "@/lib/reputation/themes";

const NOW = new Date("2026-09-09T12:00:00Z");

function stat(overrides: Partial<ThemeStat>): ThemeStat {
  return {
    category: "waiting_time",
    labelEl: "Χρόνος αναμονής",
    labelEn: "Waiting time",
    complaintMentions: 10,
    complimentMentions: 0,
    priorWindowComplaints: 9, // 10/9 → STABLE trend → severity MEDIUM at 10 mentions
    last30Complaints: 3,
    monthly: [2, 3, 4, 3, 2, 3],
    firstSeen: new Date("2026-03-01"),
    lastSeen: NOW,
    sources: ["google"],
    ...overrides,
  };
}

describe("detectIssueCandidates", () => {
  it("flags a persistent complaint as RECURRING with the right severity", () => {
    const candidates = detectIssueCandidates([stat({})], NOW);
    const recurring = candidates.find((c) => c.kind === "RECURRING");
    expect(recurring).toBeDefined();
    expect(recurring?.category).toBe("waiting_time");
    expect(recurring?.mentionsCurrent).toBe(10);
    expect(recurring?.severity).toBe("MEDIUM"); // 10 mentions, stable trend
  });

  it("escalates severity at 15+ mentions", () => {
    const candidates = detectIssueCandidates([stat({ complaintMentions: 18, monthly: [4, 5, 4, 5, 4, 5] })], NOW);
    expect(candidates.find((c) => c.kind === "RECURRING")?.severity).toBe("HIGH");
  });

  it("does not flag themes below the mention threshold", () => {
    const candidates = detectIssueCandidates([stat({ complaintMentions: 3 })], NOW);
    expect(candidates).toHaveLength(0);
  });

  it("requires presence in at least 2 of the last 3 months", () => {
    // 10 mentions but concentrated in one month → not recurring.
    const candidates = detectIssueCandidates([stat({ monthly: [0, 0, 0, 0, 0, 10] })], NOW);
    expect(candidates.filter((c) => c.kind === "RECURRING")).toHaveLength(0);
  });

  it("flags EMERGING when the last 30d matches/exceeds the prior 90d", () => {
    const candidates = detectIssueCandidates(
      [stat({ category: "booking", complaintMentions: 5, priorWindowComplaints: 1, last30Complaints: 5, monthly: [0, 0, 0, 0, 1, 5] })],
      NOW
    );
    const emerging = candidates.find((c) => c.kind === "EMERGING");
    expect(emerging).toBeDefined();
    expect(emerging?.mentionsCurrent).toBe(5);
    expect(emerging?.mentionsPrevious).toBe(1);
  });

  it("an already-RECURRING theme is not double-flagged as EMERGING", () => {
    const candidates = detectIssueCandidates(
      [stat({ complaintMentions: 12, priorWindowComplaints: 2, last30Complaints: 8, monthly: [1, 2, 2, 2, 3, 8] })],
      NOW
    );
    expect(candidates.some((c) => c.kind === "RECURRING")).toBe(true);
    expect(candidates.some((c) => c.kind === "EMERGING")).toBe(false);
  });

  it("ignores 2-mention blips with zero history", () => {
    const candidates = detectIssueCandidates(
      [stat({ category: "noise", complaintMentions: 2, priorWindowComplaints: 0, last30Complaints: 2, monthly: [0, 0, 0, 0, 0, 2] })],
      NOW
    );
    expect(candidates).toHaveLength(0);
  });

  it("sorts by severity then mentions", () => {
    const candidates = detectIssueCandidates(
      [
        stat({ category: "b", complaintMentions: 9, monthly: [2, 2, 2, 2, 2, 2] }),
        stat({ category: "a", complaintMentions: 17, monthly: [4, 4, 4, 4, 4, 5] }),
      ],
      NOW
    );
    expect(candidates[0].category).toBe("a");
  });
});
