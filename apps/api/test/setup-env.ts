import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { testDatabaseUrl } from './test-db';

// e2e tests read DATABASE_URL etc. from the repo-root .env (same file the dev servers use).
// Assign into process.env here: Jest gives each test file its own copy of process.env, so
// process.loadEnvFile (which writes to the real process) would not reach the test.
const envFile = resolve(__dirname, '../../../.env');
if (existsSync(envFile)) {
  for (const [key, value] of Object.entries(parseEnv(readFileSync(envFile, 'utf8')))) {
    process.env[key] ??= value;
  }
}

// Override DATABASE_URL to use test database
process.env.DATABASE_URL = testDatabaseUrl(process.env);

process.env.DISABLE_RATE_LIMIT = '1';

// Tests upload into their own bucket (created on first use), never the dev clips bucket.
process.env.S3_BUCKET = `${process.env.S3_BUCKET ?? 'clips'}-test`;
