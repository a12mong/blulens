import { test, expect, type APIRequestContext, type APIResponse, type Locator } from '@playwright/test';
import { execFileSync } from 'child_process';
import { randomUUID } from 'crypto';
import { ROUTES, REVIEWER_AUTH_FILE } from './selectors';

/**
 * Slice 2 gate (reviewer scoring path), see docs/qa/slice2-e2e.md.
 * Member creates assessment -> clip row (SQL, status uploaded) -> submit -> Committee assigns reviewer1+2
 * -> reviewer1 UI: queue shows task -> scoring page (clip player + rubric) -> draft survives reload
 * -> confirm-and-lock -> task leaves open queue; API cross-check.
 * SQL goes ONLY to DB blulens_e2e (name hard-coded below; never blulens_demo).
 */

const API_BASE = (process.env.API_URL ?? 'http://localhost:3191').replace(/\/+$/, '') + '/api/v1/';
const PG_CONTAINER = process.env.E2E_PG_CONTAINER ?? 'blulens-postgres';
const PG_USER = process.env.E2E_PG_USER ?? 'blulens';
// Clip.object_key is UNIQUE: convention '/e2e/sample.mp4?c=<clipId>' (returned as viewUrl as-is).
const SAMPLE_KEY = '/e2e/sample.mp4';

async function data<T = any>(res: APIResponse): Promise<T> {
  const json = await res.json();
  return (json && typeof json === 'object' && 'data' in json ? json.data : json) as T;
}

function sqlE2e(sql: string): string {
  return execFileSync(
    'docker',
    ['exec', PG_CONTAINER, 'psql', '-U', PG_USER, '-d', 'blulens_e2e', '-tA', '-c', sql],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')[0];
}

async function login(ctx: APIRequestContext, identifier: string, password: string) {
  const res = await ctx.post('auth/login', { data: { identifier, password } });
  expect(res.status(), `login ${identifier}`).toBe(200);
}

/** Pick the first selectable grade in a rubric card (opens a tier first when the picker is tiered). */
async function pickGrade(card: Locator) {
  const keys = card.locator('[data-testid^="gp-key-"]');
  if (!(await keys.first().isVisible().catch(() => false))) {
    await card.locator('[data-testid^="gp-tier-"]').first().click();
  }
  await card.locator('[data-testid^="gp-key-"]:visible').first().click();
}

test.describe.serial('bl-24 slice 2: reviewer scoring path', () => {
  let memberCtx: APIRequestContext;
  let committeeCtx: APIRequestContext;
  let assessmentId = '';
  let assignmentId = '';
  let reviewer1Id = '';
  let reviewer2Id = '';

  const taskLink = (page: import('@playwright/test').Page) =>
    page.locator(`a[data-testid="review-card-action"][href="/review/tasks/${assignmentId}"]`);

  test.beforeAll(async ({ playwright }) => {
    const pw = process.env.SEED_DEMO_PASSWORD;
    if (!pw) throw new Error('SEED_DEMO_PASSWORD must be set (no defaults)');
    memberCtx = await playwright.request.newContext({ baseURL: API_BASE });
    committeeCtx = await playwright.request.newContext({ baseURL: API_BASE });
    await login(memberCtx, 'member1@blulens.local', pw);
    await login(committeeCtx, 'committee@blulens.local', pw);

    reviewer1Id = sqlE2e("select id from users where email='reviewer1@blulens.local'");
    reviewer2Id = sqlE2e("select id from users where email='reviewer2@blulens.local'");
    expect(reviewer1Id, 'reviewer1 missing: apply docs/qa/slice2-e2e-seed.sql on blulens_e2e').toMatch(/^[0-9a-f-]{36}$/);
    expect(reviewer2Id, 'reviewer2 missing: apply docs/qa/slice2-e2e-seed.sql on blulens_e2e').toMatch(/^[0-9a-f-]{36}$/);
  });

  test('S1 member creates assessment, clip inserted (uploaded), member submits', async () => {
    const create = await memberCtx.post('assessments', { data: { note: `e2e slice2 ${Date.now()}` } });
    expect(create.status(), await create.text()).toBe(201);
    assessmentId = (await data(create)).id;
    expect(assessmentId).toBeTruthy();

    const newClipId = randomUUID();
    const clipId = sqlE2e(
      `insert into clips (id, assessment_id, object_key, status, content_type, created_at) ` +
        `values ('${newClipId}', '${assessmentId}', '${SAMPLE_KEY}?c=${newClipId}', 'uploaded', 'video/mp4', now()) returning id`,
    );
    expect(clipId).toMatch(/^[0-9a-f-]{36}$/);

    const submit = await memberCtx.post(`assessments/${assessmentId}/submit`);
    expect(submit.status(), await submit.text()).toBe(200);
    expect((await data(submit)).status).toBe('submitted');
  });

  test('S2 committee assigns reviewer1 + reviewer2', async () => {
    const res = await committeeCtx.post(`assessments/${assessmentId}/assign`, {
      data: { reviewerIds: [reviewer1Id, reviewer2Id] },
    });
    expect(res.status(), await res.text()).toBe(200);
    expect((await data(res)).status).toBe('in_review');

    assignmentId = sqlE2e(
      `select id from review_assignments where assessment_id='${assessmentId}' and reviewer_id='${reviewer1Id}'`,
    );
    expect(assignmentId).toMatch(/^[0-9a-f-]{36}$/);
  });

  test.describe('reviewer1 UI', () => {
    test.use({ storageState: REVIEWER_AUTH_FILE });

    test('S3 /review queue shows the task with a start action', async ({ page }) => {
      await page.goto(ROUTES.reviewQueue);
      await expect(taskLink(page), 'queue must list the assigned task').toBeVisible({ timeout: 20000 });
    });

    test('S4 task page: clip player + rubric cards, submit disabled until complete', async ({ page }) => {
      await page.goto(ROUTES.reviewTask(assignmentId));
      await expect(page.getByTestId('scoring-error')).toHaveCount(0);
      await expect(page.getByTestId('clip-player')).toBeVisible({ timeout: 20000 });
      await expect(page.getByTestId('clip-not-ready'), "status 'uploaded' must play").toHaveCount(0);
      await expect(page.getByTestId('clip-video')).toBeVisible();
      expect(await page.getByTestId('rubric-item').count(), 'rubric cards').toBeGreaterThan(0);
      await expect(page.getByTestId('scoring-submit')).toBeDisabled();
    });

    test('S5 local draft survives reload', async ({ page }) => {
      await page.goto(ROUTES.reviewTask(assignmentId));
      const first = page.getByTestId('rubric-item').first();
      await expect(first).toHaveAttribute('data-answered', 'false', { timeout: 20000 });
      await pickGrade(first);
      await expect(first).toHaveAttribute('data-answered', 'true');
      await page.getByTestId('scoring-comment').fill('e2e draft comment');
      await page.reload();
      await expect(page.getByTestId('rubric-item').first()).toHaveAttribute('data-answered', 'true', { timeout: 20000 });
      await expect(page.getByTestId('scoring-comment')).toHaveValue('e2e draft comment');
    });

    test('S6 score all, cancel keeps open, confirm-and-lock submits via PUT and leaves queue', async ({ page }) => {
      await page.goto(ROUTES.reviewTask(assignmentId));
      const items = page.getByTestId('rubric-item');
      await expect(items.first()).toBeVisible({ timeout: 20000 });
      const n = await items.count();
      for (let i = 0; i < n; i++) {
        if ((await items.nth(i).getAttribute('data-answered')) !== 'true') await pickGrade(items.nth(i));
      }
      await expect(page.getByTestId('scoring-submit')).toBeEnabled();

      await page.getByTestId('scoring-submit').click();
      await page.getByTestId('scoring-cancel').click();
      await expect(page.getByTestId('scoring-confirm')).toHaveCount(0);
      expect(page.url()).toContain(`/review/tasks/${assignmentId}`);

      await page.getByTestId('scoring-submit').click();
      const put = page.waitForResponse(
        (r) => r.url().includes(`/reviews/assignments/${assignmentId}`) && r.request().method() === 'PUT',
      );
      await page.getByTestId('scoring-confirm').click();
      const res = await put;
      expect(res.status(), await res.text()).toBe(200);
      await expect(page).toHaveURL(/\/review$/, { timeout: 20000 });
      await expect(taskLink(page)).toHaveCount(0);
    });

    test('S7 API cross-check: listed as submitted, second submit rejected', async ({ playwright }) => {
      const ctx = await playwright.request.newContext({ baseURL: API_BASE });
      await login(ctx, 'reviewer1@blulens.local', process.env.SEED_DEMO_PASSWORD!);
      const mine = await ctx.get('reviews/assignments/me?state=submitted');
      expect(mine.status()).toBe(200);
      const body = await data<any>(mine);
      const items: any[] = Array.isArray(body) ? body : (body.items ?? []);
      expect(items.some((a) => a.id === assignmentId), 'assignment listed as submitted').toBe(true);

      const again = await ctx.put(`reviews/assignments/${assignmentId}`, {
        data: { scores: [], comment: 'second try' },
      });
      expect(again.status(), 'locked assignment must not accept a second submit').toBeGreaterThanOrEqual(400);
    });
  });
});
