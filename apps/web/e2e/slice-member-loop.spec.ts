import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { MEMBER_AUTH_FILE } from './selectors';

/**
 * Member result loop: member requests (real clip upload) -> reviewers score -> Committee approves -> member opens
 * /me/assessments/{id} (result visible) -> notification bell count -> /notifications -> opens the item -> lands on the detail -> read.
 * The notification steps need GET /me/notifications (Kevin) AND the web built with NEXT_PUBLIC_NOTIFICATIONS=1 (default-on since ad63ee9); the bell/page/read flow is gated in slice-notifications.spec.ts; the API step skips
 * themselves (with the reason) while either is missing. MinIO must be up. SQL: read-only lookups on blulens_e2e.
 * See docs/qa/slice-member-loop-e2e.md.
 */

const API_BASE = (process.env.API_URL ?? 'http://localhost:3191').replace(/\/+$/, '') + '/api/v1/';
const PG_CONTAINER = process.env.E2E_PG_CONTAINER ?? 'blulens-postgres';
const PG_USER = process.env.E2E_PG_USER ?? 'blulens';
const SAMPLE = readFileSync(join(__dirname, '..', 'public', 'e2e', 'sample.mp4'));

function sql(q: string): string {
  return execFileSync('docker', ['exec', PG_CONTAINER, 'psql', '-U', PG_USER, '-d', 'blulens_e2e', '-tA', '-c', q], { encoding: 'utf8' })
    .trim()
    .split('\n')[0];
}
async function data<T = any>(res: APIResponse): Promise<T> {
  const json = await res.json();
  return (json && typeof json === 'object' && 'data' in json ? json.data : json) as T;
}
async function login(ctx: APIRequestContext, identifier: string, password: string) {
  const res = await ctx.post('auth/login', { data: { identifier, password } });
  expect(res.status(), `login ${identifier}`).toBe(200);
}

test.describe.serial('member result loop', () => {
  let memberCtx: APIRequestContext;
  let committeeCtx: APIRequestContext;
  let reviewerCtxs: APIRequestContext[] = [];
  let id = '';
  let unreadBefore = 0;
  let notificationsApi = false;

  test.beforeAll(async ({ playwright }) => {
    const pw = process.env.SEED_DEMO_PASSWORD;
    if (!pw) throw new Error('SEED_DEMO_PASSWORD must be set (no defaults)');
    const mk = () => playwright.request.newContext({ baseURL: API_BASE });
    [memberCtx, committeeCtx] = [await mk(), await mk()];
    reviewerCtxs = [await mk(), await mk()];
    await login(memberCtx, 'member1@blulens.local', pw);
    await login(committeeCtx, 'committee@blulens.local', pw);
    await login(reviewerCtxs[0], 'reviewer1@blulens.local', pw);
    await login(reviewerCtxs[1], 'reviewer2@blulens.local', pw);
    const probe = await memberCtx.get('me/notifications?limit=1');
    notificationsApi = probe.status() === 200;
    if (notificationsApi) unreadBefore = (await data(probe)).unreadCount ?? 0;
  });

  test('L1 member requests with a really uploaded clip; reviewers score; assessment waits for the Committee', async () => {
    const c = await memberCtx.post('assessments', { data: { note: `e2e member loop ${Date.now()}` } });
    expect(c.status(), await c.text()).toBe(201);
    id = (await data(c)).id;
    const up = await memberCtx.post(`assessments/${id}/clips/upload-url`, { data: { fileName: 'sample.mp4', contentType: 'video/mp4', sizeBytes: SAMPLE.length } });
    expect(up.status(), await up.text()).toBe(200);
    const u = await data(up);
    expect((await fetch(u.uploadUrl, { method: 'PUT', body: SAMPLE, headers: { 'Content-Type': 'video/mp4' } })).status).toBe(200);
    expect((await memberCtx.post(`clips/${u.clipId}/complete`, { data: { durationSec: 4 } })).status()).toBe(200);
    expect((await memberCtx.post(`assessments/${id}/submit`)).status()).toBe(200);

    const reviewerIds = ['reviewer1', 'reviewer2'].map((n) => sql(`select id from users where email='${n}@blulens.local'`));
    const assign = await committeeCtx.post(`assessments/${id}/assign`, { data: { reviewerIds } });
    expect(assign.status(), await assign.text()).toBe(200);
    const rubric = await data<any>(await committeeCtx.get('rubric'));
    const criteria = (rubric.criteria as Array<{ key: string }>).map((x) => x.key);
    for (const [i, rid] of reviewerIds.entries()) {
      const aid = sql(`select id from review_assignments where assessment_id='${id}' and reviewer_id='${rid}'`);
      const put = await reviewerCtxs[i].put(`reviews/assignments/${aid}`, { data: { scores: criteria.map((criterion) => ({ criterion, gradeKey: 'S' })) } });
      expect(put.status(), await put.text()).toBe(200);
    }
    expect(sql(`select status from assessments where id='${id}'`)).toBe('pending_approval');
  });

  test.describe('member UI', () => {
    test.use({ storageState: MEMBER_AUTH_FILE });

    test('L2 before approval: detail shows no grade yet, status and the uploaded clip', async ({ page }) => {
      await page.goto(`/me/assessments/${id}`);
      await expect(page.getByTestId('myassess-status')).toBeVisible({ timeout: 30000 });
      await expect(page.getByTestId('myassess-pending')).toBeVisible();
      await expect(page.getByTestId('myassess-grade')).toHaveCount(0);
      await expect(page.getByTestId('myassess-clips')).toBeVisible();
    });

    test('L3 Committee approves -> the member sees the grade on the detail page', async ({ page }) => {
      const ap = await committeeCtx.post(`assessments/${id}/approve`, { data: {} });
      expect(ap.status(), await ap.text()).toBe(200);
      await page.goto(`/me/assessments/${id}`);
      await expect(page.getByTestId('myassess-grade')).toBeVisible({ timeout: 30000 });
      await expect(page.getByTestId('myassess-grade')).toContainText('S');
      await expect(page.getByTestId('myassess-pending')).toHaveCount(0);
    });

    test('L4 /me lists the request and "myresult-open" leads to the detail', async ({ page }) => {
      await page.goto('/me');
      const open = page.locator(`[data-testid="myresult-open"][href="/me/assessments/${id}"]`);
      await expect(open).toBeVisible({ timeout: 30000 });
      await open.click();
      await expect(page).toHaveURL(new RegExp(`/me/assessments/${id}$`), { timeout: 20000 });
    });

    test('L5 notification: API has assessment_approved for this assessment linking to its detail page', async () => {
      test.skip(!notificationsApi, 'GET /me/notifications not available yet (Kevin)');
      const list = await data<any>(await memberCtx.get('me/notifications?limit=50'));
      const n = list.items.find((x: any) => x.type === 'assessment_approved' && x.link === `/me/assessments/${id}`);
      expect(n, 'assessment_approved notification with the detail link').toBeTruthy();
      expect(n.readAt).toBeNull();
      expect(list.unreadCount).toBeGreaterThan(unreadBefore);
    });
  });
});
