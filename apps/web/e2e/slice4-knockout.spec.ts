import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { COMMITTEE_AUTH_FILE } from './selectors';

/**
 * Slice 4 knockout gate (bl-33): locked group standings -> Committee "จัดสายน็อกเอาต์" (preview, re-roll with reason, publish)
 * -> umpire reports -> Committee confirms -> winners progress -> third place + champion -> public bracket.
 * Main flow: 6 pairs, groupSize 3 (2 groups), advance 2 -> 4 qualifiers: semi-finals, final, third place.
 * Bye flow (API only): 7 pairs, groupSize 4 (4+3), advance 2 + 1 best third -> 5 qualifiers, bracket of 8 with 3 byes.
 * Group and knockout results are entered through the API (umpire1 reports, Committee approves); the group lock, the knockout
 * draw and the public page go through the UI. No SQL. See docs/qa/slice4-knockout-e2e.md.
 */

const API_BASE = (process.env.API_URL ?? 'http://localhost:3191').replace(/\/+$/, '') + '/api/v1/';
const WEB_BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3190';
const NAMES = [
  'สมชาย ใจดี', 'วิภา ศรีสุข', 'ธนา รุ่งเรือง', 'มาลี สายสมร', 'กิตติ พานทอง', 'นภา ทองดี', 'ประสิทธิ์ เนตรดี',
  'ชิดชนัย วิชัยศรม', 'ธัญญา ครุธนนต์', 'เสกสรร ศรีสวัสดิ์', 'ปัญญา พิบูลย์พจน์', 'จตุรนต์ ดำรงค์', 'สุทธิดา วงศ์วิทยา', 'ปิยะพัฒน์ เกิดสถาน',
];
const KO_GAMES = [{ a: 21, b: 10 }, { a: 21, b: 12 }];

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

let adminCtx: APIRequestContext;
let committeeCtx: APIRequestContext;
let umpireCtx: APIRequestContext;
let publicCtx: APIRequestContext;
let umpire1Id = '';
const nameIds = new Map<string, string>();
let dateSeq = 0;

test.beforeAll(async ({ playwright }) => {
  const pw = process.env.SEED_DEMO_PASSWORD;
  const apw = process.env.SEED_ADMIN_PASSWORD;
  if (!pw || !apw) throw new Error('SEED_DEMO_PASSWORD and SEED_ADMIN_PASSWORD must be set (no defaults)');
  const mk = () => playwright.request.newContext({ baseURL: API_BASE });
  [adminCtx, committeeCtx, umpireCtx, publicCtx] = [await mk(), await mk(), await mk(), await mk()];
  await login(adminCtx, process.env.SEED_ADMIN_EMAIL ?? 'admin@blulens.local', apw);
  await login(committeeCtx, 'committee@blulens.local', pw);
  await login(umpireCtx, 'umpire1@blulens.local', pw);
  for (const n of NAMES) {
    const r = await data<{ items: Array<{ id: string; displayName: string }> }>(await committeeCtx.get(`users?role=Member&limit=20&q=${encodeURIComponent(n)}`));
    const hit = r.items.find((u) => u.displayName === n);
    expect(hit, `member ${n}`).toBeTruthy();
    nameIds.set(n, hit!.id);
  }
  const me = await umpireCtx.get('auth/me');
  expect(me.status(), await me.text()).toBe(200);
  umpire1Id = (await data(me)).id ?? (await data(me)).user?.id ?? '';
  expect(umpire1Id, 'seeded umpire1 in users?role=Umpire').toBeTruthy();
});

/** Fresh event with `pairs` approved pairs; group format given. Returns eventId. */
async function setupEvent(label: string, pairs: number, format: Record<string, unknown>): Promise<string> {
  const day = String(1 + ((dateSeq++ + Math.floor(Date.now() / 1000)) % 27)).padStart(2, '0');
  const t = await adminCtx.post('tournaments', {
    data: { name: `QA Tourney ko ${label} ${Date.now()}`, venue: 'e2e', startsOn: `2093-0${1 + (Date.now() % 9)}-${day}`, entriesCloseAt: '2092-12-20T23:59:00.000Z' },
  });
  expect(t.status(), await t.text()).toBe(201);
  const tid = (await data(t)).id as string;
  const ev = await adminCtx.post(`tournaments/${tid}/events`, { data: { discipline: 'MD', gradeMin: 'RK1', gradeMax: 'P+', maxEntries: 16, minReviewers: 2 } });
  expect(ev.status(), await ev.text()).toBe(201);
  const eventId = (await data(ev)).id as string;
  const fmt = await adminCtx.put(`events/${eventId}/format`, { data: format });
  expect(fmt.status(), await fmt.text()).toBe(200);
  expect((await committeeCtx.post(`tournaments/${tid}/status`, { data: { to: 'open' } })).status()).toBe(200);
  const team = async (q: string) => (await data<Array<{ teamId: string }>>(await committeeCtx.get(`teams/suggest?q=${q}`)))[0].teamId;
  const teams = [await team('blue'), await team('red'), await team('green')];
  for (let k = 0; k < pairs; k++) {
    const players = [NAMES[2 * k], NAMES[2 * k + 1]].map((n, j) => ({ userId: nameIds.get(n)!, teamId: teams[(k + j) % 3] }));
    const c = await adminCtx.post(`events/${eventId}/entries`, { data: { name: `KO ${label} pair ${k + 1}`, players } });
    expect(c.status(), await c.text()).toBe(201);
    const eid = (await data(c)).id as string;
    expect((await adminCtx.post(`entries/${eid}/forward`)).status()).toBe(200);
    expect((await committeeCtx.post(`entries/${eid}/approve`, { data: {} })).status()).toBe(200);
  }
  const put = await committeeCtx.put(`events/${eventId}/umpires`, { data: [{ userId: umpire1Id, courts: [] }] });
  expect(put.status(), await put.text()).toBe(200);
  return eventId;
}

async function publishGroups(eventId: string) {
  const pv = await committeeCtx.post(`events/${eventId}/groups/preview`, { data: {} });
  expect(pv.status(), await pv.text()).toBe(201);
  const pub = await committeeCtx.post(`draws/${(await data(pv)).id}/publish`, { data: { acknowledgeConflicts: true, reason: 'ยอมรับทีมชนกัน' } });
  expect(pub.status(), await pub.text()).toBe(200);
}

/** umpire1 reports every group match (top wins, distinct margins), Committee approves each. */
async function playGroups(eventId: string) {
  const ms = rowsOf(await data(await committeeCtx.get(`events/${eventId}/matches?stage=group`))).filter((m) => m.stage === 'group');
  expect(ms.length).toBeGreaterThan(0);
  for (const [k, m] of ms.entries()) {
    const rep = await umpireCtx.put(`matches/${m.id}/result`, { data: { outcome: 'played', games: [{ a: 15, b: 2 + (k % 10) }, { a: 15, b: 1 }] } });
    expect(rep.status(), await rep.text()).toBe(200);
    const ap = await committeeCtx.post(`matches/${m.id}/result/approve`);
    expect(ap.status(), await ap.text()).toBe(200);
  }
}

const bracketOf = async (ctx: APIRequestContext, eventId: string) => {
  const r = await ctx.get(`events/${eventId}/bracket`);
  expect(r.status(), await r.text()).toBe(200);
  return data<any>(r);
};
const koMatches = async (eventId: string) =>
  rowsOf(await data(await committeeCtx.get(`events/${eventId}/matches`))).filter((m) => m.stage === 'knockout' || m.stage === 'third_place');

async function reportAndConfirm(matchId: string) {
  const rep = await umpireCtx.put(`matches/${matchId}/result`, { data: { outcome: 'played', games: KO_GAMES } });
  expect(rep.status(), await rep.text()).toBe(200);
  const ap = await committeeCtx.post(`matches/${matchId}/result/approve`);
  expect(ap.status(), await ap.text()).toBe(200);
}

test.describe.serial('slice 4 knockout: 4 qualifiers (semi-finals, final, third place)', () => {
  let eventId = '';
  let firstPreviewId = '';
  let secondPreviewId = '';

  test('K1 setup: 6 pairs, 2 groups of 3, groups published', async () => {
    eventId = await setupEvent('main', 6, { type: 'groups_knockout', groupSize: 3, advancePerGroup: 2, bestThirds: 0 });
    // knockout preview before the groups are confirmed is refused
    await publishGroups(eventId);
    const early = await committeeCtx.post(`events/${eventId}/knockout/preview`, { data: {} });
    expect(early.status(), await early.text()).toBe(409);
    expect(await errCode(early)).toBe('GROUP_STAGE_NOT_CONFIRMED');
  });

  test.describe('committee UI', () => {
    test.use({ storageState: COMMITTEE_AUTH_FILE });

    test('K2 group matches played and approved; knockout panel is hidden until the groups are locked, then locking through the UI shows it', async ({ page }) => {
      await playGroups(eventId);
      await page.goto(`/committee/events/${eventId}/results`);
      await expect(page.getByTestId('groupconfirm-button')).toBeEnabled({ timeout: 30000 });
      await expect(page.getByTestId('knockout-draw-panel'), 'no knockout panel before the lock').toHaveCount(0);
      await page.getByTestId('groupconfirm-button').dispatchEvent('click');
      await page.getByTestId('groupconfirm-dialog-confirm').click();
      await expect(page.getByTestId('groupconfirm-done')).toBeVisible({ timeout: 30000 });
      await expect(page.getByTestId('knockout-draw-panel')).toBeVisible({ timeout: 30000 });
    });

    test('K3 preview shows 4 teams / 2 rounds / 2 pairings; re-roll needs a reason (>=5) -> version 2; publish creates the matches', async ({ page }) => {
      await page.goto(`/committee/events/${eventId}/results`);
      const resp1 = page.waitForResponse((r) => r.url().includes(`/events/${eventId}/knockout/preview`) && r.request().method() === 'POST');
      await page.getByTestId('knockout-preview').click({ timeout: 30000 });
      const r1 = await resp1;
      expect(r1.status(), await r1.text()).toBe(201);
      { const j = await r1.json(); firstPreviewId = (j.data ?? j).id; }
      await expect(page.getByTestId('knockout-preview-summary')).toContainText('4 ทีม');
      await expect(page.getByTestId('knockout-preview-summary')).toContainText('2 รอบ');
      await expect(page.getByTestId('knockout-pairing-card')).toHaveCount(2);
      await expect(page.getByTestId('knockout-publish')).toBeEnabled();

      await page.getByTestId('knockout-reroll').click();
      await page.getByTestId('reason-input').fill('abcd');
      await expect(page.getByTestId('reason-submit')).toBeDisabled();
      await page.getByTestId('reason-input').fill('สุ่มสายใหม่เพื่อลดคู่ชน');
      const resp2 = page.waitForResponse((r) => r.url().includes(`/events/${eventId}/knockout/preview`) && r.request().method() === 'POST');
      await page.getByTestId('reason-submit').click();
      const r2 = await resp2;
      expect(r2.status(), await r2.text()).toBe(201);
      { const j = await r2.json(); secondPreviewId = (j.data ?? j).id; }
      expect(secondPreviewId).not.toBe(firstPreviewId);
      await expect(page.getByTestId('knockout-preview-summary')).toContainText('ฉบับที่ 2');

      // publish the re-rolled preview in the same page session (the page keeps the preview in state only)
      await page.getByTestId('knockout-publish').click();
      const post = page.waitForResponse((r) => /\/draws\/[^/]+\/publish/.test(r.url()) && r.request().method() === 'POST');
      await page.getByTestId('knockout-publish-confirm').click();
      const pr = await post;
      expect(pr.status(), await pr.text()).toBe(200);
      await expect(page.getByTestId('knockout-published')).toBeVisible({ timeout: 20000 });
      const ko = await koMatches(eventId);
      expect(ko.filter((m) => m.stage === 'knockout' && m.round === 1).length, 'two semi-finals').toBe(2);
      expect(ko.filter((m) => m.stage === 'knockout' && m.round === 2).length, 'one final').toBe(1);
      expect(ko.filter((m) => m.stage === 'third_place').length, 'one third-place match').toBe(1);
      expect(ko.filter((m) => m.stage === 'knockout' && m.round === 1).every((m) => m.status === 'scheduled' && m.aEntry && m.bEntry)).toBe(true);
    });
  });

  test('K5 after publish: bracket is not provisional (size 4, 2 rounds, third place, no champion); new preview refused', async () => {
    const b = await bracketOf(publicCtx, eventId);
    expect(b.provisional).toBe(false);
    expect(b.size).toBe(4);
    expect(b.rounds.length).toBe(2);
    expect(b.thirdPlace, 'third place match present').toBeTruthy();
    expect(b.champion ?? null).toBeNull();
    const again = await committeeCtx.post(`events/${eventId}/knockout/preview`, { data: { reason: 'preview after publish' } });
    expect(again.status(), await again.text()).toBe(409);
    expect(await errCode(again)).toBe('DRAW_ALREADY_LOCKED');
  });

  test('K6 semi-finals: reported result does not advance; confirmed winners fill the final, losers fill third place', async () => {
    let ko = await koMatches(eventId);
    const semis = ko.filter((m) => m.stage === 'knockout' && m.round === 1);
    const final = ko.find((m) => m.stage === 'knockout' && m.round === 2)!;
    const third = ko.find((m) => m.stage === 'third_place')!;
    expect(!final.aEntry && !final.bEntry, 'final starts empty').toBe(true);

    const rep = await umpireCtx.put(`matches/${semis[0].id}/result`, { data: { outcome: 'played', games: KO_GAMES } });
    expect(rep.status(), await rep.text()).toBe(200);
    ko = await koMatches(eventId);
    expect(ko.find((m) => m.id === final.id)!.aEntry ?? null, 'a reported (unconfirmed) semi does not advance').toBeNull();
    expect((await committeeCtx.post(`matches/${semis[0].id}/result/approve`)).status()).toBe(200);
    await reportAndConfirm(semis[1].id);

    ko = await koMatches(eventId);
    const winners = semis.map((s) => ko.find((m) => m.id === s.id)!.aEntry.entryId ?? s.aEntry.entryId);
    const f = ko.find((m) => m.id === final.id)!;
    const t = ko.find((m) => m.id === third.id)!;
    expect([f.aEntry?.entryId, f.bEntry?.entryId].sort(), 'final = both semi winners (top side won)').toEqual(
      semis.map((s) => s.aEntry.entryId).sort(),
    );
    expect([t.aEntry?.entryId, t.bEntry?.entryId].sort(), 'third place = both semi losers').toEqual(
      semis.map((s) => s.bEntry.entryId).sort(),
    );
    expect(winners.length).toBe(2);
  });

  test('K7 final + third place confirmed: champion = final winner, bracket complete', async () => {
    const ko = await koMatches(eventId);
    const final = ko.find((m) => m.stage === 'knockout' && m.round === 2)!;
    const third = ko.find((m) => m.stage === 'third_place')!;
    await reportAndConfirm(final.id);
    await reportAndConfirm(third.id);
    const b = await bracketOf(publicCtx, eventId);
    expect(b.champion?.entryId, 'champion is the top side of the final').toBe(final.aEntry.entryId);
    expect(b.thirdPlace.winner).toBe(third.aEntry.entryId);
    const rejected = await umpireCtx.put(`matches/${final.id}/result`, { data: { outcome: 'played', games: KO_GAMES } });
    expect(rejected.status(), 'confirmed final cannot be reported again').toBe(409);
  });

  test('K8 public bracket (guest): semis + final with games and the winner marker', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB_BASE });
    const page = await ctx.newPage();
    await page.goto(`/events/${eventId}/bracket`);
    await page.getByRole('tab', { name: 'สายน็อคเอาท์' }).click({ timeout: 30000 });
    const tree = page.getByTestId('bracket-tree');
    await expect(tree).toBeAttached({ timeout: 30000 });
    const cards = tree.getByTestId('match-card');
    await expect(cards.first()).toBeAttached({ timeout: 20000 });
    await expect(tree.locator('[data-winner="true"]'), 'one winner marker per confirmed round match (2 semis + final)').toHaveCount(3);
    await expect(tree.getByTestId('match-score-summary').first()).toContainText('21–10');
    await ctx.close();
  });

  test('K8b KNOWN ISSUE (test.fail): the third-place match is on the public bracket (API has bracket.thirdPlace; the page renders only rounds)', async ({ browser }) => {
    test.fail(true, 'GET /events/{id}/bracket returns thirdPlace but BracketPage/Bracket render only rounds[], so the ชิงที่ 3 match and its winner never show');
    const ctx = await browser.newContext({ baseURL: WEB_BASE });
    const page = await ctx.newPage();
    await page.goto(`/events/${eventId}/bracket`);
    await page.getByRole('tab', { name: 'สายน็อคเอาท์' }).click({ timeout: 30000 });
    const tree = page.getByTestId('bracket-tree');
    await expect(tree.getByTestId('match-card')).toHaveCount(4, { timeout: 10000 });
    await expect(tree.getByTestId('match-third-place')).toHaveCount(1);
    await expect(tree.locator('[data-winner="true"]')).toHaveCount(4);
    await ctx.close();
  });
});

test.describe.serial('slice 4 knockout: 5 qualifiers (bracket of 8, byes)', () => {
  let eventId = '';

  test('B1 7 pairs, groups 4+3, advance 2 + 1 best third: preview has 8 slots with 3 byes; publish auto-advances the byes', async () => {
    eventId = await setupEvent('byes', 7, { type: 'groups_knockout', groupSize: 4, advancePerGroup: 2, bestThirds: 1 });
    await publishGroups(eventId);
    await playGroups(eventId);
    const lock = await committeeCtx.post(`events/${eventId}/groups/confirm`);
    expect(lock.status(), await lock.text()).toBe(200);

    const pv = await committeeCtx.post(`events/${eventId}/knockout/preview`, { data: {} });
    expect(pv.status(), await pv.text()).toBe(201);
    const draw = await data(pv);
    expect(draw.size, 'next power of two >= 5').toBe(8);
    const byeSlots = (draw.slots ?? []).filter((s: any) => !s.entryId);
    expect(byeSlots.length, 'bye = 8 - 5').toBe(3);
    const pub = await committeeCtx.post(`draws/${draw.id}/publish`, { data: { acknowledgeConflicts: true, reason: 'ยอมรับคู่ชน' } });
    expect(pub.status(), await pub.text()).toBe(200);

    const ko = await koMatches(eventId);
    const r1 = ko.filter((m) => m.stage === 'knockout' && m.round === 1);
    expect(r1.length).toBe(4);
    expect(r1.filter((m) => m.status === 'bye').length, '3 first-round byes').toBe(3);
    const b = await bracketOf(publicCtx, eventId);
    expect(b.size).toBe(8);
    expect(b.rounds.length).toBe(3);
    const semis = b.rounds.find((r: any) => r.round === 2).matches;
    expect(semis.filter((m: any) => m.top || m.bottom).length, 'bye winners already sit in round 2').toBeGreaterThanOrEqual(2);
  });
});
