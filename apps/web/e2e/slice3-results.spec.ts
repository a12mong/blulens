import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { execFileSync } from 'child_process';
import { COMMITTEE_AUTH_FILE } from './selectors';

/**
 * Slice 3 (group stage results), see docs/qa/slice3-results-e2e.md.
 * Two scheduled group matches are cloned per run (unique court label), reported by an assigned umpire through the
 * API, then the Committee decides in /committee/events/{eventId}/results:
 *   R1 approve -> confirmed, standings (live) count it;  R2 reject (reason >= 5) -> back to scheduled, not counted.
 * SQL goes ONLY to DB blulens_e2e (name hard-coded).
 */

const API_BASE = (process.env.API_URL ?? 'http://localhost:3191').replace(/\/+$/, '') + '/api/v1/';
const PG_CONTAINER = process.env.E2E_PG_CONTAINER ?? 'blulens-postgres';
const PG_USER = process.env.E2E_PG_USER ?? 'blulens';
const GAMES = [
  { a: 15, b: 11 },
  { a: 15, b: 9 },
];

function sql(q: string): string {
  return execFileSync(
    'docker',
    ['exec', PG_CONTAINER, 'psql', '-U', PG_USER, '-d', 'blulens_e2e', '-tA', '-c', q],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')[0];
}

async function login(ctx: APIRequestContext, identifier: string, password: string) {
  const res = await ctx.post('auth/login', { data: { identifier, password } });
  expect(res.status(), `login ${identifier}`).toBe(200);
}

async function standingsPlayed(ctx: APIRequestContext, eventId: string): Promise<number> {
  const res: APIResponse = await ctx.get(`events/${eventId}/standings`);
  expect(res.status()).toBe(200);
  const json = await res.json();
  const rows: Array<{ played: number }> = json?.data ?? json;
  return rows.reduce((n, r) => n + r.played, 0);
}

test.describe.serial('slice 3: committee results queue + standings', () => {
  let eventId = '';
  let publicCtx: APIRequestContext;
  const tag = `e2e-${Date.now()}`;
  const court = { r1: `${tag}-A`, r2: `${tag}-B` };
  const id = {} as Record<'r1' | 'r2', string>;
  let s0 = 0;
  const row = (page: import('@playwright/test').Page, c: string) =>
    page.getByTestId('result-row').filter({ hasText: c });

  test.beforeAll(async ({ playwright }) => {
    const pw = process.env.SEED_DEMO_PASSWORD;
    if (!pw) throw new Error('SEED_DEMO_PASSWORD must be set (no defaults)');
    const base = sql(`select event_id from matches where stage='group' and status='scheduled' order by match_no limit 1`);
    expect(base, 'seeded scheduled group match missing: SEED_DEMO=1 db:seed on blulens_e2e').toMatch(/^[0-9a-f-]{36}$/);
    eventId = base;

    sql(
      `insert into users (id,email,password_hash,display_name,status,created_at,updated_at) ` +
        `select gen_random_uuid(),'umpire1@blulens.local',password_hash,'Umpire 1 (e2e)','active',now(),now() from users where email='member1@blulens.local' on conflict (email) do nothing`,
    );
    sql(`insert into user_roles (user_id,role,created_at) select id,'Umpire',now() from users where email='umpire1@blulens.local' on conflict do nothing`);
    sql(`insert into event_umpires (event_id,user_id,courts,created_at) select '${eventId}',id,'{}',now() from users where email='umpire1@blulens.local' on conflict do nothing`);

    const clone = (c: string) =>
      sql(
        `insert into matches (id,event_id,draw_id,stage,group_id,round,match_no,court,top_entry_id,bottom_entry_id,status,result_version) ` +
          `select gen_random_uuid(),event_id,draw_id,stage,group_id,round,(select max(match_no)+1 from matches x where x.draw_id=m.draw_id),'${c}',top_entry_id,bottom_entry_id,'scheduled',0 ` +
          `from matches m where stage='group' and event_id='${eventId}' and status='scheduled' and court not like 'e2e-%' order by match_no limit 1 returning id`,
      );
    id.r1 = clone(court.r1);
    id.r2 = clone(court.r2);
    expect(id.r1).toMatch(/^[0-9a-f-]{36}$/);
    expect(id.r2).toMatch(/^[0-9a-f-]{36}$/);

    publicCtx = await playwright.request.newContext({ baseURL: API_BASE });
    s0 = await standingsPlayed(publicCtx, eventId);

    const umpire = await playwright.request.newContext({ baseURL: API_BASE });
    await login(umpire, 'umpire1@blulens.local', pw);
    for (const m of [id.r1, id.r2]) {
      const res = await umpire.put(`matches/${m}/result`, { data: { outcome: 'played', games: GAMES } });
      expect(res.status(), await res.text()).toBe(200);
    }
  });

  test('R1 standings ignore reported (unconfirmed) matches', async () => {
    expect(await standingsPlayed(publicCtx, eventId), 'reported results must not count yet').toBe(s0);
  });

  test.describe('committee UI', () => {
    test.use({ storageState: COMMITTEE_AUTH_FILE });

    test('R2 queue lists both reported matches with their scores', async ({ page }) => {
      await page.goto(`/committee/events/${eventId}/results`);
      for (const c of [court.r1, court.r2]) {
        await expect(row(page, c), `row ${c}`).toBeVisible({ timeout: 20000 });
        await expect(row(page, c)).toContainText('15–11');
        await expect(row(page, c)).toContainText('15–9');
      }
    });

    test('R3 approve R1: confirm dialog -> confirmed, row leaves queue, standings count it', async ({ page }) => {
      await page.goto(`/committee/events/${eventId}/results`);
      await row(page, court.r1).getByTestId('result-approve').click();
      const post = page.waitForResponse(
        (r) => r.url().includes(`/matches/${id.r1}/result/approve`) && r.request().method() === 'POST',
      );
      await page.getByTestId('confirm-submit').click();
      const res = await post;
      expect(res.status(), await res.text()).toBe(200);
      await expect(row(page, court.r1)).toHaveCount(0);
      expect(sql(`select status from matches where id='${id.r1}'`)).toBe('confirmed');
      expect(sql(`select count(*) from audit_logs where action='match.result.approve' and entity_id='${id.r1}'`)).toBe('1');
      expect(await standingsPlayed(publicCtx, eventId), 'two entries played one more match').toBe(s0 + 2);
    });

    test('R4 reject R2: reason >= 5 -> back to scheduled, result cleared, not in standings', async ({ page }) => {
      await page.goto(`/committee/events/${eventId}/results`);
      await row(page, court.r2).getByTestId('result-reject').click();
      await page.getByTestId('reason-input').fill('abcd');
      await expect(page.getByTestId('reason-submit')).toBeDisabled();
      const reason = 'คะแนนไม่ตรงกับใบบันทึก';
      await page.getByTestId('reason-input').fill(reason);
      await expect(page.getByTestId('reason-submit')).toBeEnabled();
      const post = page.waitForResponse(
        (r) => r.url().includes(`/matches/${id.r2}/result/reject`) && r.request().method() === 'POST',
      );
      await page.getByTestId('reason-submit').click();
      const res = await post;
      expect(res.status(), await res.text()).toBe(200);
      await expect(row(page, court.r2)).toHaveCount(0);
      expect(sql(`select status||'/'||coalesce(games::text,'null')||'/'||coalesce(reported_by::text,'null') from matches where id='${id.r2}'`)).toBe('scheduled/null/null');
      expect(sql(`select count(*) from audit_logs where action='match.result.reject' and entity_id='${id.r2}' and reason=$$${reason}$$`)).toBe('1');
      expect(await standingsPlayed(publicCtx, eventId), 'rejected result is not counted').toBe(s0 + 2);
    });

    test('R5 API guards: re-approve confirmed -> 409, reject without reason -> 4xx, state unchanged', async ({ playwright }) => {
      const ctx = await playwright.request.newContext({ baseURL: API_BASE, storageState: COMMITTEE_AUTH_FILE });
      const again = await ctx.post(`matches/${id.r1}/result/approve`);
      expect(again.status(), await again.text()).toBeGreaterThanOrEqual(400);
      const noReason = await ctx.post(`matches/${id.r2}/result/reject`, { data: {} });
      expect(noReason.status()).toBeGreaterThanOrEqual(400);
      expect(sql(`select status from matches where id='${id.r1}'`)).toBe('confirmed');
      expect(sql(`select status from matches where id='${id.r2}'`)).toBe('scheduled');
    });
  });
});
