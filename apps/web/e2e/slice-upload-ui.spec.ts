import { test, expect, type APIResponse } from '@playwright/test';
import { join } from 'path';
import { COMMITTEE_AUTH_FILE, MEMBER_AUTH_FILE } from './selectors';

/**
 * Member upload UI (bl-36, af1e6c1): /me -> "myresult-new" -> /me/assessments/new: note, start, pick a real mp4 (sample.mp4),
 * upload to MinIO, submit. Needs MinIO running. No SQL. Companion of slice-clip-upload.api.spec.ts.
 */

const API_BASE = (process.env.API_URL ?? 'http://localhost:3191').replace(/\/+$/, '') + '/api/v1/';
const SAMPLE = join(__dirname, '..', 'public', 'e2e', 'sample.mp4');

async function data<T = any>(res: APIResponse): Promise<T> {
  const json = await res.json();
  return (json && typeof json === 'object' && 'data' in json ? json.data : json) as T;
}

test.describe.serial('member upload UI', () => {
  test.use({ storageState: MEMBER_AUTH_FILE });
  let assessmentId = '';

  test('UP1 /me has the entry link to the request page', async ({ page }) => {
    await page.goto('/me');
    await page.getByTestId('myresult-new').click({ timeout: 30000 });
    await expect(page).toHaveURL(/\/me\/assessments\/new/, { timeout: 20000 });
    await expect(page.getByTestId('request-start')).toBeVisible();
  });

  test('UP2 start a request, a wrong file type is refused in Thai, a real mp4 uploads, submit needs >=1 clip and ends in request-done', async ({ page }) => {
    await page.goto('/me/assessments/new');
    await page.getByTestId('request-note').fill(`e2e upload ui ${Date.now()}`);
    const created = page.waitForResponse((r) => r.url().endsWith('/assessments') && r.request().method() === 'POST');
    await page.getByTestId('request-start').click({ timeout: 30000 });
    const cr = await created;
    expect(cr.status(), await cr.text()).toBe(201);
    assessmentId = (await data(cr)).id;

    await expect(page.getByTestId('request-submit'), 'no clip yet').toBeDisabled();

    await page.getByTestId('clip-file').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a video') });
    await expect(page.getByTestId('clip-error')).toContainText('ชนิดไฟล์ไม่รองรับ', { timeout: 20000 });
    await expect(page.getByTestId('request-submit')).toBeDisabled();

    const completed = page.waitForResponse((r) => /\/clips\/[^/]+\/complete/.test(r.url()) && r.request().method() === 'POST');
    await page.getByTestId('clip-file').setInputFiles(SAMPLE);
    const done = await completed;
    expect(done.status(), await done.text()).toBe(200);
    await expect(page.getByTestId('request-slot')).toHaveCount(1, { timeout: 30000 });
    await expect(page.getByTestId('request-submit')).toBeEnabled();

    const submitted = page.waitForResponse((r) => r.url().includes(`/assessments/${assessmentId}/submit`) && r.request().method() === 'POST');
    await page.getByTestId('request-submit').click();
    expect((await submitted).status()).toBe(200);
    await expect(page.getByTestId('request-done')).toBeVisible({ timeout: 20000 });
  });

  test('UP3 the submitted assessment holds the uploaded clip (API check as the same member)', async ({ page }) => {
    const res = await page.request.get(API_BASE + `assessments/${assessmentId}`);
    expect(res.status(), await res.text()).toBe(200);
    const a = await data(res);
    expect(a.status).not.toBe('draft');
    expect((a.clips ?? []).filter((c: any) => c.status === 'uploaded').length).toBe(1);
    expect(a.clips[0].durationSec).toBeGreaterThan(0);
  });

  test('UP4 three clips (the 4th slot disappears), submit, and the assessment shows in the Committee queue', async ({ page, browser }) => {
    await page.goto('/me/assessments/new');
    const created = page.waitForResponse((r) => r.url().endsWith('/assessments') && r.request().method() === 'POST');
    await page.getByTestId('request-note').fill(`e2e three clips ${Date.now()}`);
    await page.getByTestId('request-start').click({ timeout: 30000 });
    const id = (await data(await created)).id as string;
    for (let n = 1; n <= 3; n++) {
      const completed = page.waitForResponse((r) => /\/clips\/[^/]+\/complete/.test(r.url()) && r.request().method() === 'POST');
      await page.getByTestId('clip-file').setInputFiles(SAMPLE);
      expect((await completed).status()).toBe(200);
      await expect(page.getByTestId('request-slot')).toHaveCount(n, { timeout: 30000 });
    }
    await expect(page.getByTestId('clip-file'), 'no 4th upload slot after 3 clips').toHaveCount(0);
    const submitted = page.waitForResponse((r) => r.url().includes(`/assessments/${id}/submit`) && r.request().method() === 'POST');
    await page.getByTestId('request-submit').click();
    expect((await submitted).status()).toBe(200);
    await expect(page.getByTestId('request-done')).toBeVisible({ timeout: 20000 });

    const ctx = await browser.newContext({ storageState: COMMITTEE_AUTH_FILE, baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3190' });
    const cp = await ctx.newPage();
    await cp.goto('/committee/assessments');
    const row = cp.locator(`[data-testid="assessment-row"][data-assessment-id="${id}"]`);
    await expect(row, 'the new request is in the Committee queue').toBeVisible({ timeout: 30000 });
    await expect(row).not.toContainText('ไม่ระบุ');
    await ctx.close();
    const a = await data(await page.request.get(API_BASE + `assessments/${id}`));
    expect((a.clips ?? []).filter((c: any) => c.status === 'uploaded').length).toBe(3);
  });
});
