// src/integrations/gbp/oauth.ts — connection callback
// V2 fixes vs the V1 listing: verifyState now exists (lib/crypto —
// signed, org-bound, 10-minute TTL); pickFirstLocation now exists
// (gbp/client); the unused refreshIfNeeded import is gone; the upsert's
// update branch actually rotates tokens and keeps ids. The GET handler
// stays exactly where the tree promised it, and src/app/api/gbp/callback/
// route.ts re-exports it so Google has a routable redirect URL:
//   {APP_URL}/api/gbp/callback
import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, pickFirstLocation, GBP_SCOPES } from "./client";
import { encrypt, signState, verifyState } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/session";
/** Build the Google consent URL (called by the onboarding action). */
export function buildGbpAuthUrl(orgId: string, redirectUri: string): string {
  const state = signState(orgId);
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GBP_SCOPES,
    access_type: "offline", // refresh token
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
export async function GET(req: NextRequest) {
  const { orgId } = await requireOrg();
  const state = req.nextUrl.searchParams.get("state") ?? "";
  const code = req.nextUrl.searchParams.get("code") ?? "";
  if (!verifyState(state, orgId)) // CSRF protection, org-bound, expiring
    return NextResponse.redirect(new URL("/settings?gbp=state", req.url));
  const redirectUri = new URL("/api/gbp/callback", req.url).toString();
  const tokens = await exchangeCode(code, redirectUri); // includes refresh_token
  const location = await pickFirstLocation(tokens.access_token);
  const business = await prisma.business.findFirst({
    where: { organizationId: orgId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (!business) {
    return NextResponse.redirect(new URL("/onboarding?error=no-business", req.url));
  }
  await prisma.gbpConnection.upsert({
    where: { businessId: business.id },
    create: {
      businessId: business.id,
      accountName: location.accountName ?? "accounts/primary",
      locationName: location.locationName,
      locationId: location.name, // "locations/{id}"
      accessTokenEnc: encrypt(tokens.access_token),
      refreshTokenEnc: encrypt(tokens.refresh_token),
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scope: tokens.scope,
    },
    update: {
      // rotate tokens, keep ids
      accessTokenEnc: encrypt(tokens.access_token),
      refreshTokenEnc: encrypt(tokens.refresh_token),
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scope: tokens.scope,
      status: "ACTIVE",
      lastSyncError: null,
    },
  });
  return NextResponse.redirect(new URL("/onboarding?step=import", req.url));
}