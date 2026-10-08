import { test, expect, type APIRequestContext, type APIResponse, type Locator } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { COMMITTEE_AUTH_FILE } from './selectors';

/**
 * Calibration full loop (c47bac4): Committee creates a set with two reference clips (both reference S, real mp4 on MinIO),
 * assigns three reviewers from the picker (UI), reviewers score the blind calibration tasks, the results table shows each
 * reviewer's bias against the reference. reviewer1 scores S (bias 0), reviewer2 scores N- (2 ladder steps high, +2.0),
 * reviewer3 scores one task (too thin: "ข้อมูลยังไม่พอ"). Needs MinIO. No SQL. See docs/qa/slice-calibration-e2e.md.
 */

const API_BASE = (process.env.API_URL ?? 'http://localhost:3191').replace(/\/+$/, '') + '/api/v1/';
const SAMPLE = readFileSync(join(__dirname, '..', 'public', 'e2e', 'sample.mp4'));

async function data<T = any>(res: APIResponse): Promise<T> {
  const json = await res.json();
  return (json && typeof json === 'object' && 'data' in json ? json.data : json) as T;
}
async function login(ctx: APIRequestContext, identifier: string, password: string) {
  const res = await ctx.post('auth/login', { data: { identifier, password } });
  expect(res.status(), `login ${identifier}`).toBe(200);
}
const itemsOf = (b: any): any[] => (Array.isArray(b) ? b : b?.items ?? []);

async function pickGrade(card: Locator) {
  const keys = card.locator('[data-testid^="gp-key-"]');
  if (!(await keys.first().isVisible().catch(() => false))) {
    await card.locator('[data-testid^="gp-tier-"]').first().click();
  }
  await card.locator('[data-testid^="gp-key-"]:visible').first().click();
}

test.describe.serial('calibration full loop', () => {
  test.use({ storageState: COMMITTEE_AUTH_FILE });
  const name = `QA calib full ${Date.now()}`;
  let setId = '';
  let committee: APIRequestContext;
  const rev: APIRequestContext[] = [];
  const names: string[] = [];
  const revIds: string[] = [];
  let criteria: string[] = [];
  const before: Set<string>[] = [];
  const tasks: string[][] = [[], [], []];

  const myTasks = async (i: number) => itemsOf(await data(await rev[i].get('reviews/assignments/me?state=open')));

  test.beforeAll(async ({ playwright }) => {
    const pw = process.env.SEED_DEMO_PASSWORD;
    if (!pw) throw new Error('SEED_DEMO_PASSWORD must be set (no defaults)');
    const mk = () => playwright.request.newContext({ baseURL: API_BASE });
    committee = await mk();
    await login(committee, 'committee@blulens.local', pw);
    for (let i = 0; i < 3; i++) {
      const c = await mk();
      await login(c, `reviewer${i + 1}@blulens.local`, pw);
      rev.push(c);
      const me = await data<any>(await c.get('auth/me'));
      revIds.push(me.id ?? me.user?.id);
      names.push(me.displayName ?? me.user?.displayName);
    }
    criteria = ((await data<any>(await committee.get('rubric'))).criteria as Array<{ key: string }>).map((c) => c.key);
    for (let i = 0; i < 3; i++) before.push(new Set((await myTasks(i)).map((t: any) => t.id)));
  });

  test('F1 set with two reference clips (S, S) uploaded to MinIO; results are empty before anyone scores', async () => {
    const c = await committee.post('calibration-sets', { data: { name, period: '2099-Q2' } });
    expect(c.status(), await c.text()).toBe(201);
    setId = (await data(c)).id;
    for (let k = 0; k < 2; k++) {
      const up = await committee.post(`calibration-sets/${setId}/clips/upload-url`, { data: { fileName: 'ref.mp4', contentType: 'video/mp4', sizeBytes: SAMPLE.length, referenceKey: 'S' } });
      expect(up.status(), await up.text()).toBe(200);
      const u = await data(up);
      expect((await fetch(u.uploadUrl, { method: 'PUT', body: SAMPLE, headers: { 'Content-Type': 'video/mp4' } })).status).toBe(200);
      const done = await committee.post(`calibration-sets/${setId}/clips/${u.clipId}/complete`, { data: { durationSec: 4 } });
      expect(done.status(), await done.text()).toBe(200);
    }
    const res = await committee.get(`calibration-sets/${setId}/results`);
    expect(res.status()).toBe(200);
    expect((await data<any[]>(res)).length).toBe(0);
  });

  test('F2 UI: assign needs at least one reviewer; pick 3 reviewers from the search, confirm -> set becomes assigned, reviewers listed', async ({ page }) => {
    await page.goto(`/committee/calibration/${setId}`);
    await expect(page.getByTestId('calib-assign-panel')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('calib-assign'), 'no reviewer picked yet').toBeDisabled();
    for (const n of names) {
      await page.getByTestId('calib-reviewer-search').fill(n);
      await page.getByTestId('calib-reviewer-option').filter({ hasText: n }).first().click();
    }
    await expect(page.getByTestId('calib-reviewer-chip')).toHaveCount(3);
    await page.getByTestId('calib-assign').click();
    const post = page.waitForResponse((r) => r.url().includes(`/calibration-sets/${setId}/assign`) && r.request().method() === 'POST');
    await page.getByTestId('calib-assign-confirm').click();
    expect((await post).status()).toBe(204);
    await expect(page.getByTestId('calib-state')).toHaveText('มอบหมายแล้ว', { timeout: 20000 });
    await expect(page.getByTestId('calib-add'), 'no more clip changes once assigned').toHaveCount(0);
    const table = page.getByTestId('calib-reviewers');
    for (const n of names) await expect(table).toContainText(n);
    await expect(table).toContainText('รอส่ง');
  });

  test('F3 every reviewer got two new blind calibration tasks and a review_assigned notification', async () => {
    for (let i = 0; i < 3; i++) {
      const fresh = (await myTasks(i)).filter((t: any) => !before[i].has(t.id));
      tasks[i] = fresh.map((t: any) => t.id);
      expect(tasks[i].length, `reviewer${i + 1} new tasks`).toBe(2);
      const detail = JSON.stringify(await data(await rev[i].get(`reviews/assignments/${tasks[i][0]}`)));
      expect(detail, 'blind: the reference grade and set name are not exposed').not.toContain(name);
      expect(detail).not.toContain('referenceKey');
      const n = (await data<any>(await rev[i].get('me/notifications?limit=50'))).items.find((x: any) => x.type === 'review_assigned' && x.link === '/review');
      expect(n, 'review_assigned').toBeTruthy();
    }
  });

  test('F4 reviewer1 (S) and reviewer2 (N-) score both clips through the API; assigning a reviewer again creates no duplicate task', async () => {
    for (const [i, key] of [[0, 'S'], [1, 'N-']] as const) {
      for (const id of tasks[i]) {
        const put = await rev[i].put(`reviews/assignments/${id}`, { data: { scores: criteria.map((criterion) => ({ criterion, gradeKey: key })) } });
        expect(put.status(), await put.text()).toBe(200);
      }
    }
    const tasksAfter = (await myTasks(2)).filter((t: any) => !before[2].has(t.id)).length;
    const again = await committee.post(`calibration-sets/${setId}/assign`, { data: { reviewerIds: [revIds[2]] } });
    expect(again.status(), 'assigning the same reviewer again is idempotent').toBe(204);
    expect((await myTasks(2)).filter((t: any) => !before[2].has(t.id)).length, 'no duplicate tasks').toBe(tasksAfter);
  });

  test.describe('reviewer3 UI', () => {
    test('F5 reviewer3 scores one task in the browser (blind page: no reference grade, no set name)', async ({ browser }) => {
      const ctx = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3190' });
      expect((await ctx.request.post(API_BASE + 'auth/login', { data: { identifier: 'reviewer3@blulens.local', password: process.env.SEED_DEMO_PASSWORD } })).status()).toBe(200);
      const page = await ctx.newPage();
      await page.goto(`/review/tasks/${tasks[2][0]}`);
      await expect(page.getByTestId('clip-player')).toBeVisible({ timeout: 30000 });
      await expect(page.locator('body')).not.toContainText(name);
      const items = page.getByTestId('rubric-item');
      const n = await items.count();
      expect(n).toBeGreaterThan(0);
      for (let i = 0; i < n; i++) await pickGrade(items.nth(i));
      await page.getByTestId('scoring-submit').click();
      const put = page.waitForResponse((r) => r.url().includes(`/reviews/assignments/${tasks[2][0]}`) && r.request().method() === 'PUT');
      await page.getByTestId('scoring-confirm').click();
      expect((await put).status()).toBe(200);
      await ctx.close();
    });
  });

  test('F6 results API: reviewer1 bias 0, reviewer2 bias +2, reviewer3 one clip scored', async () => {
    const res = await data<any[]>(await committee.get(`calibration-sets/${setId}/results`));
    const by = (id: string) => res.find((r) => r.reviewerId === id);
    expect(by(revIds[0]).clipsScored).toBe(2);
    expect(by(revIds[0]).biasVsReference).toBeCloseTo(0, 1);
    expect(by(revIds[1]).biasVsReference).toBeCloseTo(2, 1);
    expect(by(revIds[1]).meanAbsError).toBeCloseTo(2, 1);
    expect(by(revIds[2]).clipsScored).toBe(1);
  });

  test('F7 results table in the UI: bias text per reviewer, thin data flagged, no grading params shown', async ({ page }) => {
    await page.goto(`/committee/calibration/${setId}`);
    const table = page.getByTestId('calib-results');
    await expect(table).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('calib-result-row')).toHaveCount(3);
    const row = (i: number) => page.getByTestId('calib-result-row').filter({ hasText: names[i] });
    await expect(row(0).getByTestId('calib-bias')).toContainText('ตรงเกณฑ์');
    await expect(row(1).getByTestId('calib-bias')).toContainText('+2.0');
    await expect(row(1).getByTestId('calib-bias')).toContainText('สูงกว่าเกณฑ์');
    await expect(row(1).getByTestId('calib-mae')).toContainText('2.0');
    await expect(row(2).getByTestId('calib-bias')).toContainText('ข้อมูลยังไม่พอ');
    await expect(row(2).getByTestId('calib-mae')).toHaveText('—');
    await expect(page.getByTestId('calib-reviewers')).toContainText('ส่งแล้ว');
  });
});
