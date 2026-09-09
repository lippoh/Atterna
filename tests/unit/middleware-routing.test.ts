// tests/unit/middleware-routing.test.ts — regression: /api/* must never be
// locale-routed.
//
// The Stripe fix pack (2026-09) exists because next-intl's middleware
// rewrote every /api/* request into the [locale] segment: default locale
// → internal rewrite to /el/api/webhooks/stripe, a detected non-default
// locale → 307 redirect to /en/api/webhooks/stripe. The API routes live
// outside src/app/[locale], so the whole API surface 404'd — Stripe
// webhook deliveries never reached the handler. The fix is the middleware
// MATCHER (exclude /api), so this file asserts the matcher semantics
// directly, by reading middleware.ts as source — importing the middleware
// module is deliberately avoided: its next-auth dependency imports
// "next/server" extensionless, which plain ESM (vitest) cannot resolve.
//
// The behavioral complements (auth guard, security headers, real
// routing) are proven end-to-end against a running build by
// scripts/verify-webhook-routing.mjs.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(__dirname, "../../middleware.ts"),
  "utf8"
);

function extractMatcher(): string {
  const m = source.match(/matcher:\s*\[\s*"((?:[^"\\]|\\.)*)"\s*\]/);
  if (!m) throw new Error("middleware.ts: matcher export not found");
  // Unescape the string literal the way TypeScript would.
  return JSON.parse(`"${m[1]}"`) as string;
}

const matcher = extractMatcher();

/** Evaluates the matcher the way Next.js does for this pattern family. */
function middlewareApplies(pathname: string): boolean {
  return new RegExp(`^${matcher}$`).test(pathname);
}

describe("middleware matcher: /api exclusion (Stripe fix pack)", () => {
  it("declares a matcher that excludes /api, Next internals and files", () => {
    // The pattern must keep the negative-lookahead exclusions; a matcher
    // losing "api" is exactly the regression that 404'd the API surface.
    expect(matcher).toMatch(/\(\?!api\|/);
    expect(matcher).toMatch(/_next\|/);
  });

  it("never applies the middleware to API routes", () => {
    for (const pathname of [
      "/api/webhooks/stripe",
      "/api/health",
      "/api/auth/providers",
      "/api/auth/callback/credentials",
      "/api/cron",
      "/api/gbp/callback",
    ]) {
      expect(middlewareApplies(pathname), pathname).toBe(false);
    }
  });

  it("still applies to page routes (locale routing + auth guard)", () => {
    for (const pathname of [
      "/",
      "/el",
      "/en",
      "/dashboard",
      "/el/dashboard",
      "/en/billing",
      "/billing",
      "/login",
      "/el/login",
      "/f/abc123",
      "/verify",
      "/reset/token",
    ]) {
      expect(middlewareApplies(pathname), pathname).toBe(true);
    }
  });

  it("still excludes Next internals and static files", () => {
    for (const pathname of ["/_next/static/chunk.js", "/favicon.ico"]) {
      expect(middlewareApplies(pathname), pathname).toBe(false);
    }
  });
});

describe("middleware source: page behavior preserved", () => {
  it("still routes pages through next-intl and the auth guard", () => {
    expect(source).toContain("createIntlMiddleware");
    expect(source).toContain("NextAuth(authConfig)");
    expect(source).toContain("PUBLIC_PATH");
  });

  it("still sets every security header", () => {
    for (const header of [
      "X-Frame-Options",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
    ]) {
      expect(source).toContain(header);
    }
  });
});
