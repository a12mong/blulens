import { test, expect, type APIResponse } from '@playwright/test';
import { join } from 'path';
import { MEMBER_AUTH_FILE } from './selectors';

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
});
