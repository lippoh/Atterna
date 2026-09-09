#!/usr/bin/env node
// scripts/verify-cron-routing.mjs — production-style cron regression
// (Step 8 fix pack). Kept separate from verify-webhook-routing.mjs so
// each script owns one surface: this one owns GET /api/cron.
//
// Proves, against a RUNNING build (next build && next start), that:
//   1. GET /api/cron without auth → 401 (fail-closed);
//   2. GET /api/cron with a wrong Bearer → 401;
//   3. GET /api/cron with the correct Bearer → 200 {ok:true,type:sync};
//   4. ?type=weekly-report / ?type=prune / ?type=intel → 200 (and the
//      prune response reports the new "submissions" count);
//   5. ?type=bogus → 400 invalid_cron_type (no fall-through to sync,
//      no job execution);
//   6. an UNAUTHENTICATED bogus type still → 401 (auth runs first,
//      never revealing type dispatch to strangers);
//   7. none of the above is locale-rewritten to /el/api/… or /en/api/…
//      and none redirects (the Stripe-fix middleware regression stays
//      fixed — x-middleware-rewrite and Location are checked on every
//      response).
//
// Usage:
//   CRON_SECRET=the_same_secret_the_server_uses \
//     node scripts/verify-cron-routing.mjs --url http://localhost:3000
//
// The secret never leaves the process; only statuses and response
// shapes are printed. A successful run EXECUTES queued work and a
// prune pass — run it against a staging/disposable database, never
// production.
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
const SECRET = process.env.CRON_SECRET ?? "";

if (!SECRET) {
  console.error("CRON_SECRET must be set (the same value the running server uses).");
  process.exit(1);
}

async function get(path, headers = {}) {
  // redirect:"manual" — a locale 307 would otherwise be followed and
  // masked by the final 200.
  return fetch(`${BASE}${path}`, { headers, redirect: "manual" });
}

let failures = 0;
function check(name, ok, detail) {
  const mark = ok ? "PASS" : "FAIL";
  if (!ok) failures += 1;
  console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
}

/** No locale rewrite/redirect on this response (Stripe-fix regression). */
function localeClean(res) {
  const rewrite = res.headers.get("x-middleware-rewrite") ?? "";
  const location = res.headers.get("location") ?? "";
  return (
    !/^\/?(el|en)(\/|$)/.test(rewrite) &&
    !/^\/?(el|en)(\/|$)/.test(location) &&
    ![301, 302, 307, 308].includes(res.status)
  );
}
function localeDetail(res) {
  return `status=${res.status} x-middleware-rewrite=${
    res.headers.get("x-middleware-rewrite") ?? "none"
  } location=${res.headers.get("location") ?? "none"}`;
}

const AUTH = { authorization: `Bearer ${SECRET}` };
const WRONG = { authorization: "Bearer definitely-not-the-secret" };

// 1. Fail-closed: no auth → 401 (never 400/404/307 — route reached).
{
  const res = await get("/api/cron");
  const text = await res.text().catch(() => "");
  check(
    "GET /api/cron (no auth) returns 401, locale-clean",
    res.status === 401 && localeClean(res),
    localeDetail(res)
  );
  check("401 body is {error:unauthorized}", text.includes('"unauthorized"'), text.slice(0, 40));
}

// 2. Wrong secret → 401.
{
  const res = await get("/api/cron", WRONG);
  check(
    "GET /api/cron (wrong Bearer) returns 401, locale-clean",
    res.status === 401 && localeClean(res),
    localeDetail(res)
  );
}

// 3. Correct secret → 200 {ok:true, type:"sync"} — the default pipeline.
{
  const res = await get("/api/cron", AUTH);
  const text = await res.text().catch(() => "");
  check(
    "GET /api/cron (correct Bearer) returns 200, locale-clean",
    res.status === 200 && localeClean(res),
    localeDetail(res)
  );
  check(
    "sync response shape {ok:true, type:sync}",
    text.includes('"ok":true') && text.includes('"type":"sync"'),
    text.slice(0, 80)
  );
}

// 4a. weekly-report → 200, and ONLY the weekly pipeline ran (the
// response carries sent/failed/skipped — no enqueued/executed keys).
{
  const res = await get("/api/cron?type=weekly-report", AUTH);
  const text = await res.text().catch(() => "");
  check(
    "GET /api/cron?type=weekly-report returns 200, locale-clean",
    res.status === 200 && localeClean(res),
    localeDetail(res)
  );
  check(
    "weekly-report response is the weekly pipeline (sent/failed/skipped, no sync keys)",
    text.includes('"type":"weekly-report"') &&
      text.includes('"sent"') &&
      !text.includes('"executed"'),
    text.slice(0, 80)
  );
}

// 4b. prune → 200 with the new submissions count.
{
  const res = await get("/api/cron?type=prune", AUTH);
  const text = await res.text().catch(() => "");
  check(
    "GET /api/cron?type=prune returns 200, locale-clean",
    res.status === 200 && localeClean(res),
    localeDetail(res)
  );
  check(
    "prune response reports jobs, ipHashes AND submissions",
    text.includes('"type":"prune"') &&
      text.includes('"jobs"') &&
      text.includes('"ipHashes"') &&
      text.includes('"submissions"'),
    text.slice(0, 80)
  );
}

// 4c. intel → 200.
{
  const res = await get("/api/cron?type=intel", AUTH);
  const text = await res.text().catch(() => "");
  check(
    "GET /api/cron?type=intel returns 200, locale-clean",
    res.status === 200 && localeClean(res),
    localeDetail(res)
  );
  check(
    "intel response is the intel pipeline (enqueued/executed)",
    text.includes('"type":"intel"') && text.includes('"executed"'),
    text.slice(0, 80)
  );
}

// 5. Bogus type → 400 invalid_cron_type, no job execution.
{
  const res = await get("/api/cron?type=bogus", AUTH);
  const text = await res.text().catch(() => "");
  check(
    "GET /api/cron?type=bogus returns 400, locale-clean",
    res.status === 400 && localeClean(res),
    localeDetail(res)
  );
  check(
    "bogus type body is {error:invalid_cron_type}",
    text.includes('"invalid_cron_type"'),
    text.slice(0, 60)
  );
}

// 6. Auth runs FIRST: an unauthenticated bogus type → 401 (not 400) —
// the route must not reveal its type dispatch to strangers.
{
  const res = await get("/api/cron?type=bogus");
  check(
    "GET /api/cron?type=bogus WITHOUT auth returns 401 (auth before type)",
    res.status === 401,
    `status=${res.status}`
  );
}

// 7. Case-sensitivity: type=BOGUS is equally invalid → 400.
{
  const res = await get("/api/cron?type=BOGUS", AUTH);
  check(
    "GET /api/cron?type=BOGUS returns 400",
    res.status === 400,
    `status=${res.status}`
  );
}

console.log(failures === 0 ? "\nAll cron routing checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
