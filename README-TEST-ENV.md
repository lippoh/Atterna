# Atterna — Test-Environment Fix (tenant-isolation suite)

Baseline: your current `master` (8e18c86, "refactor: Multi-Source
Reputation Intelligence"). This zip contains **8 new/changed files** —
the complete delta. **No production code is touched** (`src/`, Prisma
schema, and migrations are byte-identical to your master), no test
assertion is weakened, skipped, or mocked.

## 1. Root cause

`PrismaClientKnownRequestError: Invalid prisma.$queryRaw() invocation`
(both tenant-isolation tests failing during setup at
`tests/unit/helpers.ts:11`) is **not a Prisma or code bug** — it is
Prisma's generic wrapper around a failed raw query. The underlying error
is a pg-driver `ECONNREFUSED` **with an empty message** (an
`AggregateError`), which is why nothing useful is printed after the
colon.

Why the connection was refused:

- `src/lib/db.ts` reads `process.env.DATABASE_URL` **at import time** and
  builds `pg.Pool({ connectionString })` through the Prisma 7 driver
  adapter (`@prisma/adapter-pg`).
- The **Prisma CLI** loads `.env` via `prisma7.config.ts`
  (`import "dotenv/config"`), so `prisma migrate …` commands see your
  database URL.
- **Vitest loads nothing.** `vitest.config.ts` had no `setupFiles` and no
  dotenv, and `pnpm test` = bare `vitest run`. With `DATABASE_URL`
  invisible to the test process, `pg.Pool` silently falls back to its
  localhost defaults (`localhost:5432`, OS user, no password) → connection
  refused → the cryptic empty-message error, before any tenant-isolation
  assertion runs.

Verified end-to-end: with a valid URL the same `$queryRaw` call succeeds
(the failure then only moves to missing tables on an unmigrated
database); with no URL it reproduces your exact error, including the
empty message body.

Two adjacent environment defects were confirmed and fixed:

- The CI `test` job ran `vitest run` with **no database at all**.
- A **fresh test database cannot be provisioned by `prisma migrate
  deploy`**: the repo's only migration is additive-only (it `ALTER`s
  `Review` and adds FKs to `Business`, which don't exist on an empty
  database). Fresh dev/test databases must be provisioned with
  `prisma db push` instead (safe on disposable databases only).

## 2. Files changed

| File | Change |
|---|---|
| `tests/setup.ts` | NEW — Vitest `setupFiles` entry: loads `.env` (dotenv, like `prisma7.config.ts`), routes the Prisma singleton at the test database **before** any test module imports `@/lib/db` |
| `tests/db-url.ts` | NEW — the test-database resolver: `TEST_DATABASE_URL` wins; loopback `DATABASE_URL` allowed; remote `DATABASE_URL` **refused** (protects production) |
| `tests/unit/helpers.ts` | fail-fast guard at import: throws the resolver's actionable message instead of dying inside Prisma's empty wrapper; assertions untouched |
| `vitest.config.ts` | adds `setupFiles: ["tests/setup.ts"]` |
| `.github/workflows/ci.yml` | `test` job: `postgres:17` service container, `DATABASE_URL`/`TEST_DATABASE_URL`, `prisma db push` provisioning step before `vitest run` |
| `.env.example` | NEW — documents `DATABASE_URL` and `TEST_DATABASE_URL` |
| `.gitignore` | `!.env.example` (the `.env*` pattern was hiding the template) |
| `README-INSTALL.md` | new "Running the test suite" section |

## 3. Why the fix is correct

- It fixes the actual root cause (the test process's environment),
  mirroring exactly what the Prisma CLI already does — nothing about
  Prisma, the adapter, `$queryRaw`, the schema, or the app's runtime
  changes.
- The tenant-isolation suite still runs **real database isolation
  tests** against **real Postgres** — no mocks, no skips, no weakened
  assertions (both tests seed two orgs and assert cross-tenant
  invisibility through the actual Prisma queries).
- The TRUNCATE-based `resetTestDb()` can no longer silently run against
  whatever `DATABASE_URL` is loaded: a remote/production URL is refused
  with an explicit error (`resetTestDb()` truncates every table).
  CI uses a disposable `postgres:17` service container.

## 4. What YOU must do (once)

```bash
# 1. copy the files over your repo (paths mirror the repo root)

# 2. create a disposable test database — NEVER your production Neon DB.
#    Local Postgres:
createdb atterna_test
#    (or a Neon branch: https://neon.tech/docs/guides/branching —
#     create a branch, copy its connection string)

# 3. add to your .env:
#    TEST_DATABASE_URL=postgresql://postgres@localhost:5432/atterna_test
#    (for a Neon branch: its connection string, sslmode=require)

# 4. provision the schema on that database (db push, NOT migrate deploy —
#    the only migration in the repo is additive-only and cannot build a
#    fresh database):
TEST_DATABASE_URL=postgresql://postgres@localhost:5432/atterna_test \
  pnpm exec prisma db push

# 5. run everything:
pnpm exec prisma generate
pnpm exec prisma migrate status
pnpm test
pnpm exec tsc --noEmit
pnpm build
```

Expected: `Test Files 6 passed (6) · Tests 55 passed (55)`.

Notes:

- `TEST_DATABASE_URL` is **required unless your `DATABASE_URL` points at
  localhost** — an existing remote `DATABASE_URL` is deliberately refused.
- Do **not** run `prisma migrate reset` or the tests against the
  production Neon database. Nothing in this fix ever connects to it.
- Your existing dev/prod databases need **no** migration: the schema is
  unchanged; `prisma migrate status` against them behaves as before.
- CI turns green on the next push with no secrets required (the service
  container is disposable).

## 5. Verified before packing (real Postgres 17.11, Prisma 7.10.0)

| Command | Result |
|---|---|
| `pnpm exec prisma generate` | ✔ Generated Prisma Client (v7.10.0) |
| `pnpm exec prisma migrate status` | ✔ runs; lists the 1 additive migration as not applied on the disposable `db push`-provisioned test DB (expected — no history on disposable databases) |
| `pnpm test` | ✔ **Test Files 6 passed (6) · Tests 55 passed (55)** |
| `pnpm exec tsc --noEmit` | ✔ 0 errors |
| `pnpm build` | ✔ full pass (all routes) |
| no `.env` at all | 5 pure suites keep passing; tenant suite fails fast with a clear, actionable message |
| remote `DATABASE_URL` (prod-like) | refused by name before any connection; nothing truncated |
