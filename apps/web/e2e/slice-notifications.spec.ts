import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { MEMBER_AUTH_FILE } from './selectors';

/**
 * In-app notifications N1-N8 (Kevin 54a5281 / 1e10970; UI ad63ee9): rows are created for the right recipient with an in-app
 * link, never for the actor, review_assigned is blind; then the bell, /notifications, open -> detail -> read, read-all.
 * Needs MinIO (real clip upload). SQL: read-only lookups + cloning a scheduled match, on blulens_e2e only.
 * See docs/qa/slice-notifications-e2e.md.
 */

const API_BASE = (process.env.API_URL ?? 'http://localhost:3191').replace(/\/+$/, '') + '/api/v1/';
const PG_CONTAINER = process.env.E2E_PG_CONTAINER ?? 'blulens-postgres';
const PG_USER = process.env.E2E_PG_USER ?? 'blulens';
const SAMPLE = readFileSync(join(__dirname, '..', 'public', 'e2e', 'sample.mp4'));
const GAMES = [{ a: 15, b: 11 }, { a: 15, b: 9 }];

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

test.describe.serial('notifications', () => {
  let member: APIRequestContext;
  let committee: APIRequestContext;
  let admin: APIRequestContext;
  let reviewers: APIRequestContext[] = [];
  let umpire: APIRequestContext;
  let ids = { a: '', b: '', c: '' };
  let reviewerIds: string[] = [];
  let criteria: string[] = [];
  let umpireId = '';

  const list = async (ctx: APIRequestContext, qs = 'limit=100') => data<any>(await ctx.get(`me/notifications?${qs}`));
  const find = (page: any, type: string, link?: string) =>
    page.items.find((n: any) => n.type === type && (link === undefined || n.link === link));

  async function prepare(): Promise<string> {
    const c = await member.post('assessments', { data: { note: `e2e notif ${Date.now()}` } });
    expect(c.status(), await c.text()).toBe(201);
    const id = (await data(c)).id as string;
    const up = await data(await member.post(`assessments/${id}/clips/upload-url`, { data: { fileName: 'sample.mp4', contentType: 'video/mp4', sizeBytes: SAMPLE.length } }));
    expect((await fetch(up.uploadUrl, { method: 'PUT', body: SAMPLE, headers: { 'Content-Type': 'video/mp4' } })).status).toBe(200);
    expect((await member.post(`clips/${up.clipId}/complete`, { data: { durationSec: 4 } })).status()).toBe(200);
    expect((await member.post(`assessments/${id}/submit`)).status()).toBe(200);
    const assign = await committee.post(`assessments/${id}/assign`, { data: { reviewerIds } });
    expect(assign.status(), await assign.text()).toBe(200);
    for (const [i, rid] of reviewerIds.entries()) {
      const aid = sql(`select id from review_assignments where assessment_id='${id}' and reviewer_id='${rid}'`);
      const put = await reviewers[i].put(`reviews/assignments/${aid}`, { data: { scores: criteria.map((criterion) => ({ criterion, gradeKey: 'S' })) } });
      expect(put.status(), await put.text()).toBe(200);
    }
    return id;
  }

  test.beforeAll(async ({ playwright }) => {
    const pw = process.env.SEED_DEMO_PASSWORD;
    const apw = process.env.SEED_ADMIN_PASSWORD;
    if (!pw || !apw) throw new Error('SEED_DEMO_PASSWORD and SEED_ADMIN_PASSWORD must be set (no defaults)');
    const mk = () => playwright.request.newContext({ baseURL: API_BASE });
    [member, committee, admin, umpire] = [await mk(), await mk(), await mk(), await mk()];
    reviewers = [await mk(), await mk()];
    await login(member, 'member1@blulens.local', pw);
    await login(committee, 'committee@blulens.local', pw);
    await login(admin, process.env.SEED_ADMIN_EMAIL ?? 'admin@blulens.local', apw);
    await login(reviewers[0], 'reviewer1@blulens.local', pw);
    await login(reviewers[1], 'reviewer2@blulens.local', pw);
    await login(umpire, 'umpire1@blulens.local', pw);
    reviewerIds = ['reviewer1', 'reviewer2'].map((n) => sql(`select id from users where email='${n}@blulens.local'`));
    umpireId = sql(`select id from users where email='umpire1@blulens.local'`);
    const rubric = await data<any>(await committee.get('rubric'));
    criteria = (rubric.criteria as Array<{ key: string }>).map((c) => c.key);
  });

  test('N0 notifications API: own rows only, shape, 401 without a session', async ({ playwright }) => {
    const anon = await playwright.request.newContext({ baseURL: API_BASE });
    expect((await anon.get('me/notifications')).status()).toBe(401);
    const p = await list(member, 'limit=1');
    expect(typeof p.unreadCount).toBe('number');
    expect(Array.isArray(p.items)).toBe(true);
    expect(p.items.length).toBeLessThanOrEqual(1);
  });

  test('N1 review_assigned: each reviewer is notified, text is blind (no subject, no assessment id), link /review', async () => {
    const before = await list(reviewers[0]);
    ids.a = await prepare();
    const after = await list(reviewers[0]);
    expect(after.unreadCount).toBeGreaterThan(before.unreadCount);
    const n = find(after, 'review_assigned', '/review');
    expect(n, 'review_assigned with link /review').toBeTruthy();
    expect(JSON.stringify(n)).not.toContain(ids.a);
    expect(JSON.stringify(n)).not.toContain('สมชาย');
    expect(find(await list(reviewers[1]), 'review_assigned', '/review')).toBeTruthy();
    expect(find(await list(committee), 'review_assigned'), 'the actor is not notified').toBeFalsy();
  });

  test('N2 approve -> member gets assessment_approved with the detail link; the acting Committee user gets nothing', async () => {
    const committeeBefore = (await list(committee)).items.length;
    const ap = await committee.post(`assessments/${ids.a}/approve`, { data: {} });
    expect(ap.status(), await ap.text()).toBe(200);
    const n = find(await list(member), 'assessment_approved', `/me/assessments/${ids.a}`);
    expect(n, 'assessment_approved for the member').toBeTruthy();
    expect(n.readAt).toBeNull();
    expect(n.title).toBeTruthy();
    expect(n.link.startsWith('/')).toBe(true);
    expect((await list(committee)).items.filter((x: any) => x.link === `/me/assessments/${ids.a}`).length).toBe(0);
    expect((await list(committee)).items.length).toBe(committeeBefore);
  });

  test('N3 return -> member gets assessment_returned carrying the reason', async () => {
    ids.b = await prepare();
    const reason = 'ขอให้ตรวจใหม่อีกครั้ง';
    const r = await committee.post(`assessments/${ids.b}/return`, { data: { reason } });
    expect(r.status(), await r.text()).toBe(200);
    const n = find(await list(member), 'assessment_returned', `/me/assessments/${ids.b}`);
    expect(n, 'assessment_returned').toBeTruthy();
    expect(n.body).toContain(reason);
  });

  test('N4 override -> member gets assessment_overridden (detail link); other Committee/Admin get the committee link; the actor gets none', async () => {
    ids.c = await prepare();
    const ov = await committee.post(`assessments/${ids.c}/override`, { data: { centerKey: 'N', reason: 'ปรับผลตามดุลยพินิจของคณะกรรมการ รอบทดสอบ' } });
    expect(ov.status(), await ov.text()).toBe(200);
    expect(find(await list(member), 'assessment_overridden', `/me/assessments/${ids.c}`), 'member').toBeTruthy();
    expect(find(await list(admin), 'assessment_overridden', `/committee/assessments/${ids.c}`), 'other Committee member (admin holds Committee)').toBeTruthy();
    expect(find(await list(committee), 'assessment_overridden'), 'actor').toBeFalsy();
  });

  test('N5 umpire_assigned, match_result_approved and match_result_rejected reach the umpire with /umpire/matches/{id} links', async () => {
    const base = sql(
      `select m.event_id from matches m join events e on e.id=m.event_id join tournaments t on t.id=e.tournament_id where t.name='ศึกลูกขนไก่ชิงถ้วยประธานชมรม ครั้งที่ 3' and m.stage='group' and m.status='scheduled' limit 1`,
    );
    expect(base, 'seeded demo group stage (SEED_DEMO=1)').toBeTruthy();
    const clone = () =>
      sql(
        `insert into matches (id,event_id,draw_id,stage,group_id,round,match_no,court,top_entry_id,bottom_entry_id,status,result_version) ` +
          `select gen_random_uuid(),event_id,draw_id,stage,group_id,round,(select max(match_no)+1 from matches x where x.draw_id=m.draw_id),court,top_entry_id,bottom_entry_id,'scheduled',0 ` +
          `from matches m where stage='group' and status='scheduled' and umpire_id is null and event_id='${base}' order by match_no limit 1 returning id`,
      );
    const [okMatch, badMatch] = [clone(), clone()];
    const asg = await committee.patch(`matches/${okMatch}/assignment`, { data: { umpireId } });
    expect(asg.status(), await asg.text()).toBe(200);
    expect(find(await list(umpire), 'umpire_assigned', `/umpire/matches/${okMatch}`), 'umpire_assigned').toBeTruthy();

    for (const m of [okMatch, badMatch]) {
      const rep = await umpire.put(`matches/${m}/result`, { data: { outcome: 'played', games: GAMES } });
      expect(rep.status(), await rep.text()).toBe(200);
    }
    expect((await committee.post(`matches/${okMatch}/result/approve`)).status()).toBe(200);
    expect((await committee.post(`matches/${badMatch}/result/reject`, { data: { reason: 'คะแนนไม่ตรงกับใบบันทึก' } })).status()).toBe(200);
    const after = await list(umpire);
    expect(find(after, 'match_result_approved', `/umpire/matches/${okMatch}`), 'approved').toBeTruthy();
    expect(find(after, 'match_result_rejected', `/umpire/matches/${badMatch}`), 'rejected').toBeTruthy();
  });

  test.describe('member UI', () => {
    test.use({ storageState: MEMBER_AUTH_FILE });

    test('N6 bell badge matches the API unread count; the page lists unread items first with data-unread', async ({ page }) => {
      const api = await list(member, 'limit=1');
      expect(api.unreadCount).toBeGreaterThanOrEqual(3);
      await page.goto('/events');
      await expect(page.getByTestId('notification-bell')).toBeVisible({ timeout: 30000 });
      const badge = page.getByTestId('notification-badge');
      await expect(badge).toBeVisible({ timeout: 70000 });
      await expect(badge).toHaveText(api.unreadCount > 9 ? '9+' : String(api.unreadCount));
      await page.getByTestId('notification-bell').click();
      await expect(page).toHaveURL(/\/notifications/, { timeout: 20000 });
      await expect(page.getByTestId('notif-unread')).toContainText(String(api.unreadCount), { timeout: 20000 });
      const first = page.getByTestId('notif-item').first();
      await expect(first).toHaveAttribute('data-unread', 'true');
    });

    test('N7 opening the assessment_approved item lands on its detail page and marks it read (count drops by 1)', async ({ page }) => {
      const before = (await list(member, 'limit=1')).unreadCount;
      await page.goto('/notifications');
      const item = page.getByTestId('notif-item').filter({ hasText: 'ผลประเมินฝีมือของคุณได้รับอนุมัติแล้ว' }).first();
      await expect(item).toBeVisible({ timeout: 30000 });
      await item.click();
      await expect(page).toHaveURL(/\/me\/assessments\/[0-9a-f-]{36}$/, { timeout: 20000 });
      await expect(page.getByTestId('myassess-grade')).toBeVisible({ timeout: 30000 });
      await expect.poll(async () => (await list(member, 'limit=1')).unreadCount, { timeout: 15000 }).toBe(before - 1);
      const n = find(await list(member), 'assessment_approved', `/me/assessments/${ids.a}`);
      expect(n.readAt).not.toBeNull();
    });

    test('N8 read-all clears the unread count, the badge disappears and the list shows no unread item', async ({ page }) => {
      await page.goto('/notifications');
      await expect(page.getByTestId('notif-read-all')).toBeEnabled({ timeout: 30000 });
      await page.getByTestId('notif-read-all').click();
      await expect.poll(async () => (await list(member, 'limit=1')).unreadCount, { timeout: 15000 }).toBe(0);
      await expect(page.locator('[data-testid="notif-item"][data-unread="true"]')).toHaveCount(0, { timeout: 20000 });
      await expect(page.getByTestId('notif-read-all')).toBeDisabled();
      await page.goto('/events');
      await expect(page.getByTestId('notification-bell')).toBeVisible({ timeout: 30000 });
      await expect(page.getByTestId('notification-badge')).toHaveCount(0);
    });
  });
});
