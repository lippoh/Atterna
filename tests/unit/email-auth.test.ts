// tests/unit/email-auth.test.ts — auth email flows (Step 7)
// Signup verification, password reset and the resend-verification path,
// through the REAL server actions against the disposable test database.
// The mailer is mocked at the module boundary (capture + control), and
// next/headers is mocked so the actions run outside a request context
// with a deterministic per-test IP.
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

const mailerMock = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/lib/mailer", () => ({ send: mailerMock.send }));
// next-auth's ESM build imports "next/server" unresolvable outside the
// Next.js bundler — the actions only need the AuthError class shape.
vi.mock("next-auth", () => ({
  AuthError: class AuthError extends Error {},
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-forwarded-for": currentIp() })),
}));
// next/headers mock needs a mutable IP shared with the factory below.
vi.mock("@/lib/auth", () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  unstable_update: vi.fn(),
}));

// Deterministic, switchable IP for rate-limit tests (in-memory buckets
// are per process — each test uses its own IP for full isolation).
let ip = "203.0.113.10";
function currentIp(): string {
  return ip;
}

process.env.APP_URL = "https://app.atterna.test";

import {
  registerAction,
  verifyEmailAction,
  requestResetAction,
  resetPasswordAction,
  resendVerificationAction,
} from "@/app/[locale]/(app)/actions";
import { prisma } from "@/lib/db";
import { resetTestDb } from "./helpers";
import { verifyToken } from "@/lib/token";

const SENDER = "no-reply@atterna.test";

function formData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

/** Extract the verify/reset URL from the captured send() html payload. */
function urlFromHtml(html: string): string {
  const m = html.match(
    /https:\/\/app\.atterna\.test\/(?:el|en)\/(?:verify\?token=|reset\/)[A-Za-z0-9._-]+/
  );
  if (!m) throw new Error("no verify/reset url found in html");
  return m[0];
}

beforeAll(async () => {
  await resetTestDb();
});

beforeEach(() => {
  mailerMock.send.mockReset();
  mailerMock.send.mockResolvedValue({ ok: true, id: "test-msg" });
  ip = `203.0.113.${10 + Math.floor(Math.random() * 200)}`;
});

describe("signup verification email", () => {
  it("registers, sends the verify email server-side with a signed token link", async () => {
    const email = "signup-verify@example.com";
    const result = await registerAction({}, formData({
      email,
      password: "a-strong-password",
      locale: "en",
    }));
    expect(result).toEqual({ ok: true });

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.emailVerified).toBeNull();
    expect(user.locale).toBe("EN");

    expect(mailerMock.send).toHaveBeenCalledTimes(1);
    const payload = mailerMock.send.mock.calls[0][0];
    expect(payload.to).toBe(email);
    expect(payload.subject).toBe("Confirm your email");
    expect(typeof payload.html).toBe("string");
    expect(typeof payload.text).toBe("string");
    // From is decided by the mailer (EMAIL_FROM), never by the caller:
    expect(payload.from).toBeUndefined();

    const url = urlFromHtml(payload.html);
    expect(url).toContain("https://app.atterna.test/en/verify?token=");
    const token = new URL(url).searchParams.get("token")!;
    const payloadTok = verifyToken(token);
    expect(payloadTok).toMatchObject({ identifier: email, kind: "verify" });

    // The token actually verifies the account:
    const verify = await verifyEmailAction({}, formData({ token }));
    expect(verify).toEqual({ ok: true });
    const verified = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(verified.emailVerified).not.toBeNull();
  });

  it("register send failure surfaces as emailFailed (account kept)", async () => {
    const email = "signup-failed@example.com";
    mailerMock.send.mockResolvedValueOnce({ ok: false, error: "provider 500" });
    const result = await registerAction({}, formData({
      email,
      password: "a-strong-password",
      locale: "el",
    }));
    expect(result).toEqual({ error: "emailFailed" });

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user).toBeTruthy(); // the account exists — recovery via resend
    const audits = await prisma.auditLog.findMany({
      where: { action: "auth.register_email_failed" },
    });
    expect(audits.length).toBeGreaterThanOrEqual(1);
  });

  it("register is rate-limited: 3/h per IP", async () => {
    const results: string[] = [];
    for (let i = 1; i <= 4; i++) {
      const r = await registerAction({}, formData({
        email: `rl-${i}@example.com`,
        password: "a-strong-password",
        locale: "en",
      }));
      results.push(r.error ?? "ok");
    }
    expect(results).toEqual(["ok", "ok", "ok", "rateLimited"]);
    expect(mailerMock.send).toHaveBeenCalledTimes(3);
  });

  it("resends a verification link for an unverified account", async () => {
    const email = "resend-me@example.com";
    await prisma.user.create({
      data: { email, passwordHash: null, locale: "EL" },
    });
    const result = await resendVerificationAction({}, formData({
      email,
      locale: "el",
    }));
    expect(result).toEqual({ ok: true });

    expect(mailerMock.send).toHaveBeenCalledTimes(1);
    const payload = mailerMock.send.mock.calls[0][0];
    expect(payload.to).toBe(email);
    const url = urlFromHtml(payload.html);
    expect(url).toContain("https://app.atterna.test/el/verify?token=");
    const token = new URL(url).searchParams.get("token")!;
    expect(verifyToken(token)).toMatchObject({ identifier: email, kind: "verify" });

    const audits = await prisma.auditLog.findMany({
      where: { action: "auth.verification_resent" },
    });
    expect(audits.length).toBeGreaterThanOrEqual(1);
  });

  it("resend: unknown email → same ok (no enumeration), no send", async () => {
    const result = await resendVerificationAction({}, formData({
      email: "ghost@example.com",
      locale: "en",
    }));
    expect(result).toEqual({ ok: true });
    expect(mailerMock.send).not.toHaveBeenCalled();
  });

  it("resend: already-verified account → no send", async () => {
    const email = "already-done@example.com";
    await prisma.user.create({
      data: { email, passwordHash: null, locale: "EL", emailVerified: new Date() },
    });
    const result = await resendVerificationAction({}, formData({
      email,
      locale: "el",
    }));
    expect(result).toEqual({ ok: true });
    expect(mailerMock.send).not.toHaveBeenCalled();
  });

  it("resend is rate-limited: 3/h per IP", async () => {
    for (let i = 1; i <= 3; i++) {
      const r = await resendVerificationAction({}, formData({
        email: `resend-rl-${i}@example.com`,
        locale: "en",
      }));
      expect(r).toEqual({ ok: true });
    }
    const blocked = await resendVerificationAction({}, formData({
      email: "resend-rl-4@example.com",
      locale: "en",
    }));
    expect(blocked).toEqual({ error: "rateLimited" });
  });
});

describe("password reset email", () => {
  it("sends a single-use 60-minute reset link to known accounts", async () => {
    const email = "reset-me@example.com";
    await prisma.user.create({
      data: { email, passwordHash: null, locale: "EL" },
    });
    const result = await requestResetAction({}, formData({ email, locale: "el" }));
    expect(result).toEqual({ ok: true });

    expect(mailerMock.send).toHaveBeenCalledTimes(1);
    const payload = mailerMock.send.mock.calls[0][0];
    expect(payload.to).toBe(email);
    expect(payload.subject).toBe("Επαναφορά κωδικού πρόσβασης");
    expect(typeof payload.text).toBe("string");

    const url = urlFromHtml(payload.html);
    expect(url).toMatch(/^https:\/\/app\.atterna\.test\/el\/reset\/[A-Za-z0-9._-]+$/);
    const token = url.split("/reset/")[1];
    const payloadTok = verifyToken(decodeURIComponent(token));
    expect(payloadTok).toMatchObject({ identifier: email, kind: "reset" });

    // Single-use in effect: reset, then the SAME token is dead.
    const reset = await resetPasswordAction({}, formData({
      token: decodeURIComponent(token),
      password: "another-strong-password",
      confirm: "another-strong-password",
    }));
    expect(reset).toEqual({ ok: true });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.passwordChangedAt).not.toBeNull();
    const replay = await resetPasswordAction({}, formData({
      token: decodeURIComponent(token),
      password: "yet-another-pass-1",
      confirm: "yet-another-pass-1",
    }));
    expect(replay).toEqual({ error: "bad" });
  });

  it("unknown email → identical ok response, no send (no enumeration)", async () => {
    const result = await requestResetAction({}, formData({
      email: "ghost-reset@example.com",
      locale: "en",
    }));
    expect(result).toEqual({ ok: true });
    expect(mailerMock.send).not.toHaveBeenCalled();
  });

  it("reset requests are rate-limited: 3/h per IP", async () => {
    const email = "reset-rl@example.com";
    await prisma.user.create({
      data: { email, passwordHash: null, locale: "EL" },
    });
    for (let i = 1; i <= 3; i++) {
      const r = await requestResetAction({}, formData({ email, locale: "el" }));
      expect(r).toEqual({ ok: true });
    }
    const blocked = await requestResetAction({}, formData({ email, locale: "el" }));
    expect(blocked).toEqual({ error: "rateLimited" });
  });
});
