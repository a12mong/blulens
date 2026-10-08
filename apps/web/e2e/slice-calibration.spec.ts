import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { join } from 'path';
import { COMMITTEE_AUTH_FILE } from './selectors';

/**
 * Committee calibration path (a312817): /committee/calibration create a set, open it, upload reference clips (real mp4 to
 * MinIO) with a reference grade, change a grade, delete a clip. Assign + results UI (bl-34-3) come in a later gate.
 * Needs MinIO. No SQL. See docs/qa/slice-calibration-e2e.md.
 */

const API_BASE = (process.env.API_URL ?? 'http://localhost:3191').replace(/\/+$/, '') + '/api/v1/';
const SAMPLE = join(__dirname, '..', 'public', 'e2e', 'sample.mp4');

async function data<T = any>(res: APIResponse): Promise<T> {
  const json = await res.json();
  return (json && typeof json === 'object' && 'data' in json ? json.data : json) as T;
}
async function login(ctx: APIRequestContext, identifier: string, password: string) {
  const res = await ctx.post('auth/login', { data: { identifier, password } });
  expect(res.status(), `login ${identifier}`).toBe(200);
}

test.describe.serial('committee calibration sets', () => {
  test.use({ storageState: COMMITTEE_AUTH_FILE });
  const name = `QA calib ${Date.now()}`;
  let setId = '';
  let committeeCtx: APIRequestContext;

  test.beforeAll(async ({ playwright }) => {
    const pw = process.env.SEED_DEMO_PASSWORD;
    if (!pw) throw new Error('SEED_DEMO_PASSWORD must be set (no defaults)');
    committeeCtx = await playwright.request.newContext({ baseURL: API_BASE });
    await login(committeeCtx, 'committee@blulens.local', pw);
  });

  const detail = async () => data<any>(await committeeCtx.get(`calibration-sets/${setId}`));
  const pickGrade = async (scope: import('@playwright/test').Locator, tier: string, key: string) => {
    await scope.getByTestId(`gp-tier-${tier}`).click();
    await scope.getByTestId(`gp-key-${key}`).click();
  };

  test('K1 create a set from the UI: it appears as a card and opens as a draft with no clips', async ({ page }) => {
    await page.goto('/committee/calibration');
    await expect(page.getByTestId('calibration-create')).toBeVisible({ timeout: 30000 });
    await page.getByLabel('ชื่อชุด').fill(name);
    await page.getByLabel(/รอบ/).fill('2099-Q1');
    const created = page.waitForResponse((r) => r.url().endsWith('/calibration-sets') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'สร้างชุด' }).click();
    const cr = await created;
    expect(cr.status(), await cr.text()).toBe(201);
    setId = (await data(cr)).id;
    const card = page.getByTestId('calibration-card').filter({ hasText: name });
    await expect(card).toBeVisible({ timeout: 20000 });
    await expect(card).toContainText('2099-Q1');
    await card.click();
    await expect(page).toHaveURL(new RegExp(`/committee/calibration/${setId}$`), { timeout: 20000 });
    await expect(page.getByTestId('calib-state')).toHaveText('ฉบับร่าง', { timeout: 20000 });
    await expect(page.getByTestId('calib-clip')).toHaveCount(0);
  });

  const uploadOne = async (page: import('@playwright/test').Page, tier: string, key: string, expectCount: number) => {
    const add = page.getByTestId('calib-add');
    await pickGrade(add, tier, key);
    await expect(page.getByTestId('calib-pick')).toBeEnabled();
    const done = page.waitForResponse((r) => /\/calibration-sets\/[^/]+\/clips\/[^/]+\/complete/.test(r.url()) && r.request().method() === 'POST');
    await page.getByTestId('calib-file-input').setInputFiles(SAMPLE);
    const d = await done;
    expect(d.status(), await d.text()).toBe(200);
    await expect(page.getByTestId('calib-clip')).toHaveCount(expectCount, { timeout: 30000 });
  };

  test('K2 upload a reference clip (grade chosen first; the pick button needs a grade): ready with a playable viewUrl', async ({ page }) => {
    await page.goto(`/committee/calibration/${setId}`);
    await expect(page.getByTestId('calib-add')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('calib-pick'), 'no grade chosen yet').toBeDisabled();
    await uploadOne(page, 'Standard', 'S', 1);
    await expect(page.getByTestId('calib-error')).toHaveCount(0);
    const d = await detail();
    expect(d.clipDetails.map((c: any) => c.referenceKey)).toEqual(['S']);
    expect(d.clipDetails[0].status).toBe('uploaded');
    expect((await fetch(d.clipDetails[0].viewUrl)).status, 'reference clip is playable').toBe(200);
  });

  test('K2b a second reference clip uploads; the pick button stays disabled afterwards until a reload (known issue, recorded as an annotation)', async ({ page }) => {
    await page.goto(`/committee/calibration/${setId}`);
    await expect(page.getByTestId('calib-clip')).toHaveCount(1, { timeout: 30000 });
    await uploadOne(page, 'Professional', 'P', 2);
    expect((await detail()).clipDetails.map((c: any) => c.referenceKey).sort()).toEqual(['P', 'S']);
    // KNOWN ISSUE: CalibrationDetail keeps uploadState = done after a successful upload, so the picker cannot be reused without a reload
    await pickGrade(page.getByTestId('calib-add'), 'Standard', 'S');
    const reusable = await page.getByTestId('calib-pick').isEnabled();
    if (!reusable) test.info().annotations.push({ type: 'known-issue', description: 'calib-pick stays disabled after a successful upload until the page is reloaded (uploadState never returns to idle)' });
    console.log('calib-pick reusable after upload:', reusable);
  });

  test('K3 change a clip reference grade in the UI: PATCH 200 and the API shows it', async ({ page }) => {
    await page.goto(`/committee/calibration/${setId}`);
    const before = await detail();
    const target = before.clipDetails.find((c: any) => c.referenceKey === 'S');
    const idx = before.clipDetails.findIndex((c: any) => c.clipId === target.clipId);
    const row = page.getByTestId('calib-clip').nth(idx);
    await expect(row).toBeVisible({ timeout: 30000 });
    const patched = page.waitForResponse((r) => r.url().includes(`/clips/${target.clipId}`) && r.request().method() === 'PATCH');
    await pickGrade(row.getByTestId('calib-ref-edit'), 'Neutral', 'N');
    expect((await patched).status()).toBe(200);
    await expect.poll(async () => (await detail()).clipDetails.find((c: any) => c.clipId === target.clipId).referenceKey).toBe('N');
  });

  test('K4 delete a clip through the confirm dialog: DELETE 2xx, one clip left', async ({ page }) => {
    await page.goto(`/committee/calibration/${setId}`);
    await expect(page.getByTestId('calib-clip')).toHaveCount(2, { timeout: 30000 });
    await page.getByTestId('calib-clip-delete').first().click();
    const del = page.waitForResponse((r) => /\/clips\/[^/]+$/.test(r.url()) && r.request().method() === 'DELETE');
    await page.getByRole('dialog').getByRole('button', { name: 'ลบ', exact: true }).click();
    expect((await del).status()).toBeLessThan(300);
    await expect(page.getByTestId('calib-clip')).toHaveCount(1, { timeout: 20000 });
    expect((await detail()).clipDetails.length).toBe(1);
  });

  test('K5 the list shows the set with its clip count; a Member cannot use the calibration API (403)', async ({ page, playwright }) => {
    await page.goto('/committee/calibration');
    const card = page.getByTestId('calibration-card').filter({ hasText: name });
    await expect(card).toBeVisible({ timeout: 30000 });
    await expect(card).toContainText('คลิป 1 คลิป');
    const m = await playwright.request.newContext({ baseURL: API_BASE });
    await login(m, 'member1@blulens.local', process.env.SEED_DEMO_PASSWORD!);
    expect((await m.get('calibration-sets')).status()).toBe(403);
    expect((await m.get(`calibration-sets/${setId}`)).status()).toBe(403);
    const dup = await committeeCtx.post('calibration-sets', { data: { name: '' } });
    expect(dup.status(), 'empty name').toBe(400);
  });
});
