import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { execFileSync } from 'child_process';
import { COMMITTEE_AUTH_FILE } from './selectors';

/**
 * Umpire assignment screen (bl-34): /committee/events/{id}/umpires.
 * Fresh event per run (3 club-sharing approved pairs, one group of 3 = 3 matches, draw published through the API).
 * SQL only on blulens_e2e (hard-coded): Umpire role for one player (removed afterwards if we added it).
 */

const API_BASE = (process.env.API_URL ?? 'http://localhost:3191').replace(/\/+$/, '') + '/api/v1/';
const PG_CONTAINER = process.env.E2E_PG_CONTAINER ?? 'blulens-postgres';
const PG_USER = process.env.E2E_PG_USER ?? 'blulens';
const PLAYER = 'สมชาย ใจดี';

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
const rowsOf = (d: any): any[] => (Array.isArray(d) ? d : d?.items ?? d?.matches ?? []);

test.describe.serial('umpire assignment screen', () => {
  let adminCtx: APIRequestContext;
  let committeeCtx: APIRequestContext;
  let eventId = '';
  let umpire1Id = '';
  let playerId = '';
  let addedRole = false;
  let matchIds: string[] = [];
  let playerMatchId = '';
  let otherMatchId = '';

  test.beforeAll(async ({ playwright }) => {
    const pw = process.env.SEED_DEMO_PASSWORD;
    const apw = process.env.SEED_ADMIN_PASSWORD;
    if (!pw || !apw) throw new Error('SEED_DEMO_PASSWORD and SEED_ADMIN_PASSWORD must be set (no defaults)');
    const mk = () => playwright.request.newContext({ baseURL: API_BASE });
    [adminCtx, committeeCtx] = [await mk(), await mk()];
    await login(adminCtx, process.env.SEED_ADMIN_EMAIL ?? 'admin@blulens.local', apw);
    await login(committeeCtx, 'committee@blulens.local', pw);
  });

  test.afterAll(async () => {
    if (addedRole) sql(`delete from user_roles where user_id='${playerId}' and role='Umpire'`);
  });

  test('A1 setup: event with a published group of 3 (3 matches, none with court/umpire)', async () => {
    umpire1Id = sql(`select id from users where email='umpire1@blulens.local'`);
    expect(umpire1Id, 'seeded umpire1').toBeTruthy();
    const t = await adminCtx.post('tournaments', {
      data: { name: `QA Tourney umpires ${Date.now()}`, venue: 'e2e', startsOn: '2094-01-01', entriesCloseAt: '2093-12-20T23:59:00.000Z' },
    });
    expect(t.status(), await t.text()).toBe(201);
    const tid = (await data(t)).id as string;
    const ev = await adminCtx.post(`tournaments/${tid}/events`, { data: { discipline: 'MD', gradeMin: 'RK1', gradeMax: 'P+', maxEntries: 16, minReviewers: 2 } });
    expect(ev.status(), await ev.text()).toBe(201);
    eventId = (await data(ev)).id as string;
    expect((await adminCtx.put(`events/${eventId}/format`, { data: { type: 'groups_knockout', groupSize: 3, advancePerGroup: 2, bestThirds: 0 } })).status()).toBe(200);
    expect((await committeeCtx.post(`tournaments/${tid}/status`, { data: { to: 'open' } })).status()).toBe(200);

    const names = [PLAYER, 'วิภา ศรีสุข', 'ธนา รุ่งเรือง', 'มาลี สายสมร', 'กิตติ พานทอง', 'นภา ทองดี'];
    const ids: string[] = [];
    for (const n of names) {
      const r = await data<{ items: Array<{ id: string; displayName: string }> }>(await committeeCtx.get(`users?role=Member&limit=20&q=${encodeURIComponent(n)}`));
      const hit = r.items.find((u) => u.displayName === n);
      expect(hit, n).toBeTruthy();
      ids.push(hit!.id);
    }
    playerId = ids[0];
    const team = async (q: string) => (await data<Array<{ teamId: string }>>(await committeeCtx.get(`teams/suggest?q=${q}`)))[0].teamId;
    const [blue, red, green] = [await team('blue'), await team('red'), await team('green')];
    const pairs = [[[ids[0], blue], [ids[1], red]], [[ids[2], red], [ids[3], green]], [[ids[4], green], [ids[5], blue]]];
    for (const [k, pair] of pairs.entries()) {
      const c = await adminCtx.post(`events/${eventId}/entries`, { data: { name: `Ump pair ${k + 1}`, players: pair.map(([userId, teamId]) => ({ userId, teamId })) } });
      expect(c.status(), await c.text()).toBe(201);
      const eid = (await data(c)).id as string;
      expect((await adminCtx.post(`entries/${eid}/forward`)).status()).toBe(200);
      expect((await committeeCtx.post(`entries/${eid}/approve`, { data: {} })).status()).toBe(200);
    }
    const pv = await committeeCtx.post(`events/${eventId}/groups/preview`, { data: {} });
    expect(pv.status(), await pv.text()).toBe(201);
    const pub = await committeeCtx.post(`draws/${(await data(pv)).id}/publish`, { data: { acknowledgeConflicts: true, reason: 'ยอมรับทีมชนกัน' } });
    expect(pub.status(), await pub.text()).toBe(200);

    // one of the players also holds the Umpire role (to provoke UMPIRE_IS_PLAYER)
    if (sql(`select count(*) from user_roles where user_id='${playerId}' and role='Umpire'`) === '0') {
      sql(`insert into user_roles (user_id,role,created_at) values ('${playerId}','Umpire',now())`);
      addedRole = true;
    }
    const ms = rowsOf(await data(await committeeCtx.get(`events/${eventId}/matches?stage=group`))).filter((m) => m.stage === 'group');
    expect(ms.length).toBe(3);
    matchIds = ms.map((m) => m.id);
    expect(ms.every((m) => !m.court && !m.umpireId)).toBe(true);
    playerMatchId = sql(`select m.id from matches m join entry_players ep on ep.entry_id in (m.top_entry_id,m.bottom_entry_id) where m.event_id='${eventId}' and ep.user_id='${playerId}' limit 1`);
    otherMatchId = sql(`select m.id from matches m where m.event_id='${eventId}' and m.id<>'${playerMatchId}' and not exists (select 1 from entry_players ep where ep.entry_id in (m.top_entry_id,m.bottom_entry_id) and ep.user_id='${playerId}') limit 1`);
    expect(playerMatchId && otherMatchId).toBeTruthy();
  });

  test.describe('committee UI', () => {
    test.use({ storageState: COMMITTEE_AUTH_FILE });

    test('A2 event without umpires: empty state AND a way to add the first umpire', async ({ page }) => {
      test.fail(true, 'KNOWN ISSUE (bl-34): UmpireAssignment returns the bare empty state when the event has no umpires, so there is no add button, no match table and no way to add the first umpire from the UI');
      await page.goto(`/committee/events/${eventId}/umpires`);
      await expect(page.getByTestId('umpire-empty')).toBeVisible({ timeout: 30000 });
      await expect(page.getByRole('button', { name: /เพิ่มกรรมการ/ }), 'the first umpire must be addable from the screen').toBeVisible();
    });

    test('A3 umpire1 listed with "ทุกสนาม"; adding a second umpire from the UI saves (PUT 200)', async ({ page }) => {
      const put = await committeeCtx.put(`events/${eventId}/umpires`, { data: [{ userId: umpire1Id, courts: [] }] });
      expect(put.status(), await put.text()).toBe(200);
      await page.goto(`/committee/events/${eventId}/umpires`);
      await expect(page.getByTestId('umpire-list')).toBeVisible({ timeout: 30000 });
      await expect(page.getByTestId(`umpire-row-${umpire1Id}`)).toContainText('ทุกสนาม');
      await page.getByRole('button', { name: /เพิ่มกรรมการ/ }).click();
      const resp = page.waitForResponse((r) => r.url().includes(`/events/${eventId}/umpires`) && r.request().method() === 'PUT');
      await page.getByTestId('umpire-list').getByRole('combobox').selectOption({ value: playerId });
      expect((await resp).status()).toBe(200);
      await expect(page.getByTestId(`umpire-row-${playerId}`)).toBeVisible({ timeout: 20000 });
      const got = await data<Array<{ userId: string }>>(await committeeCtx.get(`events/${eventId}/umpires`));
      expect(got.map((u) => u.userId).sort()).toEqual([umpire1Id, playerId].sort());
    });

    test('A4 banner umpire-missing counts matches without an umpire (3)', async ({ page }) => {
      await page.goto(`/committee/events/${eventId}/umpires`);
      await expect(page.getByTestId('umpire-matches')).toBeVisible({ timeout: 30000 });
      await expect(page.getByTestId('umpire-match-row-' + matchIds[0])).toBeVisible();
      await expect(page.getByTestId('umpire-missing')).toContainText('3');
    });

    test('A5 set court + umpire1 on a match: PATCH 200, persisted, banner drops to 2', async ({ page }) => {
      await page.goto(`/committee/events/${eventId}/umpires`);
      const row = page.getByTestId(`umpire-match-row-${otherMatchId}`);
      await expect(row).toBeVisible({ timeout: 30000 });
      let resp = page.waitForResponse((r) => r.url().includes(`/matches/${otherMatchId}/assignment`) && r.request().method() === 'PATCH');
      await row.locator('input').fill('E2');
      expect((await resp).status()).toBe(200);
      resp = page.waitForResponse((r) => r.url().includes(`/matches/${otherMatchId}/assignment`) && r.request().method() === 'PATCH');
      await row.locator('select').selectOption({ value: umpire1Id });
      expect((await resp).status()).toBe(200);
      await expect(page.getByTestId('umpire-missing')).toContainText('2', { timeout: 20000 });
      expect(sql(`select court||'|'||umpire_id from matches where id='${otherMatchId}'`)).toBe(`E2|${umpire1Id}`);
      await page.reload();
      await expect(page.getByTestId(`umpire-match-row-${otherMatchId}`).locator('input')).toHaveValue('E2', { timeout: 30000 });
    });

    test('A6 umpire who plays in the match: Thai UMPIRE_IS_PLAYER on the row, nothing saved, banner unchanged', async ({ page }) => {
      await page.goto(`/committee/events/${eventId}/umpires`);
      const row = page.getByTestId(`umpire-match-row-${playerMatchId}`);
      await expect(row).toBeVisible({ timeout: 30000 });
      const resp = page.waitForResponse((r) => r.url().includes(`/matches/${playerMatchId}/assignment`) && r.request().method() === 'PATCH');
      await row.locator('select').selectOption({ value: playerId });
      const r = await resp;
      expect(r.status(), await r.text()).toBe(409);
      await expect(row.locator('p.text-destructive')).toBeVisible();
      await expect(row.locator('p.text-destructive')).not.toContainText('UMPIRE_IS_PLAYER');
      await expect(row.locator('p.text-destructive')).toContainText(/[ก-๙]/);
      expect(sql(`select coalesce(umpire_id::text,'none') from matches where id='${playerMatchId}'`)).toBe('none');
      await expect(page.getByTestId('umpire-missing')).toContainText('2');
    });
  });

  test('A7 API guards: only Committee/Admin may assign (member 403)', async ({ playwright }) => {
    const m = await playwright.request.newContext({ baseURL: API_BASE });
    await login(m, 'member2@blulens.local', process.env.SEED_DEMO_PASSWORD!);
    const r = await m.patch(`matches/${matchIds[0]}/assignment`, { data: { court: 'X' } });
    expect(r.status()).toBe(403);
    expect((await m.put(`events/${eventId}/umpires`, { data: [] })).status()).toBe(403);
  });

  test('A8 umpire sees only matches assigned to them: courts [E2] -> only the E2 match; court-null rule: courts [] -> all of the event', async ({ playwright }) => {
    const u = await playwright.request.newContext({ baseURL: API_BASE });
    await login(u, 'umpire1@blulens.local', process.env.SEED_DEMO_PASSWORD!);
    const mine = async () => {
      const r = await u.get('umpire/matches');
      expect(r.status(), await r.text()).toBe(200);
      return rowsOf(await data(r)).filter((m) => matchIds.includes(m.id)).map((m) => m.id as string);
    };
    const put = async (courts: string[]) => {
      const r = await committeeCtx.put(`events/${eventId}/umpires`, { data: [{ userId: umpire1Id, courts }, { userId: playerId, courts: [] }] });
      expect(r.status(), await r.text()).toBe(200);
    };
    await put(['E2']);
    expect(await mine(), 'only the match on court E2 (A5)').toEqual([otherMatchId]);
    const third = matchIds.find((id) => id !== otherMatchId && id !== playerMatchId)!;
    const p1 = await committeeCtx.patch(`matches/${third}/assignment`, { data: { court: 'Z9' } });
    expect(p1.status(), await p1.text()).toBe(200);
    expect(await mine(), 'court Z9 is not umpire1 court').toEqual([otherMatchId]);
    const p2 = await committeeCtx.patch(`matches/${third}/assignment`, { data: { umpireId: umpire1Id } });
    expect(p2.status(), await p2.text()).toBe(200);
    expect((await mine()).sort(), 'directly assigned match is visible whatever the court').toEqual([otherMatchId, third].sort());
    await put([]);
    expect((await mine()).sort(), 'courts [] = every court, court-null match included (04daa20)').toEqual(
      [...matchIds].sort(),
    );
  });

  test('A9 PUT umpires with a bad body -> 400 VALIDATION_FAILED, list unchanged', async () => {
    const before = JSON.stringify(await data(await committeeCtx.get(`events/${eventId}/umpires`)));
    for (const body of [[{ userId: 'not-a-uuid', courts: [] }], [{ userId: umpire1Id, courts: [''] }], [{ userId: umpire1Id }, { userId: umpire1Id }]]) {
      const r = await committeeCtx.put(`events/${eventId}/umpires`, { data: body });
      expect(r.status(), JSON.stringify(body)).toBe(400);
      const j = await r.json();
      expect((j?.error ?? j)?.code).toBe('VALIDATION_FAILED');
    }
    expect(JSON.stringify(await data(await committeeCtx.get(`events/${eventId}/umpires`)))).toBe(before);
  });
});
