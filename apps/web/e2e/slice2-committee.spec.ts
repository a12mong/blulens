import { test, expect, type APIRequestContext, type APIResponse, type Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import { randomUUID } from 'crypto';
import { COMMITTEE_AUTH_FILE } from './selectors';

/**
 * Slice 2b gate (Committee path), see docs/qa/slice2-e2e.md section "Committee".
 * Four assessments are prepared through the real API (member submit -> committee assign -> reviewers submit,
 * aggregate-on-submit computes the result), then the Committee decides in the UI:
 *   A pending_approval (S,S)         -> approve
 *   B disputed (RK1,S)               -> approve needs note >= 5 (API 422), return (reason >= 5)
 *   C pending_approval (S,S)         -> override (reason >= 20, audit row)
 *   D provisional (event minReviewers=1, one reviewer) -> confirm
 * SQL goes ONLY to DB blulens_e2e (name hard-coded).
 */

const API_BASE = (process.env.API_URL ?? 'http://localhost:3191').replace(/\/+$/, '') + '/api/v1/';
const PG_CONTAINER = process.env.E2E_PG_CONTAINER ?? 'blulens-postgres';
const PG_USER = process.env.E2E_PG_USER ?? 'blulens';

async function data<T = any>(res: APIResponse): Promise<T> {
  const json = await res.json();
  return (json && typeof json === 'object' && 'data' in json ? json.data : json) as T;
}

async function errCode(res: APIResponse): Promise<string> {
  const json = await res.json();
  return (json?.error ?? json)?.code;
}

function sqlE2e(sql: string): string {
  return execFileSync(
    'docker',
    ['exec', PG_CONTAINER, 'psql', '-U', PG_USER, '-d', 'blulens_e2e', '-tA', '-c', sql],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')[0];
}

async function login(ctx: APIRequestContext, identifier: string, password: string) {
  const res = await ctx.post('auth/login', { data: { identifier, password } });
  expect(res.status(), `login ${identifier}`).toBe(200);
}

type Kind = 'A' | 'B' | 'C' | 'D';

test.describe.serial('bl-24 slice 2b: committee decisions', () => {
  let adminCtx: APIRequestContext;
  let memberCtx: APIRequestContext;
  let committeeCtx: APIRequestContext;
  let reviewerCtx: APIRequestContext[] = [];
  let reviewer3Ctx: APIRequestContext;
  let reviewerIds: string[] = [];
  let criteria: string[] = [];
  const ids = {} as Record<Kind, string>;
  let tournamentName = '';
  let subjectName = '';

  const status = (id: string) => sqlE2e(`select status from assessments where id='${id}'`);
  const latestVersion = (id: string) =>
    Number(sqlE2e(`select max(version) from assessment_results where assessment_id='${id}'`));

  async function prepare(opts: { eventId?: string; grades: string[] }): Promise<string> {
    const create = await memberCtx.post('assessments', {
      data: { note: `e2e committee ${Date.now()}`, ...(opts.eventId ? { eventId: opts.eventId } : {}) },
    });
    expect(create.status(), await create.text()).toBe(201);
    const id = (await data(create)).id as string;

    const clipId = randomUUID();
    sqlE2e(
      `insert into clips (id, assessment_id, object_key, status, content_type, created_at) ` +
        `values ('${clipId}', '${id}', '/e2e/sample.mp4?c=${clipId}', 'uploaded', 'video/mp4', now())`,
    );
    const submit = await memberCtx.post(`assessments/${id}/submit`);
    expect(submit.status(), await submit.text()).toBe(200);

    const n = opts.grades.length;
    const assign = await committeeCtx.post(`assessments/${id}/assign`, {
      data: { reviewerIds: reviewerIds.slice(0, n) },
    });
    expect(assign.status(), await assign.text()).toBe(200);

    for (let i = 0; i < n; i++) {
      const assignmentId = sqlE2e(
        `select id from review_assignments where assessment_id='${id}' and reviewer_id='${reviewerIds[i]}'`,
      );
      const put = await reviewerCtx[i].put(`reviews/assignments/${assignmentId}`, {
        data: { scores: criteria.map((criterion) => ({ criterion, gradeKey: opts.grades[i] })) },
      });
      expect(put.status(), await put.text()).toBe(200);
    }
    return id;
  }

  async function decide(page: Page, id: string) {
    await page.goto(`/committee/assessments/${id}`);
    await expect(page.getByTestId('detail-result')).toBeVisible({ timeout: 20000 });
  }

  test.beforeAll(async ({ playwright }) => {
    const pw = process.env.SEED_DEMO_PASSWORD;
    const adminPw = process.env.SEED_ADMIN_PASSWORD;
    if (!pw || !adminPw) throw new Error('SEED_DEMO_PASSWORD and SEED_ADMIN_PASSWORD must be set (no defaults)');
    const mk = () => playwright.request.newContext({ baseURL: API_BASE });
    adminCtx = await mk();
    memberCtx = await mk();
    committeeCtx = await mk();
    reviewerCtx = [await mk(), await mk()];
    await login(adminCtx, process.env.SEED_ADMIN_EMAIL ?? 'admin@blulens.local', adminPw);
    await login(memberCtx, 'member1@blulens.local', pw);
    await login(committeeCtx, 'committee@blulens.local', pw);
    await login(reviewerCtx[0], 'reviewer1@blulens.local', pw);
    await login(reviewerCtx[1], 'reviewer2@blulens.local', pw);
    reviewer3Ctx = await mk();
    await login(reviewer3Ctx, 'reviewer3@blulens.local', pw);
    reviewerIds = [
      sqlE2e("select id from users where email='reviewer1@blulens.local'"),
      sqlE2e("select id from users where email='reviewer2@blulens.local'"),
    ];
    reviewerIds.forEach((r) => expect(r, 'reviewer1/2 missing: SEED_DEMO=1 db:seed on blulens_e2e').toMatch(/^[0-9a-f-]{36}$/));
    const rubric = await data<any>(await committeeCtx.get('rubric'));
    subjectName = sqlE2e("select display_name from users where email='member1@blulens.local'");
    expect(subjectName).toBeTruthy();
    criteria = (rubric.criteria as Array<{ key: string }>).map((c) => c.key);
    expect(criteria.length, 'rubric criteria').toBeGreaterThan(0);
  });

  test('C1 prepare A/B/C/D through the real API; aggregate gives the expected states', async () => {
    ids.A = await prepare({ grades: ['S', 'S'] });
    ids.B = await prepare({ grades: ['RK1', 'S'] });
    ids.C = await prepare({ grades: ['S', 'S'] });

    // D: an event with minReviewers=1 so one review yields 'provisional'
    const t = await adminCtx.post('tournaments', {
      data: {
        name: (tournamentName = `QA Tourney committee ${Date.now()}`),
        venue: 'e2e',
        startsOn: '2097-01-01', // below slice1's far-future dates so /events page 1 stays free for slice1
        entriesCloseAt: '2098-12-20T23:59:00.000Z',
      },
    });
    expect(t.status(), await t.text()).toBe(201);
    const tid = (await data(t)).id as string;
    const ev = await adminCtx.post(`tournaments/${tid}/events`, {
      data: { discipline: 'MD', gradeMin: 'S-', gradeMax: 'S+', maxEntries: 16, minReviewers: 1 },
    });
    expect(ev.status(), await ev.text()).toBe(201);
    ids.D = await prepare({ eventId: (await data(ev)).id, grades: ['S'] });

    expect(status(ids.A)).toBe('pending_approval');
    expect(status(ids.B)).toBe('disputed');
    expect(status(ids.C)).toBe('pending_approval');
    expect(status(ids.D)).toBe('provisional');
  });

  test.describe('committee UI', () => {
    test.use({ storageState: COMMITTEE_AUTH_FILE });

    test('C2 list shows the four assessments with their status', async ({ page }) => {
      await page.goto('/committee/assessments');
      for (const [kind, expected] of [
        ['A', 'pending_approval'],
        ['B', 'disputed'],
        ['C', 'pending_approval'],
        ['D', 'provisional'],
      ] as const) {
        const row = page.locator(`[data-testid="assessment-row"][data-assessment-id="${ids[kind]}"]`);
        await expect(row, `row ${kind}`).toBeVisible({ timeout: 20000 });
        await expect(row.getByTestId('assessment-status')).toHaveAttribute('data-status', expected);
        // real subject name (bl-26-6), never the 'ไม่ระบุ' placeholder
        await expect(row, `subject name ${kind}`).toContainText(subjectName);
        await expect(row).not.toContainText('ไม่ระบุ');
        const eventLabel = row.getByTestId('assessment-event');
        if (kind === 'D') {
          await expect(eventLabel, 'event assessment shows tournament · discipline').toContainText(tournamentName);
          await expect(eventLabel).toContainText('·');
        } else {
          await expect(eventLabel, 'general assessment label').toHaveText('ประเมินทั่วไป');
        }
      }
    });

    test('C3 detail A: result + rater rows; approve (no note needed) -> approved', async ({ page }) => {
      await decide(page, ids.A);
      await expect(page.getByTestId('detail-result')).toContainText('คะแนน');
      await expect(page.getByTestId('detail-reviewer-row')).toHaveCount(2);
      await page.getByTestId('decide-approve').click();
      await expect(page.getByTestId('approve-submit')).toBeEnabled();
      const post = page.waitForResponse(
        (r) => r.url().includes(`/assessments/${ids.A}/approve`) && r.request().method() === 'POST',
      );
      await page.getByTestId('approve-submit').click();
      const res = await post;
      expect(res.status(), await res.text()).toBe(200);
      await expect.poll(() => status(ids.A)).toBe('approved');
      expect(latestVersion(ids.A), 'approve appends result version 2').toBe(2);
      expect(sqlE2e(`select status from assessment_results where assessment_id='${ids.A}' order by version desc limit 1`)).toBe('approved');
    });

    test('C4 disputed B: approve needs note >= 5; return needs reason >= 5 -> in_review', async ({ page }) => {
      // API guards first
      const noNote = await committeeCtx.post(`assessments/${ids.B}/approve`, { data: {} });
      expect(noNote.status()).toBe(422);
      expect(await errCode(noNote)).toBe('ASSESSMENT_APPROVE_NOTE_REQUIRED');
      const stale = await committeeCtx.post(`assessments/${ids.B}/approve`, { data: { resultVersion: 999, note: 'stale try' } });
      expect(stale.status()).toBe(409);
      expect(await errCode(stale)).toBe('RESULT_VERSION_STALE');
      const shortReturn = await committeeCtx.post(`assessments/${ids.B}/return`, { data: { reason: 'abcd' } });
      expect(shortReturn.status()).toBe(422);
      expect(await errCode(shortReturn)).toBe('REASON_REQUIRED');
      expect(status(ids.B), 'guards must not change state').toBe('disputed');

      // UI: approve dialog blocks short note
      await decide(page, ids.B);
      await page.getByTestId('decide-approve').click();
      await page.getByTestId('approve-note').fill('abcd');
      await expect(page.getByTestId('approve-submit')).toBeDisabled();
      await page.getByTestId('approve-note').fill('abcde');
      await expect(page.getByTestId('approve-submit')).toBeEnabled();
      await page.keyboard.press('Escape').catch(() => {});
      await page.getByRole('button', { name: 'ยกเลิก' }).first().click();
      expect(status(ids.B), 'cancel must not decide').toBe('disputed');

      // UI: return boundary 4 disabled / 5 enabled
      await page.getByTestId('decide-return').click();
      await page.getByTestId('reason-input').fill('abcd');
      await expect(page.getByTestId('reason-submit')).toBeDisabled();
      await page.getByTestId('reason-input').fill('ขอให้ดูคลิปซ้ำ');
      await expect(page.getByTestId('reason-submit')).toBeEnabled();
      const post = page.waitForResponse(
        (r) => r.url().includes(`/assessments/${ids.B}/return`) && r.request().method() === 'POST',
      );
      await page.getByTestId('reason-submit').click();
      const res = await post;
      expect(res.status(), await res.text()).toBe(200);
      await expect.poll(() => status(ids.B)).toBe('in_review');
    });

    test('C5 override C: reason >= 20 + grade -> overridden, audit row with reason', async ({ page }) => {
      const short = await committeeCtx.post(`assessments/${ids.C}/override`, {
        data: { centerKey: 'P', reason: 'x'.repeat(19) },
      });
      expect(short.status()).toBe(422);
      expect(await errCode(short)).toBe('REASON_TOO_SHORT');
      expect(status(ids.C)).toBe('pending_approval');

      const reason = 'ปรับเกรดตามการสังเกตหน้างานจริง ครบถ้วน';
      expect(reason.trim().length).toBeGreaterThanOrEqual(20);
      await decide(page, ids.C);
      await page.getByTestId('decide-override').click();
      await expect(page.getByTestId('override-submit')).toBeDisabled();
      await page.getByTestId('gp-key-P').click();
      await page.getByTestId('override-reason').fill('x'.repeat(19));
      await expect(page.getByTestId('override-submit')).toBeDisabled();
      await page.getByTestId('override-reason').fill(reason);
      await expect(page.getByTestId('override-submit')).toBeEnabled();
      const post = page.waitForResponse(
        (r) => r.url().includes(`/assessments/${ids.C}/override`) && r.request().method() === 'POST',
      );
      await page.getByTestId('override-submit').click();
      const res = await post;
      expect(res.status(), await res.text()).toBe(200);
      await expect.poll(() => status(ids.C)).toBe('overridden');
      expect(sqlE2e(`select source||'/'||status from assessment_results where assessment_id='${ids.C}' order by version desc limit 1`)).toBe('override/overridden');
      expect(
        sqlE2e(`select count(*) from audit_logs where action='assessment.override' and entity_id='${ids.C}' and reason=$$${reason}$$`),
        'audit row with the reason',
      ).toBe('1');
    });

    test('C6 confirm provisional D -> approved', async ({ page }) => {
      await decide(page, ids.D);
      await page.getByTestId('decide-confirm').click();
      const post = page.waitForResponse(
        (r) => r.url().includes(`/assessments/${ids.D}/confirm`) && r.request().method() === 'POST',
      );
      await page.getByTestId('confirm-submit').click();
      const res = await post;
      expect(res.status(), await res.text()).toBe(200);
      await expect.poll(() => status(ids.D)).toBe('approved');
    });

    test('C7 list and API reflect every change; decided states offer no approve', async ({ page }) => {
      await page.goto('/committee/assessments');
      for (const [kind, expected] of [
        ['A', 'approved'],
        ['B', 'in_review'],
        ['C', 'overridden'],
        ['D', 'approved'],
      ] as const) {
        const row = page.locator(`[data-testid="assessment-row"][data-assessment-id="${ids[kind]}"]`);
        await expect(row, `row ${kind}`).toBeVisible({ timeout: 20000 });
        await expect(row.getByTestId('assessment-status')).toHaveAttribute('data-status', expected);
        const api = await committeeCtx.get(`assessments/${ids[kind]}`);
        expect((await data(api)).status, `api ${kind}`).toBe(expected);
      }
      // already approved A cannot be approved again
      const again = await committeeCtx.post(`assessments/${ids.A}/approve`, { data: {} });
      expect(again.status()).toBe(409);
      expect(await errCode(again)).toBe('ASSESSMENT_INVALID_TRANSITION');
    });
    test('C8 returned B: Committee assigns reviewer3 in the UI, third review -> re-aggregated over 3 raters', async ({ page }) => {
      expect(status(ids.B)).toBe('in_review'); // from C4 (return)
      const before = latestVersion(ids.B);
      await decide(page, ids.B);
      await page.getByTestId('assign-open').click();
      await page.getByTestId('assign-search').fill('reviewer3');
      await page.getByTestId('assign-option').first().click();
      await expect(page.getByTestId('assign-picked')).toHaveCount(1);
      const post = page.waitForResponse(
        (r) => r.url().includes(`/assessments/${ids.B}/assign`) && r.request().method() === 'POST',
      );
      await page.getByTestId('assign-submit').click();
      const res = await post;
      expect(res.status(), await res.text()).toBe(200);

      const r3 = sqlE2e("select id from users where email='reviewer3@blulens.local'");
      const assignmentId = sqlE2e(
        `select id from review_assignments where assessment_id='${ids.B}' and reviewer_id='${r3}' and state='open'`,
      );
      expect(assignmentId, 'reviewer3 open assignment').toMatch(/^[0-9a-f-]{36}$/);
      const put = await reviewer3Ctx.put(`reviews/assignments/${assignmentId}`, {
        data: { scores: criteria.map((criterion) => ({ criterion, gradeKey: 'BG1' })) },
      });
      expect(put.status(), await put.text()).toBe(200);

      expect(latestVersion(ids.B), 'last submit re-aggregates: new result version').toBe(before + 1);
      expect(status(ids.B)).toMatch(/^(pending_approval|disputed)$/);
      expect(
        sqlE2e(`select n_raters from assessment_results where assessment_id='${ids.B}' order by version desc limit 1`),
        'all 3 valid reviews counted',
      ).toBe('3');
    });
    test('C9 full loop: return -> assign (COI inline error, then reviewer3) -> reviewer3 scores in UI -> 3 raters -> approve', async ({ page, browser }) => {
      test.setTimeout(120000);
      // reviewer sharing a team with member1 (the subject): created on blulens_e2e only
      sqlE2e(
        `insert into users (id,email,password_hash,display_name,status,created_at,updated_at) ` +
          `select gen_random_uuid(),'reviewer-coi@blulens.local',password_hash,'Reviewer COI (e2e)','active',now(),now() ` +
          `from users where email='member1@blulens.local' on conflict (email) do nothing`,
      );
      sqlE2e(
        `insert into user_roles (user_id,role,created_at) select id,'Reviewer',now() from users where email='reviewer-coi@blulens.local' on conflict do nothing`,
      );
      sqlE2e(
        `insert into team_memberships (id,user_id,team_id,valid_from) ` +
          `select gen_random_uuid(), c.id, m.team_id, now() - interval '1 day' from users c, team_memberships m, users s ` +
          `where c.email='reviewer-coi@blulens.local' and s.email='member1@blulens.local' and m.user_id=s.id and m.valid_to is null ` +
          `and not exists (select 1 from team_memberships x where x.user_id=c.id and x.team_id=m.team_id and x.valid_to is null) limit 1`,
      );

      const id = await prepare({ grades: ['S', 'S'] });
      expect(status(id)).toBe('pending_approval');

      // 1. return (reason >= 5)
      await decide(page, id);
      await page.getByTestId('decide-return').click();
      await page.getByTestId('reason-input').fill('ขอกรรมการเพิ่มอีกหนึ่งท่าน');
      await page.getByTestId('reason-submit').click();
      await expect.poll(() => status(id)).toBe('in_review');

      // 2. assign: same-team reviewer -> inline COI error, nothing assigned
      await page.reload();
      await page.getByTestId('assign-open').click();
      await page.getByTestId('assign-search').fill('Reviewer');
      await page.getByTestId('assign-option').filter({ hasText: 'Reviewer COI' }).click();
      await page.getByTestId('assign-submit').click();
      await expect(page.getByTestId('assign-conflict')).toBeVisible({ timeout: 20000 });
      expect(
        sqlE2e(`select count(*) from review_assignments ra join users u on u.id=ra.reviewer_id where ra.assessment_id='${id}' and u.email='reviewer-coi@blulens.local'`),
        'COI reviewer must not be assigned',
      ).toBe('0');

      // 3. remove the COI pick, assign reviewer3
      await page.getByTestId('assign-remove').click();
      await page.getByTestId('assign-search').fill('reviewer3');
      await page.getByTestId('assign-option').first().click();
      const post = page.waitForResponse(
        (r) => r.url().includes(`/assessments/${id}/assign`) && r.request().method() === 'POST',
      );
      await page.getByTestId('assign-submit').click();
      expect((await post).status()).toBe(200);

      // 3b. in_review detail shows the reviewer progress table: 2 of 3 submitted
      await page.reload();
      await expect(page.getByTestId('detail-progress')).toBeVisible({ timeout: 20000 });
      await expect(page.getByTestId('detail-progress')).toContainText('ส่งแล้ว 2/3');
      await expect(page.getByTestId('progress-row')).toHaveCount(3);

      // 4. reviewer3 logs in through the UI, sees the task, scores and locks
      const r3Ctx = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3190' });
      const r3 = await r3Ctx.newPage();
      expect((await r3Ctx.request.post(API_BASE + 'auth/login', { data: { identifier: 'reviewer3@blulens.local', password: process.env.SEED_DEMO_PASSWORD! } })).status()).toBe(200); // cookies are per host, shared by the web page
      const r3User = sqlE2e("select id from users where email='reviewer3@blulens.local'");
      const assignmentId = sqlE2e(`select id from review_assignments where assessment_id='${id}' and reviewer_id='${r3User}' and state='open'`);
      await r3.goto('/review');
      await expect(r3.locator(`a[data-testid="review-card-action"][href="/review/tasks/${assignmentId}"]`)).toBeVisible({ timeout: 20000 });
      await r3.goto(`/review/tasks/${assignmentId}`);
      const items = r3.getByTestId('rubric-item');
      await expect(items.first()).toBeVisible({ timeout: 20000 });
      for (let i = 0; i < (await items.count()); i++) {
        const card = items.nth(i);
        await card.getByTestId('gp-tier-Standard').click();
        await card.getByTestId('gp-key-S').click();
      }
      await r3.getByTestId('scoring-submit').click();
      await r3.getByTestId('scoring-confirm').click();
      await expect(r3).toHaveURL(/\/review$/, { timeout: 20000 });
      await r3Ctx.close();

      // 5. recomputed over 3 raters; committee detail shows 3 reviewer rows; approve
      await expect.poll(() => status(id)).toBe('pending_approval');
      expect(sqlE2e(`select n_raters from assessment_results where assessment_id='${id}' order by version desc limit 1`)).toBe('3');
      await decide(page, id);
      await expect(page.getByTestId('detail-reviewer-row')).toHaveCount(3);
      await page.getByTestId('decide-approve').click();
      await page.getByTestId('approve-submit').click();
      await expect.poll(() => status(id)).toBe('approved');
    });
  });
});