// middleware.ts — locale routing + auth guard + security headers
// V2 fix vs the V1 listing: V1 redirected unauthenticated users from
// /login itself → an infinite redirect loop. Public pages (landing,
// auth pages, QR, webhooks, cron, health, GBP callback) are excluded
// explicitly; everything else requires the JWT session.
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
export const config = { matcher: ["/((?!_next|.*\\..*).*)"] };