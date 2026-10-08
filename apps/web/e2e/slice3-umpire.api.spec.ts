import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { execFileSync } from 'child_process';

/**
 * Slice 3 (umpire result entry), API level: PUT /matches/{id}/result on the demo group stage (SEED_DEMO=1).
 * UI steps wait for GET /umpire/matches and an Umpire seed user (see docs/qa/slice3-umpire-e2e.md).
 * Format of the demo group match: 2 fixed games to 15, no deuce, draw allowed.
 * SQL goes ONLY to DB blulens_e2e (name hard-coded). Each run clones the seeded scheduled match, so it is repeatable.
 */

const API_BASE = (process.env.API_URL ?? 'http://localhost:3191').replace(/\/+$/, '') + '/api/v1/';
const PG_CONTAINER = process.env.E2E_PG_CONTAINER ?? 'blulens-postgres';
const PG_USER = process.env.E2E_PG_USER ?? 'blulens';

function sql(q: string): string {
  return execFileSync(
    'docker',
    ['exec', PG_CONTAINER, 'psql', '-U', PG_USER, '-d', 'blulens_e2e', '-tA', '-c', q],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')[0];
}

async function errCode(res: APIResponse): Promise<string> {
  const j = await res.json();
  return (j?.error ?? j)?.code;
}

async function login(ctx: APIRequestContext, identifier: string, password: string) {
  const res = await ctx.post('auth/login', { data: { identifier, password } });
  expect(res.status(), `login ${identifier}`).toBe(200);
}

const VALID = [
  { a: 15, b: 11 },
  { a: 15, b: 9 },
];

test.describe.serial('slice 3 umpire: PUT /matches/{id}/result (API)', () => {
  let eventId = '';
  let playerEmail = '';
  const pw = process.env.SEED_DEMO_PASSWORD ?? '';
  let umpireCtx: APIRequestContext;
  let outsiderCtx: APIRequestContext;
  let playerCtx: APIRequestContext;
  const m = {} as Record<'valid' | 'invalid' | 'own' | 'unassigned', string>;
  const createdRoles: string[] = [];

  /** Clone the seeded scheduled group match; returns the new match id. */
  const cloneMatch = (): string =>
    sql(
      `insert into matches (id,event_id,draw_id,stage,group_id,round,match_no,court,top_entry_id,bottom_entry_id,status,result_version) ` +
        `select gen_random_uuid(),event_id,draw_id,stage,group_id,round,(select max(match_no)+1 from matches x where x.draw_id=m.draw_id),court,top_entry_id,bottom_entry_id,'scheduled',0 ` +
        `from matches m where stage='group' and status='scheduled' and umpire_id is null and event_id='${eventId}' order by match_no limit 1 returning id`,
    );

  test.beforeAll(async ({ playwright }) => {
    if (!pw) throw new Error('SEED_DEMO_PASSWORD must be set (no defaults)');
    const base = sql(
      `select m.id||'|'||m.event_id||'|'||m.top_entry_id from matches m join events e on e.id = m.event_id join tournaments t on t.id = e.tournament_id where t.name = 'ศึกลูกขนไก่ชิงถ้วยประธานชมรม ครั้งที่ 3' and m.stage = 'group' and m.status = 'scheduled' and m.court is not null order by m.match_no limit 1`,
    );
    expect(base, 'seeded scheduled group match missing: run SEED_DEMO=1 db:seed on blulens_e2e').toContain('|');
    const [, ev, top] = base.split('|');
    eventId = ev;

    // umpire1 is seeded by SEED_DEMO=1 (bl-25-6) with role Umpire and event_umpires row.
    // umpire2: Umpire role only (not assigned to event, needed for U4)
    sql(
      `insert into users (id,email,password_hash,display_name,status,created_at,updated_at) ` +
        `select gen_random_uuid(),'umpire2@blulens.local',password_hash,'Umpire 2 (e2e)','active',now(),now() ` +
        `from users where email='member1@blulens.local' on conflict (email) do nothing`,
    );
    sql(`insert into user_roles (user_id,role,created_at) select id,'Umpire',now() from users where email='umpire2@blulens.local' on conflict do nothing`);

    // a player of the match's top entry also holds the Umpire role (removed in afterAll if we added it)
    playerEmail = sql(`select u.email from entry_players ep join users u on u.id=ep.user_id where ep.entry_id='${top}' limit 1`);
    expect(playerEmail, 'top entry has a player').toContain('@');
    const had = sql(`select count(*) from user_roles ur join users u on u.id=ur.user_id where u.email='${playerEmail}' and ur.role='Umpire'`);
    if (had === '0') {
      sql(`insert into user_roles (user_id,role,created_at) select id,'Umpire',now() from users where email='${playerEmail}'`);
      createdRoles.push(playerEmail);
    }

    const mk = () => playwright.request.newContext({ baseURL: API_BASE });
    [umpireCtx, outsiderCtx, playerCtx] = [await mk(), await mk(), await mk()];
    await login(umpireCtx, 'umpire1@blulens.local', pw);
    await login(outsiderCtx, 'umpire2@blulens.local', pw);
    await login(playerCtx, playerEmail, pw);
    for (const k of ['valid', 'invalid', 'own', 'unassigned'] as const) m[k] = cloneMatch();
  });

  test.afterAll(async () => {
    for (const email of createdRoles) {
      sql(`delete from user_roles using users u where user_roles.user_id=u.id and u.email='${email}' and user_roles.role='Umpire'`);
    }
  });

  test('U1 assigned umpire enters a valid score -> 200, status reported, games stored', async () => {
    const res = await umpireCtx.put(`matches/${m.valid}/result`, { data: { outcome: 'played', games: VALID } });
    expect(res.status(), await res.text()).toBe(200);
    expect(sql(`select status||'/'||result from matches where id='${m.valid}'`)).toBe('reported/a_win');
    expect(sql(`select count(*) from audit_logs where action='match.result.report' and entity_id='${m.valid}'`)).toBe('1');
    const list = await umpireCtx.get(`events/${eventId}/matches`);
    expect(list.status()).toBe(200);
    expect(JSON.stringify(await list.json())).toContain(m.valid);
  });

  test('U2 invalid score -> 422 MATCH_SCORE_INVALID, match unchanged', async () => {
    for (const games of [
      [{ a: 10, b: 5 }, { a: 15, b: 3 }], // game 1 not finished
      [{ a: 15, b: 15 }, { a: 15, b: 9 }], // no deuce: 15-15 impossible
      [{ a: 15, b: 11 }], // incomplete (needs 2 games)
    ]) {
      const res = await umpireCtx.put(`matches/${m.invalid}/result`, { data: { outcome: 'played', games } });
      expect(res.status(), JSON.stringify(games)).toBe(422);
      expect(await errCode(res)).toBe('MATCH_SCORE_INVALID');
    }
    expect(sql(`select status from matches where id='${m.invalid}'`)).toBe('scheduled');
  });

  test('U3 umpire who plays in the match -> 403 UMPIRE_OWN_MATCH', async () => {
    const res = await playerCtx.put(`matches/${m.own}/result`, { data: { outcome: 'played', games: VALID } });
    expect(res.status(), await res.text()).toBe(403);
    expect(await errCode(res)).toBe('UMPIRE_OWN_MATCH');
    expect(sql(`select status from matches where id='${m.own}'`)).toBe('scheduled');
  });

  test('U4 umpire not assigned to the event/court -> 403 UMPIRE_NOT_ASSIGNED', async () => {
    const res = await outsiderCtx.put(`matches/${m.unassigned}/result`, { data: { outcome: 'played', games: VALID } });
    expect(res.status(), await res.text()).toBe(403);
    expect(await errCode(res)).toBe('UMPIRE_NOT_ASSIGNED');
    expect(sql(`select status from matches where id='${m.unassigned}'`)).toBe('scheduled');
  });

  test('U5 a plain member cannot report (role guard)', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: API_BASE });
    await login(ctx, 'member2@blulens.local', pw);
    const res = await ctx.put(`matches/${m.valid}/result`, { data: { outcome: 'played', games: VALID } });
    expect(res.status()).toBe(403);
  });
});
