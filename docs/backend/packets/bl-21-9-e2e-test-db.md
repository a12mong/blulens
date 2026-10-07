PACKET bl-21-9: API e2e tests run against their own database (<dev db>_test), never the demo DB

Assignee: Angela (angela-muxswccx) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp) · QA: Dwight (dwight-muxsq5jb)

GOAL:
  `pnpm test` in apps/api must stop leaving rows in the shared demo DB. It runs against a separate database on the same
  Postgres (default name: <dev db name>_test), migrated and seeded automatically before the suites run.

STATE:
  Your worktree. Branch dev/bl-21-e2e-test-db from origin/develop (5f7f1d9 or later).
  Already exists: apps/api/test/jest-e2e.json (setupFiles: test/setup-env.ts); apps/api/test/setup-env.ts (loads the
  repo-root .env into process.env with ??=); apps/api/package.json script "test" (prisma generate && jest --config
  test/jest-e2e.json --runInBand); apps/api/prisma/seed.ts (seeds admin + active rubric 'grading-v1'; demo data only
  with SEED_DEMO=1). docker/postgres-init.sql gives role blulens_app CREATEDB, so the app role can create the test DB.

SPEC:
  Files (ONLY these 5):
    apps/api/test/test-db.ts (new): export function testDatabaseUrl(env: NodeJS.ProcessEnv): string
      - env.TEST_DATABASE_URL if set; else env.DATABASE_URL with the database path segment replaced by '<name>_test'
        (keep user, host, port and query). Throw if DATABASE_URL is missing.
      - Throw if the result equals env.DATABASE_URL (refuse to test on the dev DB).
    apps/api/test/global-setup.ts (new, jest globalSetup): load .env the same way setup-env.ts does, url =
      testDatabaseUrl(process.env), then run with env DATABASE_URL=url (child_process.execSync, cwd apps/api):
        `prisma migrate deploy` (creates the DB if missing; if not, create it first with CREATE DATABASE through a
        connection to the 'postgres' database) and `tsx prisma/seed.ts` (no SEED_DEMO).
      Log only the database NAME, never the URL (it contains a password).
    apps/api/test/setup-env.ts: after loading .env, set process.env.DATABASE_URL = testDatabaseUrl(process.env)
      (overwrite, not ??=), so the tests' PrismaClient and the app's PrismaService both use the test DB.
    apps/api/test/jest-e2e.json: add "globalSetup": "<rootDir>/test/global-setup.ts".
    apps/api/test/test-db.e2e-spec.ts (new), the test that proves it:
      - testDatabaseUrl({ DATABASE_URL: 'postgresql://u:p@h:5442/blulens?schema=public' }) === 'postgresql://u:p@h:5442/blulens_test?schema=public'
      - TEST_DATABASE_URL wins; a TEST_DATABASE_URL equal to DATABASE_URL throws; missing DATABASE_URL throws
      - inside the suite, prisma.$queryRaw`SELECT current_database()` returns a name ending in '_test'

CONSTRAINTS:
  - All 13 existing suites stay green, now on the test DB (they create their own data; the active rubric comes from
    global-setup's seed).
  - Do not drop or reset any database. Never print URLs or passwords.
  - Do not touch apps/web or docs/qa: Dwight owns the Playwright run doc and will point the e2e API server at this DB.

TOOLS:
  cd apps/api && pnpm test   (twice: the second run, with the DB already present, must also pass)
  Count tournaments in the dev DB (dev DATABASE_URL) before and after a full run: unchanged.

DONE:
  One commit on dev/bl-21-e2e-test-db. Done message to Kevin (cc dwight-muxsq5jb): both test run results, the dev-DB
  before/after counts, and the env var Dwight should use for Playwright (TEST_DATABASE_URL, default <db>_test).
