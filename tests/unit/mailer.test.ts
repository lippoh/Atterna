// tests/unit/mailer.test.ts — the Resend boundary (Step 7)
// Covers the audit's G list: mailer configuration validation (missing /
// malformed env vars are named), sender address (EMAIL_FROM is the single
// source; List-Unsubscribe extraction), plain-text pass-through, provider
// message-id logging contract, and Resend API error handling (5xx-style
// SDK errors and thrown network errors become { ok: false } — never a
// throw, and never the API key material).
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Resend SDK at the module boundary — no network, no real key.
const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mocks.send };
  },
}));

// Local dummy values — NOT credentials (test fixtures only). Set before
// any env read: src/lib/env.ts validates lazily per key.
process.env.RESEND_API_KEY = "re_test_0123456789abcdef";
process.env.EMAIL_FROM = "Atterna <no-reply@mail.test.example>";
process.env.APP_URL = "https://app.test.example";

import { send, senderAddress } from "@/lib/mailer";

beforeEach(() => {
  mocks.send.mockReset();
});

describe("mailer: sender configuration", () => {
  it("uses EMAIL_FROM as the From for every send (single source)", async () => {
    mocks.send.mockResolvedValueOnce({ data: { id: "m-1" }, error: null });
    const result = await send({
      to: "guest@example.gr",
      subject: "hello",
      html: "<p>hello</p>",
    });
    expect(result.ok).toBe(true);
    const payload = mocks.send.mock.calls[0][0];
    expect(payload.from).toBe("Atterna <no-reply@mail.test.example>");
    expect(payload.to).toEqual(["guest@example.gr"]);
    expect(payload.subject).toBe("hello");
    expect(payload.html).toBe("<p>hello</p>");
  });

  it("extracts the bare address from a display-name EMAIL_FROM", () => {
    expect(senderAddress()).toBe("no-reply@mail.test.example");
  });

  it("validates EMAIL_FROM shape: junk is rejected naming the variable", async () => {
    vi.resetModules();
    const previous = process.env.EMAIL_FROM;
    process.env.EMAIL_FROM = "not an email";
    try {
      const { send: freshSend } = await import("@/lib/mailer");
      const result = await freshSend({
        to: "guest@example.gr",
        subject: "hello",
        html: "<p>hello</p>",
      });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("EMAIL_FROM");
    } finally {
      process.env.EMAIL_FROM = previous;
      vi.resetModules();
    }
  });

  it("names RESEND_API_KEY when the key is missing", async () => {
    vi.resetModules();
    const previous = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    try {
      const { send: freshSend } = await import("@/lib/mailer");
      const result = await freshSend({
        to: "guest@example.gr",
        subject: "hello",
        html: "<p>hello</p>",
      });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("RESEND_API_KEY");
    } finally {
      process.env.RESEND_API_KEY = previous;
      vi.resetModules();
    }
  });
});

describe("mailer: message shape", () => {
  it("passes the plain-text part through when provided", async () => {
    mocks.send.mockResolvedValueOnce({ data: { id: "m-2" }, error: null });
    await send({
      to: "guest@example.gr",
      subject: "hello",
      html: "<p>hello</p>",
      text: "hello (text)",
    });
    expect(mocks.send.mock.calls[0][0].text).toBe("hello (text)");
  });

  it("omits the text part when not provided", async () => {
    mocks.send.mockResolvedValueOnce({ data: { id: "m-3" }, error: null });
    await send({ to: "guest@example.gr", subject: "hello", html: "<p>x</p>" });
    expect(mocks.send.mock.calls[0][0].text).toBeUndefined();
  });

  it("adds RFC 2369 headers only when listUnsubscribe is set", async () => {
    mocks.send.mockResolvedValue({ data: { id: "m-4" }, error: null });
    await send({
      to: "a@example.gr",
      subject: "weekly",
      html: "<p>x</p>",
      listUnsubscribe: true,
    });
    await send({ to: "b@example.gr", subject: "alert", html: "<p>x</p>" });

    const weekly = mocks.send.mock.calls[0][0];
    expect(weekly.headers["List-Unsubscribe"]).toBe(
      "<mailto:no-reply@mail.test.example>"
    );
    expect(weekly.headers["List-Unsubscribe-Post"]).toBe(
      "List-Unsubscribe=One-Click"
    );

    const alert = mocks.send.mock.calls[1][0];
    expect(alert.headers["List-Unsubscribe"]).toBeUndefined();
    expect(alert.headers["List-Unsubscribe-Post"]).toBeUndefined();
  });
});

describe("mailer: Resend API error handling", () => {
  it("returns { ok: false, error } on a provider (5xx-style) error", async () => {
    mocks.send.mockResolvedValueOnce({
      data: null,
      error: { message: "Internal provider error", name: "error" },
    });
    const result = await send({
      to: "guest@example.gr",
      subject: "hello",
      html: "<p>x</p>",
    });
    expect(result).toEqual({ ok: false, error: "Internal provider error" });
  });

  it("returns { ok: false } on a thrown network error (never throws)", async () => {
    mocks.send.mockRejectedValueOnce(new Error("ECONNRESET"));
    const result = await send({
      to: "guest@example.gr",
      subject: "hello",
      html: "<p>x</p>",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("ECONNRESET");
  });

  it("returns the provider message id on success", async () => {
    mocks.send.mockResolvedValueOnce({ data: { id: "resend-id-42" }, error: null });
    const result = await send({
      to: "guest@example.gr",
      subject: "hello",
      html: "<p>x</p>",
    });
    expect(result).toEqual({ ok: true, id: "resend-id-42" });
  });

  it("never includes API key material in error strings", async () => {
    mocks.send.mockRejectedValueOnce(new Error("socket hang up"));
    const result = await send({
      to: "guest@example.gr",
      subject: "hello",
      html: "<p>x</p>",
    });
    expect(result.error).not.toContain(process.env.RESEND_API_KEY!);
    expect(result.error).not.toContain("re_test_");
  });
});
