// middleware.ts — locale routing + auth guard + security headers
// V2 fix vs the V1 listing: V1 redirected unauthenticated users from
// /login itself → an infinite redirect loop. Public pages (landing,
// auth pages, QR, webhooks, cron, health, GBP callback) are excluded
// explicitly; everything else requires the JWT session.
//
// Stripe fix pack (2026-09): the matcher now excludes /api/* paths.
// Previously next-intl rewrote every /api request into the [locale]
// segment (default locale: internal rewrite to /el/api/...; detected
// non-default locale: 307 redirect to /en/api/...), and since the API
// routes live OUTSIDE src/app/[locale], the entire API surface 404'd —
// including /api/webhooks/stripe (Stripe deliveries all failed), the
// auth endpoints, /api/cron and /api/health. API routes authorize
// themselves (CRON_SECRET, Stripe signatures, NextAuth internals) and
// must never be locale-routed. The PUBLIC_PATH /api allowances below
// stay as documentation of that contract; they are unreachable now by
// design. Locale routing, the auth guard and the security headers are
// unchanged for all page routes.
import NextAuth from "next-auth";
import authConfig from "@/lib/auth.config";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
const intl = createIntlMiddleware({
locales: ["el", "en"],
defaultLocale: "el",
localePrefix: "as-needed",
});
const { auth } = NextAuth(authConfig);
const securityHeaders = [
{ key: "X-Frame-Options", value: "DENY" },
{ key: "X-Content-Type-Options", value: "nosniff" },
{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
{ key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];
// V2 fix: pages an anonymous visitor must be able to reach.
const PUBLIC_PATH =
/^\/(el|en)?\/?(login|register|verify|reset)(\/|$)/;
export default auth((req) => {
const res = intl(req); // handles locale detection + persistence
const { pathname } = req.nextUrl;
const isPublic =
pathname === "/" ||
/^\/(el|en)\/?$/.test(pathname) ||
PUBLIC_PATH.test(pathname) ||
pathname.startsWith("/f/") ||
pathname.startsWith("/api/auth") ||
pathname.startsWith("/api/webhooks") ||
pathname.startsWith("/api/cron") ||
pathname.startsWith("/api/health") ||
pathname.startsWith("/api/gbp");
if (!isPublic && !req.auth) {
const url = new URL("/login", req.nextUrl);
url.searchParams.set("callbackUrl", req.nextUrl.pathname);
return NextResponse.redirect(url);
}
securityHeaders.forEach((h) => res.headers.set(h.key, h.value));
return res;
});
// `api` excludes every /api/* path from this middleware (Stripe webhooks,
// cron, health, auth). The other alternatives exclude Next internals and
// any path containing a dot (static files). See the header comment.
export const config = { matcher: ["/((?!api|_next|.*\\..*).*)"] };