import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { COMMITTEE_AUTH_FILE } from './selectors';

/**
 * Rubric editor (13d21d6): /committee/rubrics list, "create draft from the active rubric", criteria editor, activate with a
 * reason, delete a draft. Each run leaves a NEW active rubric version in blulens_e2e (only a weight differs); other specs
 * read the active criteria keys dynamically, so they are unaffected. No SQL. See docs/qa/slice-rubrics-e2e.md.
 */

const API_BASE = (process.env.API_URL ?? 'http://localhost:3191').replace(/\/+$/, '') + '/api/v1/';

async function data<T = any>(res: APIResponse): Promise<T> {
  const json = await res.json();
  return (json && typeof json === 'object' && 'data' in json ? json.data : json) as T;
}
async function errCode(res: APIResponse): Promise<string> {
  const j = await res.json();
  return (j?.error ?? j)?.code;
}
async function login(ctx: APIRequestContext, identifier: string, password: string) {
  const res = await ctx.post('auth/login', { data: { identifier, password } });
  expect(res.status(), `login ${identifier}`).toBe(200);
}

test.describe.serial('rubric editor', () => {
  test.use({ storageState: COMMITTEE_AUTH_FILE });
  let committee: APIRequestContext;
  let draftId = '';
  let oldActiveId = '';
  let oldWeight = 0;
  let newWeight = 0;

  const all = async () => data<any[]>(await committee.get('rubrics'));

  test.beforeAll(async ({ playwright }) => {
    const pw = process.env.SEED_DEMO_PASSWORD;
    if (!pw) throw new Error('SEED_DEMO_PASSWORD must be set (no defaults)');
    committee = await playwright.request.newContext({ baseURL: API_BASE });
    await login(committee, 'committee@blulens.local', pw);
    for (const r of await all()) {
      if (r.status === 'draft') expect((await committee.delete(`rubrics/${r.id}`)).status()).toBe(204);
    }
    const active = (await all()).find((r) => r.status === 'active');
    expect(active, 'an active rubric exists (seed)').toBeTruthy();
    oldActiveId = active.id;
    oldWeight = Number(active.criteria[0].weight);
    newWeight = oldWeight < 5 ? oldWeight + 1 : oldWeight - 1;
  });

  test('R1 list shows the versions; exactly one is active; creating a draft from the active rubric works once (second -> 409)', async ({ page }) => {
    await page.goto('/committee/rubrics');
    await expect(page.getByTestId('rubric-card').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="rubric-status"]', { hasText: 'ใช้งานอยู่' })).toHaveCount(1);
    const created = page.waitForResponse((r) => r.url().endsWith('/rubrics') && r.request().method() === 'POST');
    await page.getByTestId('rubric-new-draft').click();
    const cr = await created;
    expect(cr.status(), await cr.text()).toBe(201);
    draftId = (await data(cr)).id;
    await expect(page.locator('[data-testid="rubric-status"]', { hasText: 'ฉบับร่าง' })).toHaveCount(1, { timeout: 20000 });
    await expect(page.getByTestId('rubric-new-draft'), 'only one open draft').toHaveCount(0);
    const again = await committee.post('rubrics');
    expect(again.status()).toBe(409);
    expect(await errCode(again)).toBe('RUBRIC_DRAFT_EXISTS');
    const draft = (await all()).find((r) => r.id === draftId);
    expect(draft.criteria.length, 'copied from the active rubric').toBe((await all()).find((r) => r.id === oldActiveId).criteria.length);
  });

  test('R2 editor: invalid input blocks saving and is explained; a valid weight change saves (rubric-saved) and the active rubric is untouched', async ({ page }) => {
    await page.goto(`/committee/rubrics/${draftId}`);
    const first = page.getByTestId('rubric-criterion').first();
    await expect(first).toBeVisible({ timeout: 30000 });
    await first.getByTestId('crit-key').fill('Bad Key');
    await expect(first.getByTestId('crit-errors')).toBeVisible();
    await expect(page.getByTestId('rubric-save'), 'invalid rows cannot be saved').toBeDisabled();
    await first.getByTestId('crit-key').fill('');
    await page.reload();
    const f2 = page.getByTestId('rubric-criterion').first();
    await expect(f2).toBeVisible({ timeout: 30000 });
    const keyBefore = await f2.getByTestId('crit-key').inputValue();
    await f2.getByTestId('crit-weight').fill('0');
    await expect(f2.getByTestId('crit-errors')).toBeVisible();
    await f2.getByTestId('crit-weight').fill(String(newWeight));
    await f2.getByTestId('crit-anchor-Standard').fill('มาตรฐาน: ทดสอบ e2e');
    await expect(f2.getByTestId('crit-errors')).toHaveCount(0);
    const put = page.waitForResponse((r) => r.url().includes(`/rubrics/${draftId}`) && r.request().method() === 'PUT');
    await page.getByTestId('rubric-save').click();
    expect((await put).status()).toBe(200);
    await expect(page.getByTestId('rubric-saved')).toBeVisible({ timeout: 20000 });
    const draft = (await all()).find((r) => r.id === draftId);
    expect(draft.criteria[0].key).toBe(keyBefore);
    expect(Number(draft.criteria[0].weight)).toBe(newWeight);
    expect(draft.criteria[0].anchorsTh.Standard).toContain('ทดสอบ e2e');
    expect(Number((await all()).find((r) => r.id === oldActiveId).criteria[0].weight), 'active rubric unchanged').toBe(oldWeight);
  });

  test('R3 grading parameters are never exposed: the API rubric shape has only id/status/createdAt/methodVersion/criteria', async () => {
    for (const r of await all()) {
      expect(Object.keys(r).sort().filter((k) => !['id', 'status', 'createdAt', 'methodVersion', 'criteria'].includes(k)), 'extra keys on a rubric').toEqual([]);
      for (const c of r.criteria) expect(Object.keys(c).filter((k) => !['key', 'nameTh', 'weight', 'anchorsTh'].includes(k))).toEqual([]);
    }
    const text = JSON.stringify(await all()).toLowerCase();
    for (const w of ['outlier', 'margin', 'minreviewers', 'kappa']) expect(text).not.toContain(w);
  });

  test('R4 activate needs a reason (>=5); the old version becomes retired and the draft active; reviewers see the new weight', async ({ page, playwright }) => {
    await page.goto('/committee/rubrics');
    const card = page.getByTestId('rubric-card').filter({ has: page.locator('[data-testid="rubric-status"]', { hasText: 'ฉบับร่าง' }) });
    await expect(card).toBeVisible({ timeout: 30000 });
    await card.getByTestId('rubric-activate').click();
    await page.getByTestId('reason-input').fill('abcd');
    await expect(page.getByTestId('reason-submit')).toBeDisabled();
    await page.getByTestId('reason-input').fill('ปรับน้ำหนักเกณฑ์ตามรอบทดสอบ');
    const act = page.waitForResponse((r) => r.url().includes(`/rubrics/${draftId}/activate`) && r.request().method() === 'POST');
    await page.getByTestId('reason-submit').click();
    expect((await act).status()).toBe(200);
    await expect(page.locator('[data-testid="rubric-status"]', { hasText: 'ใช้งานอยู่' })).toHaveCount(1, { timeout: 20000 });
    const rows = await all();
    expect(rows.find((r) => r.id === draftId).status).toBe('active');
    expect(rows.find((r) => r.id === oldActiveId).status).toBe('retired');
    expect(rows.filter((r) => r.status === 'active').length).toBe(1);

    const rev = await playwright.request.newContext({ baseURL: API_BASE });
    await login(rev, 'reviewer1@blulens.local', process.env.SEED_DEMO_PASSWORD!);
    const active = await data<any>(await rev.get('rubric'));
    expect(Number(active.criteria[0].weight)).toBe(newWeight);
    expect(JSON.stringify(active).toLowerCase()).not.toContain('outlier');
  });

  test('R5 non-draft versions are read-only: editor page says so, PUT/DELETE/activate -> 409 RUBRIC_NOT_DRAFT', async ({ page }) => {
    await page.goto(`/committee/rubrics/${oldActiveId}`);
    await expect(page.getByTestId('rubric-readonly')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('rubric-save')).toHaveCount(0);
    const crit = (await all()).find((r) => r.id === oldActiveId).criteria;
    const put = await committee.put(`rubrics/${oldActiveId}`, { data: { criteria: crit } });
    expect(put.status()).toBe(409);
    expect(await errCode(put)).toBe('RUBRIC_NOT_DRAFT');
    expect((await committee.delete(`rubrics/${oldActiveId}`)).status()).toBe(409);
    expect((await committee.post(`rubrics/${oldActiveId}/activate`, { data: { reason: 'ลองเปิดใช้ซ้ำ' } })).status()).toBe(409);
  });

  test('R6 delete a draft through the confirm dialog; Member and Reviewer cannot use the rubric admin API', async ({ page, playwright }) => {
    expect((await committee.post('rubrics')).status()).toBe(201);
    await page.goto('/committee/rubrics');
    const card = page.getByTestId('rubric-card').filter({ has: page.locator('[data-testid="rubric-status"]', { hasText: 'ฉบับร่าง' }) });
    await expect(card).toBeVisible({ timeout: 30000 });
    await card.getByTestId('rubric-delete').click();
    const del = page.waitForResponse((r) => /\/rubrics\/[^/]+$/.test(r.url()) && r.request().method() === 'DELETE');
    await page.getByTestId('rubric-delete-confirm').click();
    expect((await del).status()).toBe(204);
    await expect(page.locator('[data-testid="rubric-status"]', { hasText: 'ฉบับร่าง' })).toHaveCount(0, { timeout: 20000 });
    expect((await all()).filter((r) => r.status === 'draft').length).toBe(0);

    for (const who of ['member1', 'reviewer1']) {
      const c = await playwright.request.newContext({ baseURL: API_BASE });
      await login(c, `${who}@blulens.local`, process.env.SEED_DEMO_PASSWORD!);
      expect((await c.get('rubrics')).status(), who).toBe(403);
      expect((await c.post('rubrics')).status(), who).toBe(403);
    }
  });
});
