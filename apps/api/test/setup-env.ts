import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

// e2e tests read DATABASE_URL etc. from the repo-root .env (same file the dev servers use).
// Assign into process.env here: Jest gives each test file its own copy of process.env, so
// process.loadEnvFile (which writes to the real process) would not reach the test.
const envFile = resolve(__dirname, '../../../.env');
if (existsSync(envFile)) {
  for (const [key, value] of Object.entries(parseEnv(readFileSync(envFile, 'utf8')))) {
    process.env[key] ??= value;
  }
}
process.env.DISABLE_RATE_LIMIT = '1';
