import { test, expect, type APIRequestContext, type APIResponse, type Page } from '@playwright/test';
import { COMMITTEE_AUTH_FILE } from './selectors';

/**
 * Slice 3 group draw gate (bl-25-11), see docs/qa/slice3-draw-e2e.md.
 * A fresh tournament + MD event gets 3 approved doubles entries whose pairs share clubs (so same-team conflicts are
 * unavoidable). The Committee previews, rerolls (older preview becomes stale), acknowledges conflicts, publishes;
 * then the public bracket page and GET /events/{id}/standings show the groups.
 * Everything goes through the real API/UI; no SQL.
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

test.describe.serial('slice 3: committee group draw', () => {
  let adminCtx: APIRequestContext;
  let committeeCtx: APIRequestContext;
  let publicCtx: APIRequestContext;
  let eventId = '';
  let firstPreviewId = '';
  let secondPreviewId = '';

  test.beforeAll(async ({ playwright }) => {
    const pw = process.env.SEED_DEMO_PASSWORD;
    const apw = process.env.SEED_ADMIN_PASSWORD;
    if (!pw || !apw) throw new Error('SEED_DEMO_PASSWORD and SEED_ADMIN_PASSWORD must be set (no defaults)');
    const mk = () => playwright.request.newContext({ baseURL: API_BASE });
    [adminCtx, committeeCtx, publicCtx] = [await mk(), await mk(), await mk()];
    await login(adminCtx, process.env.SEED_ADMIN_EMAIL ?? 'admin@blulens.local', apw);
    await login(committeeCtx, 'committee@blulens.local', pw);
  });

  async function setupEvent(label: string): Promise<string> {
    const t = await adminCtx.post('tournaments', {
      data: {
        name: `QA Tourney draw ${label} ${Date.now()}`,
        venue: 'e2e',
        startsOn: '2096-01-01',
        entriesCloseAt: '2095-12-20T23:59:00.000Z',
      },
    });
    expect(t.status(), await t.text()).toBe(201);
    const tid = (await data(t)).id as string;
    const ev = await adminCtx.post(`tournaments/${tid}/events`, {
      data: { discipline: 'MD', gradeMin: 'RK1', gradeMax: 'P+', maxEntries: 16, minReviewers: 2 },
    });
    expect(ev.status(), await ev.text()).toBe(201);
    const eventId = (await data(ev)).id as string;
    const fmt = await adminCtx.put(`events/${eventId}/format`, { data: { type: 'groups_knockout', groupSize: 3, advancePerGroup: 2, bestThirds: 0 } });
    expect(fmt.status(), await fmt.text()).toBe(200);
    const open = await committeeCtx.post(`tournaments/${tid}/status`, { data: { to: 'open' } });
    expect(open.status(), await open.text()).toBe(200);

    // by name (q=): the unfiltered member list is ordered by displayName and fills up with 'Ungraded Player' test users
    const byName = new Map<string, string>();
    for (const n of ['สมชาย ใจดี', 'วิภา ศรีสุข', 'ธนา รุ่งเรือง', 'มาลี สายสมร', 'กิตติ พานทอง', 'นภา ทองดี']) {
      const r = await data<{ items: Array<{ id: string; displayName: string }> }>(await committeeCtx.get(`users?role=Member&limit=20&q=${encodeURIComponent(n)}`));
      const hit = r.items.find((u) => u.displayName === n);
      if (hit) byName.set(n, hit.id);
    }
    const names = ['สมชาย ใจดี', 'วิภา ศรีสุข', 'ธนา รุ่งเรือง', 'มาลี สายสมร', 'กิตติ พานทอง', 'นภา ทองดี'];
    const ids = names.map((n) => byName.get(n)!);
    ids.forEach((i, k) => expect(i, `seed member ${names[k]}`).toBeTruthy());
    const team = async (q: string) => (await data<Array<{ teamId: string }>>(await committeeCtx.get(`teams/suggest?q=${q}`)))[0].teamId;
    const [blue, red, green] = [await team('blue'), await team('red'), await team('green')];

    const pairs = [
      [ [ids[0], blue], [ids[1], red] ],
      [ [ids[2], red], [ids[3], green] ],
      [ [ids[4], green], [ids[5], blue] ],
    ];
    for (const [k, pair] of pairs.entries()) {
      const c = await adminCtx.post(`events/${eventId}/entries`, {
        data: { name: `Draw pair ${k + 1}`, players: pair.map(([userId, teamId]) => ({ userId, teamId })) },
      });
      expect(c.status(), await c.text()).toBe(201);
      const eid = (await data(c)).id as string;
      expect((await adminCtx.post(`entries/${eid}/forward`)).status()).toBe(200);
      const ap = await committeeCtx.post(`entries/${eid}/approve`, { data: {} });
      expect(ap.status(), await ap.text()).toBe(200);
    }
    return eventId;
  }

  test('D1 setup: tournament + MD event, 3 approved entries sharing clubs (real API)', async () => {
    eventId = await setupEvent('main');
    // before publishing, the public standings are empty (no published draw)
    const st = await publicCtx.get(`events/${eventId}/standings`);
    expect(st.status()).toBe(200);
    expect(((await data(st)) as any[]).length).toBe(0);
  });

  test.describe('committee UI', () => {
    test.use({ storageState: COMMITTEE_AUTH_FILE });

    // D2-D4 are one Committee session on one page: the groups page keeps the preview only in page state (see D3b)
    let page: Page;
    test.beforeAll(async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: COMMITTEE_AUTH_FILE, baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3190' });
      page = await ctx.newPage();
    });

    test('D2 preview shows summary, groups and the unavoidable same-team conflict', async () => {
      await page.goto(`/committee/events/${eventId}/groups`);
      const resp = page.waitForResponse((r) => r.url().includes(`/events/${eventId}/groups/preview`) && r.request().method() === 'POST');
      await page.getByTestId('draw-preview').click({ timeout: 30000 });
      const r = await resp;
      expect(r.status(), await r.text()).toBe(201);
      { const j = await r.json(); firstPreviewId = (j.data ?? j).id; }
      expect(firstPreviewId).toBeTruthy();
      await expect(page.getByTestId('draw-summary')).toBeVisible();
      await expect(page.getByTestId('group-card').first()).toBeVisible();
      await expect(page.getByTestId('draw-conflicts')).toBeVisible();
      await expect(page.getByTestId('draw-publish')).toBeDisabled();
    });

    test('D3 reroll needs a reason >= 5, the FE sends it, and a new preview version is created', async () => {
      await expect(page.getByTestId('draw-summary')).toBeVisible({ timeout: 20000 });
      const resp = page.waitForResponse((r) => r.url().includes(`/events/${eventId}/groups/preview`) && r.request().method() === 'POST');
      await page.getByTestId('draw-reroll').click();
      await page.getByTestId('reason-input').fill('abcd');
      await expect(page.getByTestId('reason-submit')).toBeDisabled();
      await page.getByTestId('reason-input').fill('สุ่มใหม่เพื่อลดทีมชน');
      await page.getByTestId('reason-submit').click();
      const r = await resp;
      expect(r.status(), await r.text()).toBe(201);
      { const j = await r.json(); secondPreviewId = (j.data ?? j).id; }
      expect(secondPreviewId).toBeTruthy();
      expect(secondPreviewId).not.toBe(firstPreviewId);

    });

    test('D4 acknowledge conflicts, publish: draw-published, public bracket + standings show the groups', async () => {
      await expect(page.getByTestId('draw-conflicts')).toBeVisible({ timeout: 20000 });
      await expect(page.getByTestId('draw-publish')).toBeDisabled();
      await page.getByTestId('draw-ack-conflicts').check();
      await page.getByTestId('draw-conflict-reason').fill('abcd');
      await expect(page.getByTestId('draw-publish')).toBeDisabled();
      await page.getByTestId('draw-conflict-reason').fill('ยอมรับทีมชนกัน');
      await expect(page.getByTestId('draw-publish')).toBeEnabled();
      await page.getByTestId('draw-publish').click();
      const post = page.waitForResponse((r) => /\/draws\/[^/]+\/publish/.test(r.url()) && r.request().method() === 'POST');
      await page.getByTestId('confirm-publish').click();
      const res = await post;
      expect(res.status(), await res.text()).toBe(200);
      await expect(page.getByTestId('draw-published')).toBeVisible({ timeout: 20000 });

      const st = await publicCtx.get(`events/${eventId}/standings`);
      const rows = (await data(st)) as Array<{ played: number }>;
      expect(rows.length, 'one standing row per entry').toBe(3);
      expect(rows.every((x) => x.played === 0)).toBe(true);
    });
  });

  test('D3b reload with an existing preview: "จับกลุ่ม" asks for a reason (no reason-less 400) and creates a new preview', async ({ browser }) => {
    const ev = await setupEvent('reload');
    expect((await committeeCtx.post(`events/${ev}/groups/preview`, { data: {} })).status()).toBe(201);
    const ctx = await browser.newContext({ storageState: COMMITTEE_AUTH_FILE, baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3190' });
    const pg = await ctx.newPage();
    await pg.goto(`/committee/events/${ev}/groups`);
    await expect(pg.getByTestId('draw-preview')).toBeVisible({ timeout: 20000 });
    await pg.getByTestId('draw-preview').click();
    await pg.getByTestId('reason-input').fill('สุ่มใหม่หลังรีโหลดหน้า');
    const resp = pg.waitForResponse((r) => r.url().includes(`/events/${ev}/groups/preview`) && r.request().method() === 'POST');
    await pg.getByTestId('reason-submit').click();
    expect((await resp).status()).toBe(201);
    await expect(pg.getByTestId('draw-summary')).toBeVisible({ timeout: 20000 });
    await expect(pg.getByTestId('draw-error')).toHaveCount(0);
    await ctx.close();
  });

  test('D5 public bracket page (anonymous) shows the published groups', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3190' });
    const page = await ctx.newPage();
    await page.goto(`/events/${eventId}/bracket`);
    await expect(page.getByTestId('group-standings').first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('standing-row')).toHaveCount(3);
    await ctx.close();
  });

  test('D6 once published: new preview and second publish are refused (409 DRAW_ALREADY_LOCKED)', async () => {
    const again = await committeeCtx.post(`events/${eventId}/groups/preview`, { data: { reason: 'preview after publish' } });
    expect(again.status()).toBe(409);
    expect(await errCode(again)).toBe('DRAW_ALREADY_LOCKED');
    const pub = await committeeCtx.post(`draws/${secondPreviewId}/publish`, { data: { acknowledgeConflicts: true, reason: 'again please' } });
    expect(pub.status()).toBe(409);
    expect(await errCode(pub)).toBe('DRAW_ALREADY_LOCKED');
  });
  test('D7 by spec (draw.md section 6/7): an older preview stays publishable; publishing it discards the newer preview', async () => {
    const ev2 = await setupEvent('older');
    const p1 = await committeeCtx.post(`events/${ev2}/groups/preview`, { data: {} });
    expect(p1.status(), await p1.text()).toBe(201);
    const older = (await data(p1)).id as string;
    const p2 = await committeeCtx.post(`events/${ev2}/groups/preview`, { data: { reason: 'second preview for the test' } });
    expect(p2.status(), await p2.text()).toBe(201);
    const newer = (await data(p2)).id as string;
    expect(newer).not.toBe(older);

    const pub = await committeeCtx.post(`draws/${older}/publish`, { data: { acknowledgeConflicts: true, reason: 'publish the first preview' } });
    expect(pub.status(), await pub.text()).toBe(200);
    // the newer preview is discarded by that publish
    const again = await committeeCtx.post(`draws/${newer}/publish`, { data: { acknowledgeConflicts: true, reason: 'too late' } });
    expect(again.status()).toBe(409);
    expect(await errCode(again)).toBe('DRAW_ALREADY_LOCKED');
  });
  test('D8 a re-preview needs a reason (5..2000 chars): none/short -> 400 VALIDATION_FAILED, 5+ -> 201', async () => {
    const ev3 = await setupEvent('reason');
    const first = await committeeCtx.post(`events/${ev3}/groups/preview`, { data: {} });
    expect(first.status(), 'the first preview needs no reason').toBe(201);
    for (const body of [{}, { reason: 'abcd' }, { reason: 'x'.repeat(2001) }]) {
      const bad = await committeeCtx.post(`events/${ev3}/groups/preview`, { data: body });
      expect(bad.status(), JSON.stringify(body).slice(0, 40)).toBe(400);
      expect(await errCode(bad)).toBe('VALIDATION_FAILED');
    }
    const ok = await committeeCtx.post(`events/${ev3}/groups/preview`, { data: { reason: 'abcde' } });
    expect(ok.status(), await ok.text()).toBe(201);
  });
});
