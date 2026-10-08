import { test, expect, type APIRequestContext, type APIResponse, type Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import { COMMITTEE_AUTH_FILE } from './selectors';

/**
 * Slice 3 end-to-end: group draw -> publish -> umpire reports -> Committee approves -> groups confirm (lock).
 * Fresh event per run (3 club-sharing approved pairs, groupSize 3 = one group, 3 round-robin matches).
 * Draw preview/publish go through the UI, umpire reports through the API, approvals through the UI,
 * lock through the API (no UI for groups/confirm yet). SQL only on blulens_e2e: event_umpires row for seeded umpire1.
 * See docs/qa/slice3-full-e2e.md.
 */

const API_BASE = (process.env.API_URL ?? 'http://localhost:3191').replace(/\/+$/, '') + '/api/v1/';
const PG_CONTAINER = process.env.E2E_PG_CONTAINER ?? 'blulens-postgres';
const PG_USER = process.env.E2E_PG_USER ?? 'blulens';

function sql(q: string): string {
  return execFileSync('docker', ['exec', PG_CONTAINER, 'psql', '-U', PG_USER, '-d', 'blulens_e2e', '-tA', '-c', q], { encoding: 'utf8' })
    .trim()
    .split('\n')[0];
}
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
const rowsOf = (d: any): any[] => (Array.isArray(d) ? d : d?.items ?? d?.matches ?? []);

test.describe.serial('slice 3 full loop: draw -> results -> group lock', () => {
  let adminCtx: APIRequestContext;
  let committeeCtx: APIRequestContext;
  let umpireCtx: APIRequestContext;
  let publicCtx: APIRequestContext;
  let eventId = '';
  let matchIds: string[] = [];

  test.beforeAll(async ({ playwright }) => {
    const pw = process.env.SEED_DEMO_PASSWORD;
    const apw = process.env.SEED_ADMIN_PASSWORD;
    if (!pw || !apw) throw new Error('SEED_DEMO_PASSWORD and SEED_ADMIN_PASSWORD must be set (no defaults)');
    const mk = () => playwright.request.newContext({ baseURL: API_BASE });
    [adminCtx, committeeCtx, umpireCtx, publicCtx] = [await mk(), await mk(), await mk(), await mk()];
    await login(adminCtx, process.env.SEED_ADMIN_EMAIL ?? 'admin@blulens.local', apw);
    await login(committeeCtx, 'committee@blulens.local', pw);
    await login(umpireCtx, 'umpire1@blulens.local', pw); // seeded umpire (bl-25-6)
  });

  test('F1 setup: event with 3 approved pairs (groups_knockout, groupSize 3)', async () => {
    const t = await adminCtx.post('tournaments', {
      data: { name: `QA Tourney full ${Date.now()}`, venue: 'e2e', startsOn: '2095-01-01', entriesCloseAt: '2094-12-20T23:59:00.000Z' },
    });
    expect(t.status(), await t.text()).toBe(201);
    const tid = (await data(t)).id as string;
    const ev = await adminCtx.post(`tournaments/${tid}/events`, {
      data: { discipline: 'MD', gradeMin: 'RK1', gradeMax: 'P+', maxEntries: 16, minReviewers: 2 },
    });
    expect(ev.status(), await ev.text()).toBe(201);
    eventId = (await data(ev)).id as string;
    const fmt = await adminCtx.put(`events/${eventId}/format`, { data: { type: 'groups_knockout', groupSize: 3, advancePerGroup: 2, bestThirds: 0 } });
    expect(fmt.status(), await fmt.text()).toBe(200);
    expect((await committeeCtx.post(`tournaments/${tid}/status`, { data: { to: 'open' } })).status()).toBe(200);

    // by name (q=): the unfiltered member list is ordered by displayName and fills up with 'Ungraded Player' test users
    const byName = new Map<string, string>();
    for (const n of ['สมชาย ใจดี', 'วิภา ศรีสุข', 'ธนา รุ่งเรือง', 'มาลี สายสมร', 'กิตติ พานทอง', 'นภา ทองดี']) {
      const r = await data<{ items: Array<{ id: string; displayName: string }> }>(await committeeCtx.get(`users?role=Member&limit=20&q=${encodeURIComponent(n)}`));
      const hit = r.items.find((u) => u.displayName === n);
      if (hit) byName.set(n, hit.id);
    }
    const ids = ['สมชาย ใจดี', 'วิภา ศรีสุข', 'ธนา รุ่งเรือง', 'มาลี สายสมร', 'กิตติ พานทอง', 'นภา ทองดี'].map((n) => byName.get(n)!);
    ids.forEach((i) => expect(i).toBeTruthy());
    const team = async (q: string) => (await data<Array<{ teamId: string }>>(await committeeCtx.get(`teams/suggest?q=${q}`)))[0].teamId;
    const [blue, red, green] = [await team('blue'), await team('red'), await team('green')];
    const pairs = [
      [[ids[0], blue], [ids[1], red]],
      [[ids[2], red], [ids[3], green]],
      [[ids[4], green], [ids[5], blue]],
    ];
    for (const [k, pair] of pairs.entries()) {
      const c = await adminCtx.post(`events/${eventId}/entries`, {
        data: { name: `Full pair ${k + 1}`, players: pair.map(([userId, teamId]) => ({ userId, teamId })) },
      });
      expect(c.status(), await c.text()).toBe(201);
      const eid = (await data(c)).id as string;
      expect((await adminCtx.post(`entries/${eid}/forward`)).status()).toBe(200);
      expect((await committeeCtx.post(`entries/${eid}/approve`, { data: {} })).status()).toBe(200);
    }
    // seeded umpire1 is assigned to this event (courts empty = match court)
    sql(`insert into event_umpires (event_id,user_id,courts,created_at) select '${eventId}',id,'{}',now() from users where email='umpire1@blulens.local' on conflict do nothing`);
  });

  test.describe('committee UI', () => {
    test.use({ storageState: COMMITTEE_AUTH_FILE });

    test('F2 draw: preview, acknowledge conflicts, publish through the UI', async ({ page }) => {
      await page.goto(`/committee/events/${eventId}/groups`);
      await page.getByTestId('draw-preview').click({ timeout: 30000 });
      await expect(page.getByTestId('draw-conflicts')).toBeVisible({ timeout: 20000 });
      await page.getByTestId('draw-ack-conflicts').check();
      await page.getByTestId('draw-conflict-reason').fill('ยอมรับทีมชนกัน');
      await page.getByTestId('draw-publish').click();
      const post = page.waitForResponse((r) => /\/draws\/[^/]+\/publish/.test(r.url()) && r.request().method() === 'POST');
      await page.getByTestId('confirm-publish').click();
      expect((await post).status()).toBe(200);
      await expect(page.getByTestId('draw-published')).toBeVisible({ timeout: 20000 });
    });

    test('F3 publishing created 3 scheduled round-robin matches; locking now is refused (GROUP_MATCHES_INCOMPLETE)', async () => {
      const res = await publicCtx.get(`events/${eventId}/matches?stage=group`);
      expect(res.status(), await res.text()).toBe(200);
      const ms = rowsOf(await data(res)).filter((m) => m.stage === 'group');
      expect(ms.length, 'one group of 3 = 3 matches').toBe(3);
      expect(ms.every((m) => m.status === 'scheduled')).toBe(true);
      matchIds = ms.map((m) => m.id);
      // freshly published matches have no court; an EventUmpire with courts [] must still be able to report them (bl-25-15)
      expect(ms.every((m) => !m.court), 'matches start without a court').toBe(true);

      const early = await committeeCtx.post(`events/${eventId}/groups/confirm`);
      expect(early.status()).toBe(409);
      expect(await errCode(early)).toBe('GROUP_MATCHES_INCOMPLETE');
    });

    test('F4 umpire1 reports all 3 matches (top side wins each)', async () => {
      for (const id of matchIds) {
        const res = await umpireCtx.put(`matches/${id}/result`, {
          data: { outcome: 'played', games: [{ a: 15, b: 9 }, { a: 15, b: 7 }] },
        });
        expect(res.status(), await res.text()).toBe(200);
      }
      expect(sql(`select count(*) from matches where event_id='${eventId}' and stage='group' and status='reported'`)).toBe('3');
      // reported but unconfirmed: still not lockable
      const early = await committeeCtx.post(`events/${eventId}/groups/confirm`);
      expect(early.status()).toBe(409);
      expect(await errCode(early)).toBe('GROUP_MATCHES_INCOMPLETE');
    });

    test('F5 Committee approves all three in the results queue', async ({ page }) => {
      await page.goto(`/committee/events/${eventId}/results`);
      await expect(page.getByTestId('groupconfirm')).toBeVisible({ timeout: 20000 });
      await expect(page.getByTestId('groupconfirm-button'), 'disabled while matches are open').toBeDisabled();
      for (let left = 3; left > 0; left--) {
        await expect(page.getByTestId('result-row')).toHaveCount(left, { timeout: 20000 });
        await page.getByTestId('result-row').first().getByTestId('result-approve').click();
        const post = page.waitForResponse((r) => /\/result\/approve/.test(r.url()) && r.request().method() === 'POST');
        await page.getByTestId('confirm-submit').click();
        expect((await post).status()).toBe(200);
      }
      await expect.poll(() => sql(`select count(*) from matches where event_id='${eventId}' and stage='group' and status='confirmed'`)).toBe('3');
      await page.reload();
      await expect(page.getByTestId('groupconfirm-button'), 'enabled when all group matches are confirmed').toBeEnabled({ timeout: 20000 });
    });

    test('F6 live standings: ranks 1-3, each played 2, not yet confirmed; public page marks them provisional', async ({ page }) => {
      const rows: any[] = await data(await publicCtx.get(`events/${eventId}/standings`));
      expect(rows.length).toBe(3);
      expect(rows.map((r) => r.rank).sort()).toEqual([1, 2, 3]);
      expect(rows.every((r) => r.played === 2)).toBe(true);
      expect(rows.every((r) => r.confirmed === false), 'live standings before lock').toBe(true);
      await page.goto(`/events/${eventId}/bracket`);
      await expect(page.getByTestId('standing-row')).toHaveCount(3, { timeout: 30000 });
      await expect(page.getByTestId('standings-provisional'), 'unlocked standings are provisional').toBeVisible();
    });
  });

  test.describe('committee lock UI', () => {
    test.use({ storageState: COMMITTEE_AUTH_FILE });

    test('F7 Committee locks the group stage with the button: snapshot with qualification, draw locked', async ({ page }) => {
      await page.goto(`/committee/events/${eventId}/results`);
      await page.getByTestId('groupconfirm-button').click({ timeout: 20000 });
      const post = page.waitForResponse((r) => r.url().includes(`/events/${eventId}/groups/confirm`) && r.request().method() === 'POST');
      await page.getByTestId('groupconfirm-dialog-confirm').click();
      const res = await post;
      expect(res.status(), await res.text()).toBe(200);
      const body: any = await res.json();
      const rows: any[] = body.data ?? body;
      expect(rows.length).toBe(3);
      expect(rows.every((r) => r.confirmed === true)).toBe(true);
      const byRank = [...rows].sort((a, b) => a.rank - b.rank);
      expect(byRank.map((r) => r.qualification)).toEqual(['qualified', 'qualified', 'out']);
      await expect(page.getByTestId('groupconfirm-done')).toBeVisible({ timeout: 20000 });
      expect(sql(`select status from draws where event_id='${eventId}' and kind='group' and status in ('published','locked') limit 1`)).toBe('locked');
      expect(sql(`select count(*) from audit_logs a join draws d on d.id::text=a.entity_id where a.action='groups.confirm' and d.event_id='${eventId}'`)).toBe('1');
      const pub: any[] = await data(await publicCtx.get(`events/${eventId}/standings`));
      expect(pub.every((r) => r.confirmed === true)).toBe(true);
    });

    test('F7b after reload the page shows the done state and no confirm button', async ({ page }) => {
      await page.goto(`/committee/events/${eventId}/results`);
      await expect(page.getByTestId('groupconfirm-done')).toBeVisible({ timeout: 20000 });
      await expect(page.getByTestId('groupconfirm-button')).toHaveCount(0);
    });
  });

  test('F8 after the lock: second confirm, new result, reject are all refused', async () => {
    const again = await committeeCtx.post(`events/${eventId}/groups/confirm`);
    expect(again.status()).toBe(409);
    expect(await errCode(again)).toBe('DRAW_ALREADY_LOCKED');

    const reject = await committeeCtx.post(`matches/${matchIds[0]}/result/reject`, { data: { reason: 'try after lock' } });
    expect(reject.status(), await reject.text()).toBe(409);
    expect(await errCode(reject)).toBe('STAGE_CONFIRMED');

    const put = await umpireCtx.put(`matches/${matchIds[1]}/result`, { data: { outcome: 'played', games: [{ a: 15, b: 1 }, { a: 15, b: 1 }] } });
    expect(put.status(), await put.text()).toBe(409);
    expect(['STAGE_CONFIRMED', 'MATCH_ALREADY_CONFIRMED']).toContain(await errCode(put));
    expect(sql(`select count(*) from matches where event_id='${eventId}' and stage='group' and status='confirmed'`)).toBe('3');
  });

  test('F9 public bracket page (anonymous): confirmed group table, no provisional banner', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3190' });
    const page: Page = await ctx.newPage();
    await page.goto(`/events/${eventId}/bracket`);
    await expect(page.getByTestId('group-standings').first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('standing-row')).toHaveCount(3);
    await expect(page.getByTestId('standings-provisional'), 'locked standings are not provisional').toHaveCount(0);
    await ctx.close();
  });

  test('F10 public standings page (guest) renders the night theme (bl-32): bg #1c1926, pixel font on the lock badge', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3190' });
    const page: Page = await ctx.newPage();
    await page.goto(`/events/${eventId}/standings`);
    const main = page.getByTestId('standings-page');
    await expect(page.getByTestId('standings-lock')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('standings-lock')).toHaveAttribute('data-locked', 'true');
    const bg = await main.evaluate((el) => getComputedStyle(el).backgroundColor);
    const font = await page.getByTestId('standings-lock').evaluate((el) => getComputedStyle(el).fontFamily);
    console.log('standings computed: bg=', bg, 'lock font=', font);
    expect(bg, 'main background is night #1c1926').toBe('rgb(28, 25, 38)');
    expect(font, 'lock badge uses the pixel font').toMatch(/Press Start 2P|monospace/);
    await ctx.close();
  });
});
