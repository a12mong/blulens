import { defineConfig, devices } from '@playwright/test';
import path from 'path';

// Load .env files if present (Node 20.12+)
if (typeof (process as any).loadEnvFile === 'function') {
  try { (process as any).loadEnvFile(path.resolve(__dirname, '../../.env')); } catch {}
  try { (process as any).loadEnvFile(path.resolve(__dirname, '.env')); } catch {}
}

/**
 * Playwright E2E configuration for @blulens/web.
 *
 * Requirements (from bl-21 smoke packet):
 * - baseURL: http://localhost:3190 (web dev port for tests, overridden by PLAYWRIGHT_BASE_URL)
 * - Single worker (deterministic sequential execution)
 * - Chromium only
 * - trace: 'on-first-retry'
 * - Setup project for single login per role (avoids 10/min rate limit)
 * - No auto-spawned webServer (server booted independently or via orchestrator)
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3190',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'api',
      testMatch: /.*\.api\.spec\.ts/,
    },
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      dependencies: ['setup'],
      testIgnore: [/auth\.setup\.ts/, /.*\.api\.spec\.ts/],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
