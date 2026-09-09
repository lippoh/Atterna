#!/usr/bin/env node
// scripts/verify-webhook-routing.mjs — production-style webhook regression.
//
// Proves, against a RUNNING build (next build && next start), that:
//   1. POST /api/webhooks/stripe reaches the webhook handler (no next-intl
//      rewrite to /el/api/... or /en/api/..., no 307 redirect);
//   2. missing / invalid Stripe signatures are rejected with 400;
//   3. a validly signed event passes verification and reaches idempotency
//      processing ({ received: true });
//   4. the same event.id delivered again is safely ignored
//      ({ received: true, duplicate: true });
//   5. /api/health is reachable and not locale-rewritten.
//
// Usage:
//   STRIPE_WEBHOOK_SECRET=whsec_the_same_secret_the_server_uses \
//     node scripts/verify-webhook-routing.mjs --url http://localhost:3000
//
// The secret never leaves the process; only statuses are printed. The
// event type ("ping") is ignored by the handler, so the test exercises
// signature verification + idempotency without touching business tables
// beyond the WebhookEvent marker. Requires the server's DATABASE_URL to
// point at a database with the schema applied (a disposable one).
import crypto from "node:crypto";

const args = process.argv.slice(2);
// Accepts both "--url http://…" and "--url=http://…".
const urlIdx = args.findIndex((a) => a === "--url" || a.startsWith("--url="));
const BASE = (
  urlIdx >= 0
    ? args[urlIdx].startsWith("--url=")
      ? args[urlIdx].slice(6)
      : args[urlIdx + 1]
    : (process.env.BASE_URL ?? "http://localhost:3000")
).replace(/\/$/, "");
const SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

if (!SECRET) {
  console.error("STRIPE_WEBHOOK_SECRET must be set (the same value the running server uses).");
  process.exit(1);
}

const eventId = `evt_verify_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
const payload = JSON.stringify({ id: eventId, type: "ping", data: { object: {} } });

function sign(body) {
  const t = Math.floor(Date.now() / 1000);
  const v1 = crypto.createHmac("sha256", SECRET).update(`${t}.${body}`, "utf8").digest("hex");
  return `t=${t},v1=${v1}`;
}

async function post(path, headers = {}, body = payload) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
  const text = await res.text().catch(() => "");
  return { res, text };
}

let failures = 0;
function check(name, ok, detail) {
  const mark = ok ? "PASS" : "FAIL";
  if (!ok) failures += 1;
  console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
}

// 1 + 2. Route reachability: missing and invalid signatures → 400 (NOT
// 404, NOT a 307 redirect — that was the middleware bug).
{
  const { res, text } = await post("/api/webhooks/stripe");
  check("POST /api/webhooks/stripe (no signature) returns 400", res.status === 400, `status=${res.status} body=${text.slice(0, 40)}`);

  const { res: res2, text: text2 } = await post("/api/webhooks/stripe", {
    "stripe-signature": `t=${Math.floor(Date.now() / 1000)},v1=deadbeef`,
  });
  check("POST /api/webhooks/stripe (bogus signature) returns 400", res2.status === 400, `status=${res2.status} body=${text2.slice(0, 40)}`);

  // The English-locale variant that used to 307-redirect to /en/api/...
  const { res: res3 } = await post("/api/webhooks/stripe", {
    "accept-language": "en-US,en;q=0.9",
    "stripe-signature": `t=${Math.floor(Date.now() / 1000)},v1=deadbeef`,
  });
  check(
    "POST with Accept-Language: en is NOT redirected (route reached)",
    res3.status === 400 && ![301, 302, 307, 308].includes(res3.status),
    `status=${res3.status} location=${res3.headers.get("location") ?? "none"}`
  );
}

// 3. A validly signed event passes verification → 200 { received: true }.
{
  const { res, text } = await post("/api/webhooks/stripe", {
    "stripe-signature": sign(payload),
  });
  check("valid signed event reaches idempotency processing (200 received:true)", res.status === 200 && text.includes('"received":true'), `status=${res.status} body=${text.slice(0, 60)}`);
}

// 4. Duplicate event.id is safely ignored.
{
  const { res, text } = await post("/api/webhooks/stripe", {
    "stripe-signature": sign(payload),
  });
  check("duplicate event.id is ignored (200 duplicate:true)", res.status === 200 && text.includes('"duplicate":true'), `status=${res.status} body=${text.slice(0, 60)}`);
}

// 5. /api/health is reachable and never locale-rewritten.
{
  const res = await fetch(`${BASE}/api/health`);
  const rewrite = res.headers.get("x-middleware-rewrite") ?? "";
  check(
    "GET /api/health reachable and not locale-rewritten",
    res.status === 200 && !/^\/?(el|en)(\/|$)/.test(rewrite),
    `status=${res.status} x-middleware-rewrite=${rewrite || "none"}`
  );
}

// 6. Page behavior preserved: the auth guard still redirects
// unauthenticated dashboard requests to /login (through the real
// middleware + routing — proving locale routing did not break).
{
  const res = await fetch(`${BASE}/dashboard`, { redirect: "manual" });
  const location = res.headers.get("location") ?? "";
  check(
    "GET /dashboard (unauthenticated) redirects to /login (auth guard preserved)",
    [302, 307, 308].includes(res.status) && /\/login$|\/login\?/.test(location),
    `status=${res.status} location=${location || "none"}`
  );
}

// 7. Page behavior preserved: public pages serve with the security headers
// set by the middleware (locale routing + headers intact for pages).
{
  const res = await fetch(`${BASE}/login`);
  check(
    "GET /login serves with security headers (pages still middleware-processed)",
    res.status === 200 &&
      res.headers.get("x-frame-options") === "DENY" &&
      res.headers.get("x-content-type-options") === "nosniff",
    `status=${res.status} x-frame-options=${res.headers.get("x-frame-options") ?? "none"}`
  );
}

console.log(failures === 0 ? "\nAll webhook routing checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
