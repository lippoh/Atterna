// src/integrations/gbp/client.ts — Google Business Profile API client
// exchangeCode / refreshIfNeeded / gbpClient / pickFirstLocation — every
// name the V1 guide imported from "./client" exists here. Endpoint base
// and scopes must be re-verified against official docs before launch
// (Table 25.1 / Appendix 62 — the API access model changes).
import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
const AUTH_ENDPOINT = "https://oauth2.googleapis.com/token";
const API_BASE = "https://businessprofile.googleapis.com/v4";
// Scopes: business.manage covers locations + reviews + replies.
export const GBP_SCOPES = [
  "https://www.googleapis.com/auth/business.manage",
].join(" ");
export interface GbpTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  scope: string;
}
export interface GbpLocation {
  name: string; // "locations/{id}"
  locationName: string;
  accountName?: string;
  businessId?: string; // internal (filled by pickFirstLocation caller)
  metadata?: { placeId?: string }; // Maps place id (write-review deep link)
}
export interface GbpReview {
  name: string; // "locations/{id}/reviews/{reviewId}"
  reviewId?: string;
  starRating?: number;
  comment?: string;
  reviewer?: { displayName?: string };
  createTime?: string; // RFC3339
}
async function tokenRequest(body: Record<string, string>): Promise<GbpTokens> {
  const res = await fetch(AUTH_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      ...body,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`GBP token endpoint failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as GbpTokens;
}
/** OAuth authorization-code exchange (includes refresh_token). */
export async function exchangeCode(code: string, redirectUri: string): Promise<GbpTokens> {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
}
/**
 * Refresh + persist: decrypts the stored refresh token, mints a fresh
 * access token, re-encrypts both on the GbpConnection row and returns the
 * usable access token. Marks the connection REAUTH when Google refuses.
 */
export async function refreshIfNeeded(conn: {
  id: string;
  refreshTokenEnc: string;
  status: string;
}): Promise<string> {
  if (conn.status === "REVOKED") throw new Error("CONNECTION_REVOKED");
  let refreshToken: string;
  try {
    refreshToken = decrypt(conn.refreshTokenEnc);
  } catch {
    await markReauth(conn.id, "undecryptable refresh token");
    throw new Error("REAUTH_REQUIRED");
  }
  try {
    const tokens = await tokenRequest({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
    await prisma.gbpConnection.update({
      where: { id: conn.id },
      data: {
        accessTokenEnc: encrypt(tokens.access_token),
        refreshTokenEnc: tokens.refresh_token ?? refreshToken,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        status: "ACTIVE",
      },
    });
    return tokens.access_token;
  } catch (error) {
    await markReauth(conn.id, String(error).slice(0, 300));
    throw error;
  }
}
async function markReauth(connectionId: string, reason: string): Promise<void> {
  await prisma.gbpConnection
    .update({
      where: { id: connectionId },
      data: { status: "REAUTH", lastSyncError: reason },
    })
    .catch(() => undefined);
}
async function gbpGet<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${API_BASE}/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    const error = new Error(`GBP ${path} failed (${res.status}): ${text.slice(0, 200)}`);
    (error as Error & { status?: number }).status = res.status;
    throw error;
  }
  return (await res.json()) as T;
}
export const gbpClient = {
  /** List reviews for a location — quota-aware (pageSize, maxPages). */
  async listReviews(opts: {
    accessToken: string;
    locationId: string;
    pageSize?: number;
    maxPages?: number;
  }): Promise<GbpReview[]> {
    const pageSize = opts.pageSize ?? 50;
    const maxPages = opts.maxPages ?? 4;
    const reviews: GbpReview[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < maxPages; page++) {
      const params = new URLSearchParams({
        pageSize: String(pageSize),
        ...(pageToken ? { pageToken } : {}),
      });
      const data = await gbpGet<{ reviews?: GbpReview[]; nextPageToken?: string }>(
        `${opts.locationId}/reviews?${params.toString()}`,
        opts.accessToken
      );
      reviews.push(...(data.reviews ?? []));
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
    return reviews;
  },
  /** Publish / update the owner's reply on a review (update reply). */
  async updateReply(opts: {
    accessToken: string;
    reviewName: string; // "locations/{id}/reviews/{reviewId}"
    text: string;
  }): Promise<{ reply: { comment: string; updateTime?: string } }> {
    const res = await fetch(`${API_BASE}/${opts.reviewName}/reply`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ comment: opts.text }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      const error = new Error(`GBP reply failed (${res.status}): ${text.slice(0, 200)}`);
      (error as Error & { status?: number }).status = res.status;
      throw error;
    }
    return (await res.json()) as { reply: { comment: string; updateTime?: string } };
  },
  /** List locations the signed-in owner can access. */
  async listLocations(accessToken: string): Promise<GbpLocation[]> {
    const accounts = await gbpGet<{ accounts?: { name: string }[] }>(
      "accounts",
      accessToken
    );
    const locations: GbpLocation[] = [];
    for (const account of accounts.accounts ?? []) {
      const data = await gbpGet<{ locations?: GbpLocation[] }>(
        `${account.name}/locations`,
        accessToken
      );
      for (const location of data.locations ?? []) {
        locations.push({ ...location, accountName: account.name });
      }
    }
    return locations;
  },
};
/**
 * First usable location for a just-connected owner (Phase 1: one
 * location per business). The name the V1 oauth.ts referenced.
 */
export async function pickFirstLocation(accessToken: string): Promise<GbpLocation> {
  const locations = await gbpClient.listLocations(accessToken);
  const first = locations[0];
  if (!first) throw new Error("NO_GBP_LOCATION");
  return first;
}