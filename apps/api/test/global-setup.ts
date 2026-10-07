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

  // Try to create the database if it doesn't exist
  try {
    const postgresUrl = new URL(env.DATABASE_URL!);
    postgresUrl.pathname = '/postgres'; // Connect to 'postgres' database to issue CREATE DATABASE
    const createDbCommand = `psql "${postgresUrl.toString()}" -c "CREATE DATABASE ${testDbName};" 2>/dev/null || true`;
    execSync(createDbCommand, { cwd: resolve(__dirname, '..') });
  } catch {
    // Ignore errors; database might already exist
  }

  // Run migrations
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
