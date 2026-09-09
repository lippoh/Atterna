// tests/setup.ts — Vitest setupFiles entry (runs before every test file).
//
// Root cause this fixes: the Prisma CLI loads .env via prisma7.config.ts
// ("import 'dotenv/config'"), but a plain `vitest run` loads nothing. The
// test process therefore started with no usable DATABASE_URL; src/lib/db.ts
// built pg.Pool({ connectionString: undefined }), pg silently fell back to
// its localhost defaults, the connection was refused (an AggregateError with
// an EMPTY message), and Prisma 7 surfaced that as the cryptic
// "PrismaClientKnownRequestError: Invalid prisma.$queryRaw() invocation"
// during test setup — exactly the two failures in
// tests/unit/tenant-isolation.test.ts.
//
// What this file does:
//   1. loads the repo-root .env (dotenv — already a runtime dependency),
//      mirroring prisma7.config.ts for the CLI;
//   2. resolves which database the tests may touch (tests/db-url.ts) and
//      reroutes process.env.DATABASE_URL to it BEFORE any test module is
//      imported — src/lib/db.ts reads it at import time, and Vitest
//      imports test files only after setup files;
//   3. never throws on its own: the five database-free suites must keep
//      running when no test database is configured. The database-backed
//      suite fails fast (with the explanation) from tests/unit/helpers.ts.
import "dotenv/config";
import { resolveTestDatabaseUrl } from "./db-url";

const resolution = resolveTestDatabaseUrl(process.env);
if (resolution.url) {
  // Route the app's Prisma singleton at the disposable test database.
  process.env.DATABASE_URL = resolution.url;
} else if (resolution.error) {
  console.warn(`[tests/setup] ${resolution.error}`);
}
