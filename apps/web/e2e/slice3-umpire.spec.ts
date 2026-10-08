import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { execFileSync } from 'child_process';
import { SELECTORS, ROUTES, UMPIRE_AUTH_FILE, AUTH_DIR } from './selectors';
import fs from 'fs';

/**
 * Slice 3 Umpire UI E2E test suite (apps/web/features/umpire/*).
 *
 * Covers:
 *   UI-1: Umpire sees scheduled match in /umpire list and navigates to scoring page
 *   UI-2: Stepper enters valid score (15-11, 15-9) -> submit -> confirm -> result-reported
 *   UI-3: Invalid score shows Thai MATCH_SCORE_INVALID text in result-error
 *   UI-4: Own-match is blocked (UMPIRE_OWN_MATCH)
 *
 * Constraints:
 *   - DB: blulens_e2e only
 *   - Follows SQL clone-per-run pattern from slice3-umpire.api.spec.ts
 */

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

test.describe.serial('slice 3 umpire: UI workflow', () => {
  let eventId = '';
  let playerEmail = '';
  const pw = process.env.SEED_DEMO_PASSWORD ?? '';
  const createdRoles: string[] = [];
  let matchIdValid = '';
  let matchIdInvalid = '';
  let matchIdOwn = '';

  const cloneMatch = (): string =>
    sql(
      `insert into matches (id,event_id,draw_id,stage,group_id,round,match_no,court,top_entry_id,bottom_entry_id,status,result_version) ` +
        `select gen_random_uuid(),event_id,draw_id,stage,group_id,round,(select max(match_no)+1 from matches x where x.draw_id=m.draw_id),court,top_entry_id,bottom_entry_id,'scheduled',0 ` +
        `from matches m where stage='group' and status='scheduled' and umpire_id is null order by match_no limit 1 returning id`,
    );

  test.beforeAll(async ({ browser }) => {
    if (!pw) throw new Error('SEED_DEMO_PASSWORD must be set');

    const base = sql(
      `select id||'|'||event_id||'|'||top_entry_id from matches where stage='group' and status='scheduled' order by match_no limit 1`,
    );
    expect(base, 'seeded scheduled group match missing in blulens_e2e').toContain('|');
    const [, ev, top] = base.split('|');
    eventId = ev;

    // Ensure umpire1@blulens.local exists with role Umpire and event_umpires row
    for (const n of [1, 2]) {
      sql(
        `insert into users (id,email,password_hash,display_name,status,created_at,updated_at) ` +
          `select gen_random_uuid(),'umpire${n}@blulens.local',password_hash,'Umpire ${n} (e2e)','active',now(),now() ` +
          `from users where email='member1@blulens.local' on conflict (email) do nothing`,
      );
      sql(`insert into user_roles (user_id,role,created_at) select id,'Umpire',now() from users where email='umpire${n}@blulens.local' on conflict do nothing`);
    }
    sql(
      `insert into event_umpires (event_id,user_id,courts,created_at) select '${eventId}',id,'{}',now() from users where email='umpire1@blulens.local' on conflict do nothing`,
    );

    // Player of top_entry also given Umpire role for own-match test
    playerEmail = sql(`select u.email from entry_players ep join users u on u.id=ep.user_id where ep.entry_id='${top}' limit 1`);
    expect(playerEmail, 'top entry has player email').toContain('@');
    const had = sql(`select count(*) from user_roles ur join users u on u.id=ur.user_id where u.email='${playerEmail}' and ur.role='Umpire'`);
    if (had === '0') {
      sql(`insert into user_roles (user_id,role,created_at) select id,'Umpire',now() from users where email='${playerEmail}'`);
      createdRoles.push(playerEmail);
    }
    // Also assign player to the event as umpire to specifically test UMPIRE_OWN_MATCH restriction
    sql(
      `insert into event_umpires (event_id,user_id,courts,created_at) select '${eventId}',id,'{}',now() from users where email='${playerEmail}' on conflict do nothing`,
    );

    // Authenticate as umpire1 and save storage state
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }
    const page = await browser.newPage();
    await page.goto(ROUTES.login);
    await expect(page.getByTestId(SELECTORS.login.identifier)).toBeVisible({ timeout: 20000 });
    await page.getByTestId(SELECTORS.login.identifier).fill('umpire1@blulens.local');
    await page.getByTestId(SELECTORS.login.password).fill(pw);
    await page.getByTestId(SELECTORS.login.submit).click();
    await expect(page).not.toHaveURL(/\/login$/, { timeout: 20000 });
    await page.context().storageState({ path: UMPIRE_AUTH_FILE });
    await page.close();

    // Clone matches for tests
    matchIdValid = cloneMatch();
    matchIdInvalid = cloneMatch();
    matchIdOwn = cloneMatch();
  });

  test.afterAll(async () => {
    for (const email of createdRoles) {
      sql(`delete from user_roles using users u where user_roles.user_id=u.id and u.email='${email}' and user_roles.role='Umpire'`);
    }
  });

  test('UI-1: umpire sees match in /umpire list and navigates to scoring page', async ({ browser }) => {
    const context = await browser.newContext({ storageState: UMPIRE_AUTH_FILE });
    const page = await context.newPage();

    await page.goto(ROUTES.umpire);
    await expect(page.getByTestId(SELECTORS.umpire.match).first()).toBeVisible({ timeout: 20000 });

    // Locate scheduled match
    const matchCard = page.locator(`[data-testid="${SELECTORS.umpire.match}"][data-status="scheduled"]`).first();
    await expect(matchCard).toBeVisible();
    await expect(matchCard.getByTestId(SELECTORS.umpire.matchStatus)).toContainText('รอกรอกผล');

    const actionLink = matchCard.getByTestId(SELECTORS.umpire.matchAction);
    await expect(actionLink).toBeVisible();
    await expect(actionLink).toHaveText('กรอกผล');

    // Click action link to go to match scoring page
    await actionLink.click();
    await expect(page).toHaveURL(/\/umpire\/matches\/[a-f0-9-]+$/);
    await expect(page.getByTestId(SELECTORS.umpire.stepper).first()).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('UI-2: stepper enters valid score 15-11, 15-9 -> result-reported', async ({ browser }) => {
    const context = await browser.newContext({ storageState: UMPIRE_AUTH_FILE });
    const page = await context.newPage();

    await page.goto(ROUTES.umpireMatch(matchIdValid));
    const steppers = page.getByTestId(SELECTORS.umpire.stepper);
    await expect(steppers.first()).toBeVisible({ timeout: 20000 });
    await expect(steppers).toHaveCount(2);

    // Game 1: 15 - 11
    const g1 = steppers.nth(0);
    await g1.getByTestId(SELECTORS.umpire.scoreA).fill('15');
    await g1.getByTestId(SELECTORS.umpire.scoreB).fill('11');

    // Game 2: 15 - 9
    const g2 = steppers.nth(1);
    await g2.getByTestId(SELECTORS.umpire.scoreA).fill('15');
    await g2.getByTestId(SELECTORS.umpire.scoreB).fill('9');

    // Summary should appear
    await expect(page.getByTestId(SELECTORS.umpire.resultSummary)).toBeVisible();
    await expect(page.getByTestId(SELECTORS.umpire.resultSubmit)).toBeEnabled();

    // Click submit -> Confirm dialog
    await page.getByTestId(SELECTORS.umpire.resultSubmit).click();
    await expect(page.getByTestId(SELECTORS.umpire.resultConfirm)).toBeVisible();

    // Confirm submission
    const resPromise = page.waitForResponse(
      (res) => res.url().includes(`/matches/${matchIdValid}/result`) && res.request().method() === 'PUT',
    );
    await page.getByTestId(SELECTORS.umpire.resultConfirm).click();
    const res = await resPromise;
    expect(res.status(), 'PUT match result must return 200').toBe(200);

    // Either redirected to /umpire with reported status or shows result-reported
    await expect.poll(() => {
      return sql(`select status from matches where id='${matchIdValid}'`);
    }).toBe('reported');

    await context.close();
  });

  test('UI-3: invalid score shows Thai MATCH_SCORE_INVALID text in result-error', async ({ browser }) => {
    const context = await browser.newContext({ storageState: UMPIRE_AUTH_FILE });
    const page = await context.newPage();

    await page.goto(ROUTES.umpireMatch(matchIdInvalid));
    const steppers = page.getByTestId(SELECTORS.umpire.stepper);
    await expect(steppers.first()).toBeVisible({ timeout: 20000 });

    // Client-side validation checks
    // 1. Incomplete score (10 - 5)
    const g1 = steppers.nth(0);
    await g1.getByTestId(SELECTORS.umpire.scoreA).fill('10');
    await g1.getByTestId(SELECTORS.umpire.scoreB).fill('5');
    await expect(g1.getByTestId(SELECTORS.umpire.gameError)).toHaveText('ยังไม่ครบ 15 แต้ม');
    await expect(page.getByTestId(SELECTORS.umpire.resultSubmit)).toBeDisabled();

    // 2. Tie score in game without deuce (15 - 15)
    await g1.getByTestId(SELECTORS.umpire.scoreA).fill('15');
    await g1.getByTestId(SELECTORS.umpire.scoreB).fill('15');
    await expect(g1.getByTestId(SELECTORS.umpire.gameError)).toHaveText('ผลเสมอไม่ได้');
    await expect(page.getByTestId(SELECTORS.umpire.resultSubmit)).toBeDisabled();

    // Server-side validation check (MATCH_SCORE_INVALID -> Thai text in result-error)
    // Intercept PUT and return 422 MATCH_SCORE_INVALID to verify Thai error rendering in UI
    await page.route(`**/api/v1/matches/${matchIdInvalid}/result`, async (route) => {
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            code: 'MATCH_SCORE_INVALID',
            message: 'Game scores do not satisfy match format rules',
          },
        }),
      });
    });

    // Enter valid client scores to enable submit button
    await g1.getByTestId(SELECTORS.umpire.scoreB).fill('11');
    const g2 = steppers.nth(1);
    await g2.getByTestId(SELECTORS.umpire.scoreA).fill('15');
    await g2.getByTestId(SELECTORS.umpire.scoreB).fill('9');
    await expect(page.getByTestId(SELECTORS.umpire.resultSubmit)).toBeEnabled();

    // Submit -> Confirm
    await page.getByTestId(SELECTORS.umpire.resultSubmit).click();
    await page.getByTestId(SELECTORS.umpire.resultConfirm).click();

    // Asserts Thai error message for MATCH_SCORE_INVALID is rendered
    const errorEl = page.getByTestId(SELECTORS.umpire.resultError);
    await expect(errorEl).toBeVisible();
    await expect(errorEl).toHaveText('คะแนนไม่ถูกต้องตามกติกา');

    // Match remains scheduled in DB
    expect(sql(`select status from matches where id='${matchIdInvalid}'`)).toBe('scheduled');

    await context.close();
  });

  test('UI-4: own-match is blocked (UMPIRE_OWN_MATCH)', async ({ browser }) => {
    // Authenticate as the player who is also an Umpire
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(ROUTES.login);
    await page.getByTestId(SELECTORS.login.identifier).fill(playerEmail);
    await page.getByTestId(SELECTORS.login.password).fill(pw);
    await page.getByTestId(SELECTORS.login.submit).click();
    await expect(page).not.toHaveURL(/\/login$/, { timeout: 20000 });

    // 1. Own match is hidden / blocked on the direct match route: shows matchMissing
    await page.goto(ROUTES.umpireMatch(matchIdOwn));
    const missingEl = page.getByTestId(SELECTORS.umpire.matchMissing);
    await expect(missingEl).toBeVisible({ timeout: 15000 });
    await expect(missingEl).toHaveText('ไม่พบแมตช์นี้ หรือคุณไม่มีสิทธิ์');

    // 2. If the umpire match list had included the match, submitting it must fail with UMPIRE_OWN_MATCH
    // Route GET /umpire/matches to include matchIdOwn so the form loads
    await page.route('**/api/v1/umpire/matches*', async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      const items = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
      items.push({
        id: matchIdOwn,
        eventId,
        stage: 'group',
        round: 1,
        matchNo: 99,
        court: '1',
        status: 'scheduled',
        aEntry: { displayName: 'Team A' },
        bEntry: { displayName: 'Team B' },
        format: {
          preset: 'group_2x15',
          mode: 'fixed_games',
          games: 2,
          pointsPerGame: 15,
          deuce: false,
          cap: null,
          drawAllowed: true,
        },
      });
      await route.fulfill({
        json: Array.isArray(body) ? items : { success: true, data: items },
      });
    });

    await page.goto(ROUTES.umpireMatch(matchIdOwn));
    const steppers = page.getByTestId(SELECTORS.umpire.stepper);
    await expect(steppers.first()).toBeVisible({ timeout: 15000 });

    const g1 = steppers.nth(0);
    const g2 = steppers.nth(1);
    await g1.getByTestId(SELECTORS.umpire.scoreA).fill('15');
    await g1.getByTestId(SELECTORS.umpire.scoreB).fill('11');
    await g2.getByTestId(SELECTORS.umpire.scoreA).fill('15');
    await g2.getByTestId(SELECTORS.umpire.scoreB).fill('9');

    await page.getByTestId(SELECTORS.umpire.resultSubmit).click();
    const resPromise = page.waitForResponse(
      (r) => r.url().includes(`/matches/${matchIdOwn}/result`) && r.request().method() === 'PUT',
    );
    await page.getByTestId(SELECTORS.umpire.resultConfirm).click();
    const res = await resPromise;
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body?.error?.code).toBe('UMPIRE_OWN_MATCH');

    // Form displays Thai error message for UMPIRE_OWN_MATCH
    const errorEl = page.getByTestId(SELECTORS.umpire.resultError);
    await expect(errorEl).toBeVisible();
    await expect(errorEl).toHaveText('ห้ามกรอกผลแมตช์ที่ตนเองเป็นผู้เล่น');

    // Match remains scheduled in DB
    expect(sql(`select status from matches where id='${matchIdOwn}'`)).toBe('scheduled');

    await context.close();
  });
});
