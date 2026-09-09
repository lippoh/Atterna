// tests/unit/email-jobs.test.ts — product email jobs (Step 7)
// Negative-review alert + private QR-feedback alert + the weekly report,
// against the disposable test database with the mailer mocked at the
// module boundary. Asserts the Step 7 contracts:
//   - alerts go to the OWNER from org data (never hardcoded);
//   - a failed alert send THROWS so the job runner retries (ALERT_SEND_FAILED);
//   - subjects are single-line (header-folding safe);
//   - every email carries the plain-text twin;
//   - the weekly report is locale-aware (el/en), RFC 2369 unsubscribe'd,
//     idempotent per business per UTC day, and ReportLog = delivered only.
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

const mailerMock = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/lib/mailer", () => ({ send: mailerMock.send }));

process.env.APP_URL = "https://app.atterna.test";

import {
  handleNotifyNegativeReview,
  handleNotifyNegativeFeedback,
} from "@/jobs/notify";
import { runWeeklyReports } from "@/jobs/weekly-report";
import { prisma } from "@/lib/db";
import { resetTestDb, seedTwoOrgs } from "./helpers";

const DAY_MS = 86_400_000;

beforeAll(async () => {
  await seedTwoOrgs(); // orgs a (el default) + b, OWNER users + businesses + one review each
});

beforeEach(() => {
  mailerMock.send.mockReset();
  mailerMock.send.mockResolvedValue({ ok: true, id: "job-msg" });
});

describe("negative-review alert", () => {
  it("sends to the organization OWNER from data, el locale, single-line subject, with text", async () => {
    const { b } = await seedTwoOrgs(); // refresh: b.review is a 1-star review
    await handleNotifyNegativeReview({ reviewId: b.review.id });

    expect(mailerMock.send).toHaveBeenCalledTimes(1);
    const payload = mailerMock.send.mock.calls[0][0];
    expect(payload.to).toBe("owner-b@example.com"); // from Membership role OWNER
    expect(payload.subject).toContain("Νέα κριτική");
    expect(payload.subject).not.toMatch(/\n/); // single-line (header-folding safe)
    expect(payload.subject).toContain("1");
    expect(typeof payload.html).toBe("string");
    expect(typeof payload.text).toBe("string");
    expect(payload.html).toContain(b.business.name);
  });

  it("respects an en-locale owner", async () => {
    const { b } = await seedTwoOrgs();
    await prisma.user.update({
      where: { email: "owner-b@example.com" },
      data: { locale: "EN" },
    });
    await handleNotifyNegativeReview({ reviewId: b.review.id });
    const payload = mailerMock.send.mock.calls[0][0];
    expect(payload.subject).toContain("New 1-star review");
    expect(payload.subject).not.toMatch(/\n/);
  });

  it("THROWS on send failure so the job runner retries (never swallows)", async () => {
    const { b } = await seedTwoOrgs();
    mailerMock.send.mockResolvedValueOnce({ ok: false, error: "provider 5xx" });
    await expect(
      handleNotifyNegativeReview({ reviewId: b.review.id })
    ).rejects.toThrow(/ALERT_SEND_FAILED/);
  });
});

describe("private QR-feedback alert", () => {
  it("alerts the owner of rating <= 3 feedback with the comment", async () => {
    const { a } = await seedTwoOrgs();
    const request = await prisma.feedbackRequest.create({
      data: {
        businessId: a.business.id,
        token: `qr-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        label: "QR table 4",
        active: true,
      },
    });
    const submission = await prisma.feedbackSubmission.create({
      data: {
        feedbackRequestId: request.id,
        businessId: a.business.id,
        organizationId: a.org.id,
        rating: 2,
        comment: "Η εξυπηρέτηση ήταν αργή",
      },
    });
    await handleNotifyNegativeFeedback({ id: submission.id });

    expect(mailerMock.send).toHaveBeenCalledTimes(1);
    const payload = mailerMock.send.mock.calls[0][0];
    expect(payload.to).toBe("owner-a@example.com");
    expect(payload.subject).toContain("2/5");
    expect(payload.subject).not.toMatch(/\n/);
    expect(typeof payload.text).toBe("string");
    expect(payload.html).toContain("Η εξυπηρέτηση ήταν αργή");
  });

  it("THROWS on send failure so the job runner retries", async () => {
    const { a } = await seedTwoOrgs();
    const request = await prisma.feedbackRequest.create({
      data: {
        businessId: a.business.id,
        token: `qr-f-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        active: true,
      },
    });
    const submission = await prisma.feedbackSubmission.create({
      data: {
        feedbackRequestId: request.id,
        businessId: a.business.id,
        organizationId: a.org.id,
        rating: 1,
        comment: null,
      },
    });
    mailerMock.send.mockResolvedValueOnce({ ok: false, error: "network" });
    await expect(
      handleNotifyNegativeFeedback({ id: submission.id })
    ).rejects.toThrow(/ALERT_SEND_FAILED/);
  });
});

describe("weekly report", () => {
  async function seedActiveSubscriptions() {
    await resetTestDb();
    const { a, b } = await seedTwoOrgs();
    await prisma.user.update({
      where: { email: "owner-b@example.com" },
      data: { locale: "EN" },
    });
    for (const org of [a.org, b.org]) {
      await prisma.subscription.create({
        data: {
          organizationId: org.id,
          planKey: "STARTER",
          status: "ACTIVE",
          currentPeriodEnd: new Date(Date.now() + 30 * DAY_MS),
        },
      });
    }
    return { a, b };
  }

  it("sends per active business in the owner's locale with text + RFC 2369 unsubscribe", async () => {
    const { a, b } = await seedActiveSubscriptions();
    const result = await runWeeklyReports();

    expect(result).toEqual({ sent: 2, failed: 0, skipped: 0 });
    expect(mailerMock.send).toHaveBeenCalledTimes(2);

    const toA = mailerMock.send.mock.calls.find(
      (c) => c[0].to === "owner-a@example.com"
    )!;
    expect(toA[0].subject).toContain("Εβδομαδιαία αναφορά φήμης");
    expect(toA[0].subject).not.toMatch(/\n/);
    expect(toA[0].listUnsubscribe).toBe(true);
    expect(typeof toA[0].text).toBe("string");
    expect(typeof toA[0].html).toBe("string");
    expect(toA[0].html).toContain(a.business.name);

    const toB = mailerMock.send.mock.calls.find(
      (c) => c[0].to === "owner-b@example.com"
    )!;
    expect(toB[0].subject).toContain("Your weekly reputation report");
    expect(toB[0].listUnsubscribe).toBe(true);

    const logs = await prisma.reportLog.findMany({ where: { kind: "WEEKLY" } });
    expect(logs.length).toBe(2); // one per business, delivered
  });

  it("is idempotent per business per UTC day (double-fired cron sends nothing)", async () => {
    await seedActiveSubscriptions();
    await runWeeklyReports(); // first run delivers
    const second = await runWeeklyReports(); // double-fire minutes later

    expect(second).toEqual({ sent: 0, failed: 0, skipped: 2 });
    expect(mailerMock.send).toHaveBeenCalledTimes(2); // only the first run
  });

  it("send failures are counted and write NO ReportLog (retry stays possible)", async () => {
    await seedActiveSubscriptions();
    mailerMock.send.mockResolvedValue({ ok: false, error: "provider 5xx" });

    const result = await runWeeklyReports();
    expect(result).toEqual({ sent: 0, failed: 2, skipped: 0 });

    const logs = await prisma.reportLog.findMany({ where: { kind: "WEEKLY" } });
    expect(logs.length).toBe(0); // nothing marked delivered

    // Recovery: the next run (send healthy again) retries both businesses.
    mailerMock.send.mockResolvedValue({ ok: true, id: "retry-msg" });
    const retry = await runWeeklyReports();
    expect(retry).toEqual({ sent: 2, failed: 0, skipped: 0 });
    expect((await prisma.reportLog.findMany({ where: { kind: "WEEKLY" } })).length).toBe(2);
  });

  it("skips businesses without an active subscription", async () => {
    await resetTestDb();
    await seedTwoOrgs(); // no Subscription rows at all
    const result = await runWeeklyReports();
    expect(result).toEqual({ sent: 0, failed: 0, skipped: 0 });
    expect(mailerMock.send).not.toHaveBeenCalled();
  });
});
