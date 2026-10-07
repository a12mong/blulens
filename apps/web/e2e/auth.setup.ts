import { test as setup, expect } from '@playwright/test';
import {
  SELECTORS,
  ROUTES,
  AUTH_DIR,
  ADMIN_AUTH_FILE,
  COMMITTEE_AUTH_FILE,
  MEMBER_AUTH_FILE,
} from './selectors';
import fs from 'fs';

function ensureAuthDir() {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }
}

setup('authenticate as admin', async ({ page }) => {
  ensureAuthDir();
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  expect(email, 'SEED_ADMIN_EMAIL environment variable must be set').toBeTruthy();
  expect(password, 'SEED_ADMIN_PASSWORD environment variable must be set').toBeTruthy();

  await page.goto(ROUTES.login);
  await expect(page.getByTestId(SELECTORS.login.identifier)).toBeVisible({ timeout: 20000 });
  await page.getByTestId(SELECTORS.login.identifier).fill(email!);
  await page.getByTestId(SELECTORS.login.password).fill(password!);
  await page.getByTestId(SELECTORS.login.submit).click();

  await expect(page).not.toHaveURL(/\/login$/, { timeout: 20000 });
  await page.context().storageState({ path: ADMIN_AUTH_FILE });
});

setup('authenticate as committee', async ({ page }) => {
  ensureAuthDir();
  const email = 'committee@blulens.local';
  const password = process.env.SEED_DEMO_PASSWORD || process.env.SEED_ADMIN_PASSWORD;

  expect(password, 'SEED_DEMO_PASSWORD or SEED_ADMIN_PASSWORD must be set for committee auth').toBeTruthy();

  await page.goto(ROUTES.login);
  await expect(page.getByTestId(SELECTORS.login.identifier)).toBeVisible({ timeout: 20000 });
  await page.getByTestId(SELECTORS.login.identifier).fill(email);
  await page.getByTestId(SELECTORS.login.password).fill(password!);
  await page.getByTestId(SELECTORS.login.submit).click();

  await expect(page).not.toHaveURL(/\/login$/, { timeout: 20000 });
  await page.context().storageState({ path: COMMITTEE_AUTH_FILE });
});

setup('authenticate as member1', async ({ page }) => {
  ensureAuthDir();
  const email = 'member1@blulens.local';
  const password = process.env.SEED_DEMO_PASSWORD || process.env.SEED_ADMIN_PASSWORD;

  expect(password, 'SEED_DEMO_PASSWORD or SEED_ADMIN_PASSWORD must be set for member auth').toBeTruthy();

  await page.goto(ROUTES.login);
  await expect(page.getByTestId(SELECTORS.login.identifier)).toBeVisible({ timeout: 20000 });
  await page.getByTestId(SELECTORS.login.identifier).fill(email);
  await page.getByTestId(SELECTORS.login.password).fill(password!);
  await page.getByTestId(SELECTORS.login.submit).click();

  await expect(page).not.toHaveURL(/\/login$/, { timeout: 20000 });
  await page.context().storageState({ path: MEMBER_AUTH_FILE });
});
