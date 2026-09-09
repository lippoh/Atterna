// tests/db-url.ts — which database is the test process allowed to touch?
//
// tests/unit/tenant-isolation.test.ts is a REAL integration suite: its
// resetTestDb() helper TRUNCATES every table in the target database
// (RESTART IDENTITY CASCADE) on every run. Pointing it at the wrong
// database destroys data, so the choice of URL is made here explicitly
// instead of letting src/lib/db.ts fall back to whatever DATABASE_URL
// happens to be loaded:
//
//   1. TEST_DATABASE_URL always wins — you opt ANY database into test
//      duty with it (local Postgres, a disposable Neon branch, a CI
//      service container). Use it for everything that is not loopback.
//   2. Without TEST_DATABASE_URL, a loopback DATABASE_URL is accepted —
//      truncating your own local dev database is the normal test flow.
//   3. A remote DATABASE_URL (e.g. your production Neon host) is refused
//      with an actionable message instead of wiping it.
//
// Why this module exists: the Prisma CLI loads .env through
// prisma7.config.ts ("import 'dotenv/config'"), but Vitest loads nothing
// on its own — tests/setup.ts closes that gap with the same dotenv call
// before any test module (including src/lib/db.ts) is imported.

export interface TestDatabaseResolution {
  url?: string;
  error?: string;
}

const POSTGRES_URL = /^postgres(?:ql)?:\/\//i;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

export function resolveTestDatabaseUrl(
  env: NodeJS.ProcessEnv
): TestDatabaseResolution {
  const explicit = env.TEST_DATABASE_URL?.trim();
  const fallback = env.DATABASE_URL?.trim();

  if (explicit) {
    if (!POSTGRES_URL.test(explicit)) {
      return {
        error:
          `TEST_DATABASE_URL is set but is not a PostgreSQL URL: "${explicit}". ` +
          "The tenant-isolation suite needs a real Postgres (local Postgres or a Neon branch).",
      };
    }
    return { url: explicit };
  }

  if (!fallback) {
    return {
      error:
        "No database URL is visible to the test process. Vitest does not load .env by " +
        "itself; tests/setup.ts loads it via dotenv (the same way prisma7.config.ts " +
        "does for the Prisma CLI). Create a .env (see .env.example) with " +
        "TEST_DATABASE_URL pointing at a disposable test database.",
    };
  }

  if (!POSTGRES_URL.test(fallback)) {
    return {
      error:
        `DATABASE_URL is not a PostgreSQL URL: "${fallback}". The pg driver silently ` +
        "falls back to its localhost defaults, the connection is refused (an " +
        "AggregateError with an EMPTY message), and Prisma 7 reports it as a cryptic " +
        '"Invalid prisma.$queryRaw() invocation" during test setup. Set ' +
        "TEST_DATABASE_URL to a disposable Postgres database.",
    };
  }

  const host = hostOf(fallback);
  if (host && LOOPBACK_HOSTS.has(host)) {
    return { url: fallback };
  }

  return {
    error:
      `Refusing to run the tenant-isolation suite against remote DATABASE_URL host ` +
      `"${host ?? "unknown"}": resetTestDb() TRUNCATES every table. Set ` +
      "TEST_DATABASE_URL to a disposable database (local Postgres or a Neon branch) " +
      "in .env — never point the tests at your production database.",
  };
}
