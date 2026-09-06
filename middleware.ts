// middleware.ts — locale routing + auth guard + security headers
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
export default auth((req) => {
  const res = intl(req); // handles locale detection + persistence
  const isProtected = !req.nextUrl.pathname.startsWith("/f/") // public QR
    && !req.nextUrl.pathname.includes("/api/auth")
    && !req.nextUrl.pathname.includes("/api/webhooks")
    && !req.nextUrl.pathname.startsWith("/api/cron");
  if (isProtected && !req.auth && req.nextUrl.pathname !== "/") {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  securityHeaders.forEach((h) => res.headers.set(h.key, h.value));
  return res;
});
export const config = { matcher: ["/((?!_next|.*\\..*).*)"] };