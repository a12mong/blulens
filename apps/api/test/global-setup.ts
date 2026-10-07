import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { testDatabaseUrl } from './test-db';

/**
 * Jest globalSetup hook: runs once before all tests.
 * Creates the test database and runs migrations + seed.
 */
export default async function globalSetup() {
  // Load .env into process.env
  const envFile = resolve(__dirname, '../../../.env');
  const env = { ...process.env };
  if (existsSync(envFile)) {
    for (const [key, value] of Object.entries(parseEnv(readFileSync(envFile, 'utf8')))) {
      env[key] ??= value;
    }
  }

  // Compute test DB URL
  const testUrl = testDatabaseUrl(env);
  const testUrlObj = new URL(testUrl);
  const testDbName = testUrlObj.pathname.split('/').filter(Boolean)[0];

  console.log(`Setting up test database: ${testDbName}`);

  // Run migrations (prisma migrate deploy creates the database if it does not exist yet)
  try {
    execSync('prisma migrate deploy', {
      cwd: resolve(__dirname, '..'),
      env: { ...env, DATABASE_URL: testUrl },
      stdio: 'inherit',
    });
  } catch (error) {
    console.error('Failed to run migrations:', error);
    throw error;
  }

  // Run seed (without SEED_DEMO)
  try {
    execSync('tsx prisma/seed.ts', {
      cwd: resolve(__dirname, '..'),
      env: { ...env, DATABASE_URL: testUrl },
      stdio: 'inherit',
    });
  } catch (error) {
    console.error('Failed to run seed:', error);
    throw error;
  }

  console.log(`Test database ready: ${testDbName}`);
}
