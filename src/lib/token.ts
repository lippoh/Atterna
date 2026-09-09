// src/lib/tokens.ts — signed one-time tokens (email verify, password reset)
// Email verification: 24-hour expiry. Password reset: 1-hour expiry and
// single-use in effect — resetPasswordAction stamps User.passwordChangedAt,
// and any token issued before that instant is rejected.
// Step 7: AUTH_SECRET is read lazily through the validated env proxy —
// there is no silent "dev-secret" fallback any more. A deployment
// without AUTH_SECRET fails loudly (env.ts names the variable) the first
// time a verify/reset token is signed, instead of silently signing with
// a publicly-known constant.
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
export type TokenKind = "verify" | "reset";
function secret(): string {
  return env.AUTH_SECRET as string;
}
interface TokenPayload {
  identifier: string; // user email (lowercase)
  kind: TokenKind;
  iat: number; // issued at (epoch ms)
  exp: number; // expiry (epoch ms)
}
const DEFAULT_TTL: Record<TokenKind, number> = {
  verify: 24 * 60 * 60_000,
  reset: 60 * 60_000,
};
function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}
function sign(data: string): string {
  return createHmac("sha256", secret()).update(data, "utf8").digest("base64url");
}
/** Create a signed token for an identifier. */
export function createToken(
  identifier: string,
  kind: TokenKind,
  ttlMs = DEFAULT_TTL[kind]
): string {
  const payload: TokenPayload = {
    identifier: identifier.toLowerCase(),
    kind,
    iat: Date.now(),
    exp: Date.now() + ttlMs,
  };
  const data = b64url(JSON.stringify(payload));
  return `${data}.${sign(data)}`;
}
/** Verify signature + expiry; returns the payload or null. */
export function verifyToken(
  token: string
): { identifier: string; kind: TokenKind; iat: number } | null {
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = sign(data);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(data, "base64url").toString("utf8")
    ) as TokenPayload;
    if (
      typeof payload.identifier !== "string" ||
      (payload.kind !== "verify" && payload.kind !== "reset") ||
      typeof payload.exp !== "number" ||
      payload.exp < Date.now()
    ) {
      return null;
    }
    return { identifier: payload.identifier, kind: payload.kind, iat: payload.iat };
  } catch {
    return null;
  }
}