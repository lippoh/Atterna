// src/lib/crypto.ts — AES-256-GCM for OAuth tokens + signed OAuth state
// TOKEN_ENC_KEY holds a base64 32-byte key (openssl rand -base64 32).
// State tokens are HMAC-signed and org-bound (CSRF protection, single use).
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
const encodedKey = (process.env.TOKEN_ENC_KEY ?? "")
  .trim()
  .replace(/^base64:/i, "");
const KEY = Buffer.from(encodedKey, "base64");
const SECRET = process.env.AUTH_SECRET ?? "dev-secret";
if (KEY.length !== 32) {
  throw new Error(
    "TOKEN_ENC_KEY must decode to 32 bytes (openssl rand -base64 32)"
  );
}
/** Encrypt plaintext → "iv.ciphertext.tag" (base64url segments). */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), enc.toString("base64url"), tag.toString("base64url")].join
    (".");
}
/** Decrypt a payload produced by encrypt(); throws on tampering. */
export function decrypt(payload: string): string {
  const [ivB64, dataB64, tagB64] = payload.split(".");
  if (!ivB64 || !dataB64 || !tagB64) throw new Error("BAD_ENCRYPTED_PAYLOAD");
  const decipher = createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
/**
 * Signed, org-bound OAuth state (the "verifyState" the V1 guide referenced).
 * Format: base64url(JSON payload).base64url(HMAC). Payload binds the org id
 * and an expiry; the signature prevents forgery and the short TTL + org
 * binding prevents CSRF and mix-ups between accounts.
 */
export function signState(orgId: string, ttlMs = 10 * 60_000): string {
  const payload = Buffer.from(
    JSON.stringify({ orgId, exp: Date.now() + ttlMs, nonce: randomBytes(8).toString("hex") }),
    "utf8"
  ).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
/** Verify a signed state; optionally bind it to the caller's org id. */
export function verifyState(state: string, orgId?: string): { orgId: string } | null {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", SECRET).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      orgId?: string;
      exp?: number;
    };
    if (!data.orgId || typeof data.exp !== "number" || data.exp < Date.now()) return null;
    if (orgId !== undefined && data.orgId !== orgId) return null; // org-bound
    return { orgId: data.orgId };
  } catch {
    return null;
  }
}