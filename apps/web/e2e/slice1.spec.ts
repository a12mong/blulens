import { test, expect, type Response } from '@playwright/test';
import {
  SELECTORS,
  ROUTES,
  ADMIN_AUTH_FILE,
  COMMITTEE_AUTH_FILE,
  MEMBER_AUTH_FILE,
} from './selectors';

/**
 * /events lists by startsOn desc, id asc with a page limit. A fixed 2099-01-01 piles up across runs on the
 * same DB and pushes the new tournament off page 1 (flaky Step 2). A later date every minute keeps it first.
 */
function uniqueFutureDate(): string {
  const days = Math.floor((Date.now() - Date.UTC(2026, 9, 8)) / 60000);
  return new Date(Date.UTC(2100, 0, 1) + days * 86400000).toISOString().slice(0, 10);
}


/**
 * Packet bl-21: Slice 1 E2E Playwright Smoke Suite.
 *
 * Implements full RG-29..40 lifecycle without vacuous passes:
 * - Admin creates tournament & event via 4-step wizard (/events/new), capturing IDs deterministically.
 * - Admin publishes tournament on /events (draft -> open) to unlock entry submissions.
 * - Admin creates 3 doubles entries (A, B, C) on /admin/events/[eventId]/entries/new.
 * - Full type-ahead verification on team input ('blue', 'บลู', 'blue  wing', 'zzzz' -> request-new, select).
 * - Admin forwards all three entries to Committee queue (status -> pending_committee).
 * - Committee rejects entry B (asserts reason is mandatory >= 10 chars in dialog, submits valid reason).
 * - Committee approves entry A (asserts entry-grade-hidden visible, status approved).
 * - Committee leaves entry C pending_committee.
 * - API-level cross-check proves backend returns entry A as approved and excludes B and C.
 * - Member session (member1) verifies seeing ONLY approved entry A (B and C absent; zero rows fails).
 * - Strengthened unauthenticated checks against both /admin and /committee routes.
 * - Single login per role via storageState (auth.setup.ts). Only bad password performs interactive login.
 */

// Shared suite state across serial steps
let tournamentId = '';
let createdEventId = '';
let entryAId = '';
let entryBId = '';
let entryCId = '';

const runId = Date.now();
const tournamentName = `QA Tourney ${runId}`;

// ===========================================================================
// NEGATIVE CHECKS & UNAUTHENTICATED GUARDS
// ===========================================================================

// API envelope: { success, data }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const unwrap = (j: any) => (j && typeof j === 'object' && 'data' in j ? j.data : j);

test.describe('Negative & Access Control Checks', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('Negative check: bad password stays on /login with error alert', async ({ page }) => {
    const email = process.env.SEED_ADMIN_EMAIL;
    expect(email, 'SEED_ADMIN_EMAIL must be set').toBeTruthy();

    await page.goto(ROUTES.login);
    await page.getByTestId(SELECTORS.login.identifier).fill(email!);
    await page.getByTestId(SELECTORS.login.password).fill('WrongPassword999!');
    await page.getByTestId(SELECTORS.login.submit).click();

    // Verify remains on /login and error alert is displayed
    await expect(page).toHaveURL(/\/login/);
    const errorAlert = page.getByTestId(SELECTORS.login.error);
    await expect(errorAlert).toBeVisible();
  });

  test('Negative check: unauthenticated user accessing /admin entries is redirected to /login', async ({
    page,
  }) => {
    const dummyEventId = '00000000-0000-0000-0000-000000000000';
    await page.goto(ROUTES.adminEntryNew(dummyEventId));
    await expect(page).toHaveURL(new RegExp(ROUTES.login));
  });

  test('Negative check: unauthenticated user accessing /committee entries is redirected to /login', async ({
    page,
  }) => {
    const dummyEventId = '00000000-0000-0000-0000-000000000000';
    await page.goto(ROUTES.committeeEntries(dummyEventId));
    await expect(page).toHaveURL(new RegExp(ROUTES.login));
  });
});

// ===========================================================================
// ADMIN TOURNAMENT & EVENT CREATION (4-Step Wizard + Publish)
// ===========================================================================

test.describe.serial('Admin Tournament and Event Creation', () => {
  test.use({ storageState: ADMIN_AUTH_FILE });

  test('Step 1: Admin completes 4-step wizard at /events/new to create tournament and MD event', async ({
    page,
  }) => {
    await page.goto(ROUTES.events);

    // Open tournament wizard via link
    const createLink = page.getByTestId(SELECTORS.tournament.createOpen);
    await expect(createLink).toBeVisible({ timeout: 15000 });
    await createLink.click();
    await expect(page).toHaveURL(new RegExp(ROUTES.eventsNew));

    // Verify stepper component
    await expect(page.getByTestId(SELECTORS.wizard.stepper)).toBeVisible();
    const steps = page.getByTestId(SELECTORS.wizard.stepperStep);
    await expect(steps.nth(0)).toHaveAttribute('data-state', 'current');

    // Step 1: General Info
    await page.getByTestId(SELECTORS.wizard.name).fill(tournamentName);
    await page.getByTestId(SELECTORS.wizard.venue).fill('Bangkok Central Stadium');
    await page.getByTestId(SELECTORS.wizard.next).click();

    // Step 2: Schedule (dates well in future to prevent ENTRIES_CLOSED)
    await expect(steps.nth(0)).toHaveAttribute('data-state', 'done');
    await expect(steps.nth(1)).toHaveAttribute('data-state', 'current');
    await page.getByTestId(SELECTORS.wizard.startsOn).fill(uniqueFutureDate());
    await page.getByTestId(SELECTORS.wizard.entriesClose).fill('2098-12-01T23:59');
    await page.getByTestId(SELECTORS.wizard.next).click();

    // Step 3: Event Types
    await expect(steps.nth(1)).toHaveAttribute('data-state', 'done');
    await expect(steps.nth(2)).toHaveAttribute('data-state', 'current');

    const eventCard = page.getByTestId(SELECTORS.wizard.eventTypeCard).first();
    await expect(eventCard).toBeVisible();

    // Select discipline MD (selectOption, no input branch)
    await eventCard.getByTestId(SELECTORS.wizard.etcDiscipline).selectOption('MD');
    await eventCard.getByTestId(SELECTORS.wizard.gradeMin).selectOption('S-');
    await eventCard.getByTestId(SELECTORS.wizard.gradeMax).selectOption('S+');
    await eventCard.getByTestId(SELECTORS.wizard.etcMaxEntries).fill('16');

    const freshCheckbox = eventCard.getByTestId(SELECTORS.wizard.etcFresh);
    await expect(freshCheckbox).toBeVisible();
    if (await freshCheckbox.isChecked()) {
      await freshCheckbox.uncheck();
    }

    const knockoutRadio = eventCard.getByTestId(SELECTORS.wizard.etcFormatKnockout);
    await expect(knockoutRadio).toBeVisible();
    await knockoutRadio.check();

    await page.getByTestId(SELECTORS.wizard.next).click();

    // Step 4: Summary & Submit
    await expect(steps.nth(2)).toHaveAttribute('data-state', 'done');
    await expect(steps.nth(3)).toHaveAttribute('data-state', 'current');
    await expect(page.getByTestId(SELECTORS.wizard.summary)).toBeVisible();

    const createBtn = page.getByTestId(SELECTORS.wizard.create);
    await expect(createBtn).toBeVisible();
    await expect(createBtn).toHaveText(/สร้างทัวร์นาเมนต์/i);

    // Capture tournament ID and event ID deterministically from network responses
    let capturedTournamentId: string | null = null;
    let capturedEventId: string | null = null;

    const onResponse = async (response: Response) => {
      const url = response.url();
      const method = response.request().method();
      if (method === 'POST' && response.status() < 400) {
        if (url.includes('/tournaments') && !url.includes('/status') && !url.includes('/events')) {
          try {
            const json = unwrap(await response.json());
            if (json?.id) capturedTournamentId = json.id;
            if (json?.events?.[0]?.id) capturedEventId = json.events[0].id;
          } catch {}
        } else if (url.includes('/events') && !url.includes('/entries')) {
          try {
            const json = unwrap(await response.json());
            if (json?.id) capturedEventId = json.id;
            else if (Array.isArray(json) && json[0]?.id) capturedEventId = json[0].id;
          } catch {}
        }
      }
    };
    page.on('response', onResponse);

    await Promise.all([
      page.waitForResponse(
        (r: Response) => r.url().includes('/tournaments') && r.request().method() === 'POST' && r.status() < 400
      ),
      createBtn.click(),
    ]);

    // If event was created via a separate POST /tournaments/:id/events call, wait for it
    if (!capturedEventId) {
      const eventRes = await page.waitForResponse(
        (r: Response) => r.url().includes('/events') && r.request().method() === 'POST' && !r.url().includes('/entries') && r.status() < 400
      );
      try {
        const json = unwrap(await eventRes.json());
        if (json?.id) capturedEventId = json.id;
        else if (Array.isArray(json) && json[0]?.id) capturedEventId = json[0].id;
      } catch {}
    }
    page.off('response', onResponse);

    expect(capturedTournamentId, 'Tournament ID must be captured from creation response').toBeTruthy();
    expect(capturedEventId, 'Event ID must be captured from creation response').toBeTruthy();
    tournamentId = capturedTournamentId!;
    createdEventId = capturedEventId!;

    await expect(page.getByTestId(SELECTORS.wizard.error)).not.toBeVisible();
    await expect(page).toHaveURL(/\/events$/, { timeout: 15000 });
  });

  test('Step 2: Admin publishes tournament on /events and verifies status transition draft -> open', async ({
    page,
  }) => {
    expect(tournamentId, 'Tournament ID must be set from Step 1').toBeTruthy();

    await page.goto(ROUTES.events);

    const card = page.locator(`[data-testid="${SELECTORS.tournament.card}"][data-tournament-id="${tournamentId}"]`);
    await expect(card).toBeVisible({ timeout: 15000 });

    await expect(card.getByTestId(SELECTORS.tournament.name)).toHaveText(tournamentName);

    const statusBadge = card.getByTestId(SELECTORS.tournament.status);
    await expect(statusBadge).toBeVisible();
    await expect(statusBadge).toHaveAttribute('data-status', 'draft');

    await expect(card.getByTestId(SELECTORS.tournament.eventChip).first()).toBeVisible({ timeout: 15000 });
    await expect(card.getByTestId(SELECTORS.tournament.open)).toBeVisible();

    // Click publish button to change status draft -> open
    const publishBtn = card.getByTestId(SELECTORS.tournament.publish);
    await expect(publishBtn).toBeVisible();

    const [publishResponse] = await Promise.all([
      page.waitForResponse(
        (r: Response) => r.url().includes(`/tournaments/${tournamentId}/status`) && r.request().method() === 'POST'
      ),
      publishBtn.click(),
    ]);

    expect(publishResponse.status(), 'Tournament status change must succeed').toBe(200);

    // Verify tournament status is now open
    await expect(statusBadge).toHaveAttribute('data-status', 'open');
  });
});

// ===========================================================================
// ADMIN DOUBLES ENTRIES CREATION & FORWARDING (RG-29, RG-31, RG-32)
// ===========================================================================

test.describe.serial('Admin Entries Workflow (RG-29..32)', () => {
  test.use({ storageState: ADMIN_AUTH_FILE });

  test('Step 3: Admin creates Entry A with team type-ahead assertions and saves draft', async ({
    page,
  }) => {
    expect(createdEventId, 'createdEventId must be present').toBeTruthy();

    await page.goto(ROUTES.adminEntryNew(createdEventId));

    // Player 1 container
    const p1Container = page.getByTestId(SELECTORS.entryForm.player1);
    await expect(p1Container).toBeVisible();
    const p1Input = p1Container.getByTestId(SELECTORS.playerPicker.input);
    await p1Input.fill('member1');
    const p1Option = p1Container.getByTestId(SELECTORS.playerPicker.option).first();
    await expect(p1Option).toBeVisible();
    await p1Option.click();

    // Team 1 container with 4 type-ahead assertions
    const t1Container = page.getByTestId(SELECTORS.entryForm.team1);
    await expect(t1Container).toBeVisible();
    const t1Input = t1Container.getByTestId(SELECTORS.teamPicker.input);

    // 1. 'blue' offers Blue Wing
    await t1Input.fill('blue');
    const blueOption = t1Container.getByTestId(SELECTORS.teamPicker.option).filter({ hasText: /Blue Wing/i }).first();
    await expect(blueOption).toBeVisible();

    // 2. 'บลู' (Thai alias) offers Blue Wing
    await t1Input.fill('บลู');
    const aliasOption = t1Container.getByTestId(SELECTORS.teamPicker.option).filter({ hasText: /Blue Wing/i }).first();
    await expect(aliasOption).toBeVisible();

    // 3. 'blue  wing' (double space) offers Blue Wing
    await t1Input.fill('blue  wing');
    const spaceOption = t1Container.getByTestId(SELECTORS.teamPicker.option).filter({ hasText: /Blue Wing/i }).first();
    await expect(spaceOption).toBeVisible();

    // 4. 'zzzz' shows team-request-new
    await t1Input.fill('zzzz');
    const requestNew = t1Container.getByTestId(SELECTORS.teamPicker.requestNew);
    await expect(requestNew).toBeVisible();

    // Final select for Team 1: 'Blue Wing'
    await t1Input.fill('Blue Wing');
    const finalT1Option = t1Container.getByTestId(SELECTORS.teamPicker.option).filter({ hasText: /Blue Wing/i }).first();
    await expect(finalT1Option).toBeVisible();
    await finalT1Option.click();

    // Player 2 container
    const p2Container = page.getByTestId(SELECTORS.entryForm.player2);
    await expect(p2Container).toBeVisible();
    const p2Input = p2Container.getByTestId(SELECTORS.playerPicker.input);
    await p2Input.fill('member2');
    const p2Option = p2Container.getByTestId(SELECTORS.playerPicker.option).first();
    await expect(p2Option).toBeVisible();
    await p2Option.click();

    // Team 2 container
    const t2Container = page.getByTestId(SELECTORS.entryForm.team2);
    await expect(t2Container).toBeVisible();
    const t2Input = t2Container.getByTestId(SELECTORS.teamPicker.input);
    await t2Input.fill('Red Phoenix');
    const redOption = t2Container.getByTestId(SELECTORS.teamPicker.option).first();
    await expect(redOption).toBeVisible();
    await redOption.click();

    // Name field
    await page.getByTestId(SELECTORS.entryForm.name).fill('Pair Alpha (Draft A)');

    // Save draft and capture entry A ID deterministically
    const [response] = await Promise.all([
      page.waitForResponse((r: Response) => r.url().includes('/entries') && r.request().method() === 'POST'),
      page.getByTestId(SELECTORS.entryForm.saveDraft).click(),
    ]);

    expect(response.status(), 'Save draft Entry A failed').toBe(201);
    const json = unwrap(await response.json());
    expect(json?.id, 'Entry A ID must be present in response').toBeTruthy();
    expect(json?.status, 'Entry A status must be draft').toBe('draft');
    entryAId = json.id;

    // RG-31: Non-blocking warnings check (visible or absent, no crash)
    await expect(page.getByTestId(SELECTORS.entryForm.error)).not.toBeVisible();
  });

  test('Step 4: Admin creates Entry B (for reject test) and saves draft', async ({
    page,
  }) => {
    expect(createdEventId, 'createdEventId must be present').toBeTruthy();

    await page.goto(ROUTES.adminEntryNew(createdEventId));

    // Player 1
    const p1Container = page.getByTestId(SELECTORS.entryForm.player1);
    await expect(p1Container).toBeVisible();
    const p1Input = p1Container.getByTestId(SELECTORS.playerPicker.input);
    await p1Input.fill('member3');
    const p1Option = p1Container.getByTestId(SELECTORS.playerPicker.option).first();
    await expect(p1Option).toBeVisible();
    await p1Option.click();

    // Team 1
    const t1Container = page.getByTestId(SELECTORS.entryForm.team1);
    await expect(t1Container).toBeVisible();
    const t1Input = t1Container.getByTestId(SELECTORS.teamPicker.input);
    await t1Input.fill('Blue Wing');
    const t1Option = t1Container.getByTestId(SELECTORS.teamPicker.option).first();
    await expect(t1Option).toBeVisible();
    await t1Option.click();

    // Player 2
    const p2Container = page.getByTestId(SELECTORS.entryForm.player2);
    await expect(p2Container).toBeVisible();
    const p2Input = p2Container.getByTestId(SELECTORS.playerPicker.input);
    await p2Input.fill('member4');
    const p2Option = p2Container.getByTestId(SELECTORS.playerPicker.option).first();
    await expect(p2Option).toBeVisible();
    await p2Option.click();

    // Team 2
    const t2Container = page.getByTestId(SELECTORS.entryForm.team2);
    await expect(t2Container).toBeVisible();
    const t2Input = t2Container.getByTestId(SELECTORS.teamPicker.input);
    await t2Input.fill('Red Phoenix');
    const t2Option = t2Container.getByTestId(SELECTORS.teamPicker.option).first();
    await expect(t2Option).toBeVisible();
    await t2Option.click();

    await page.getByTestId(SELECTORS.entryForm.name).fill('Pair Beta (Draft B)');

    const [response] = await Promise.all([
      page.waitForResponse((r: Response) => r.url().includes('/entries') && r.request().method() === 'POST'),
      page.getByTestId(SELECTORS.entryForm.saveDraft).click(),
    ]);

    expect(response.status(), 'Save draft Entry B failed').toBe(201);
    const json = unwrap(await response.json());
    expect(json?.id, 'Entry B ID must be present in response').toBeTruthy();
    expect(json?.status, 'Entry B status must be draft').toBe('draft');
    entryBId = json.id;
  });

  test('Step 5: Admin creates Entry C (to remain pending) and saves draft', async ({
    page,
  }) => {
    expect(createdEventId, 'createdEventId must be present').toBeTruthy();

    await page.goto(ROUTES.adminEntryNew(createdEventId));

    // Player 1
    const p1Container = page.getByTestId(SELECTORS.entryForm.player1);
    await expect(p1Container).toBeVisible();
    const p1Input = p1Container.getByTestId(SELECTORS.playerPicker.input);
    await p1Input.fill('member5');
    const p1Option = p1Container.getByTestId(SELECTORS.playerPicker.option).first();
    await expect(p1Option).toBeVisible();
    await p1Option.click();

    // Team 1
    const t1Container = page.getByTestId(SELECTORS.entryForm.team1);
    await expect(t1Container).toBeVisible();
    const t1Input = t1Container.getByTestId(SELECTORS.teamPicker.input);
    await t1Input.fill('Blue Wing');
    const t1Option = t1Container.getByTestId(SELECTORS.teamPicker.option).first();
    await expect(t1Option).toBeVisible();
    await t1Option.click();

    // Player 2
    const p2Container = page.getByTestId(SELECTORS.entryForm.player2);
    await expect(p2Container).toBeVisible();
    const p2Input = p2Container.getByTestId(SELECTORS.playerPicker.input);
    await p2Input.fill('member6');
    const p2Option = p2Container.getByTestId(SELECTORS.playerPicker.option).first();
    await expect(p2Option).toBeVisible();
    await p2Option.click();

    // Team 2
    const t2Container = page.getByTestId(SELECTORS.entryForm.team2);
    await expect(t2Container).toBeVisible();
    const t2Input = t2Container.getByTestId(SELECTORS.teamPicker.input);
    await t2Input.fill('Red Phoenix');
    const t2Option = t2Container.getByTestId(SELECTORS.teamPicker.option).first();
    await expect(t2Option).toBeVisible();
    await t2Option.click();

    await page.getByTestId(SELECTORS.entryForm.name).fill('Pair Gamma (Draft C)');

    const [response] = await Promise.all([
      page.waitForResponse((r: Response) => r.url().includes('/entries') && r.request().method() === 'POST'),
      page.getByTestId(SELECTORS.entryForm.saveDraft).click(),
    ]);

    expect(response.status(), 'Save draft Entry C failed').toBe(201);
    const json = unwrap(await response.json());
    expect(json?.id, 'Entry C ID must be present in response').toBeTruthy();
    expect(json?.status, 'Entry C status must be draft').toBe('draft');
    entryCId = json.id;
  });

  test('Step 6: RG-32 Admin forwards drafts A, B, and C to Committee queue', async ({
    page,
  }) => {
    expect(createdEventId, 'createdEventId required').toBeTruthy();
    expect(entryAId, 'entryAId required').toBeTruthy();
    expect(entryBId, 'entryBId required').toBeTruthy();
    expect(entryCId, 'entryCId required').toBeTruthy();

    await page.goto(ROUTES.adminEntries(createdEventId));

    await expect(page.getByTestId(SELECTORS.entryList.table)).toBeVisible();

    // Forward Entry A
    const rowA = page.locator(`[data-entry-id="${entryAId}"]`);
    await expect(rowA).toBeVisible();
    const fwdBtnA = rowA.getByTestId(SELECTORS.entryList.forward);
    await expect(fwdBtnA).toBeVisible();
    await Promise.all([
      page.waitForResponse((r: Response) => r.url().includes(`/entries/${entryAId}/forward`) && r.request().method() === 'POST'),
      fwdBtnA.click(),
    ]);
    await expect(rowA).toHaveAttribute('data-status', /pending_committee/);

    // Forward Entry B
    const rowB = page.locator(`[data-entry-id="${entryBId}"]`);
    await expect(rowB).toBeVisible();
    const fwdBtnB = rowB.getByTestId(SELECTORS.entryList.forward);
    await expect(fwdBtnB).toBeVisible();
    await Promise.all([
      page.waitForResponse((r: Response) => r.url().includes(`/entries/${entryBId}/forward`) && r.request().method() === 'POST'),
      fwdBtnB.click(),
    ]);
    await expect(rowB).toHaveAttribute('data-status', /pending_committee/);

    // Forward Entry C
    const rowC = page.locator(`[data-entry-id="${entryCId}"]`);
    await expect(rowC).toBeVisible();
    const fwdBtnC = rowC.getByTestId(SELECTORS.entryList.forward);
    await expect(fwdBtnC).toBeVisible();
    await Promise.all([
      page.waitForResponse((r: Response) => r.url().includes(`/entries/${entryCId}/forward`) && r.request().method() === 'POST'),
      fwdBtnC.click(),
    ]);
    await expect(rowC).toHaveAttribute('data-status', /pending_committee/);
  });
});

// ===========================================================================
// COMMITTEE QUEUE REVIEW & RESOLUTION (RG-33, RG-36)
// ===========================================================================

test.describe.serial('Committee Review & Resolution (RG-33, RG-36)', () => {
  test.use({ storageState: COMMITTEE_AUTH_FILE });

  test('Step 7: RG-36 Committee rejects Entry B and asserts reason is mandatory (>= 10 chars)', async ({
    page,
  }) => {
    expect(createdEventId, 'createdEventId required').toBeTruthy();
    expect(entryBId, 'entryBId required').toBeTruthy();

    await page.goto(ROUTES.committeeEntries(createdEventId));

    await expect(page.getByTestId(SELECTORS.entryList.table)).toBeVisible();

    const rowB = page.locator(`[data-entry-id="${entryBId}"]`);
    await expect(rowB).toBeVisible();

    const rejectBtn = rowB.getByTestId(SELECTORS.entryList.reject);
    await expect(rejectBtn).toBeVisible();
    await rejectBtn.click();

    // Verify Reason Dialog opened
    const reasonInput = page.getByTestId(SELECTORS.reasonDialog.input);
    await expect(reasonInput).toBeVisible();

    // Mandatory reason check: submit disabled for empty and 9 chars
    await expect(page.getByTestId(SELECTORS.reasonDialog.submit)).toBeDisabled();
    await reasonInput.fill('abcdefghi');
    await expect(page.getByTestId(SELECTORS.reasonDialog.submit)).toBeDisabled();

    // 10 chars enables submit
    await reasonInput.fill('abcdefghij');
    await expect(page.getByTestId(SELECTORS.reasonDialog.submit)).toBeEnabled();

    // Submit with valid real reason (>= 10 chars)
    await reasonInput.fill('Duplicate pairing in this event tier');
    await Promise.all([
      page.waitForResponse((r: Response) => r.url().includes(`/entries/${entryBId}/reject`) && r.request().method() === 'POST'),
      page.getByTestId(SELECTORS.reasonDialog.submit).click(),
    ]);

    // Verify row B status is rejected
    await expect(rowB).toHaveCount(0);
  });

  test('Step 8: RG-33 Committee approves Entry A and verifies grade privacy', async ({
    page,
  }) => {
    expect(createdEventId, 'createdEventId required').toBeTruthy();
    expect(entryAId, 'entryAId required').toBeTruthy();

    await page.goto(ROUTES.committeeEntries(createdEventId));

    await expect(page.getByTestId(SELECTORS.entryList.table)).toBeVisible();

    const rowA = page.locator(`[data-entry-id="${entryAId}"]`);
    await expect(rowA).toBeVisible();

    const approveBtn = rowA.getByTestId(SELECTORS.entryList.approve);
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    // Confirm dialog (bl-26-3 ApproveConfirmDialog)
    const confirmBtn = page.getByTestId(SELECTORS.entryList.approveConfirm);
    await expect(confirmBtn).toBeVisible();
    await expect(page.getByTestId(SELECTORS.entryList.approveCancel)).toBeVisible();

    const [approveResponse] = await Promise.all([
      page.waitForResponse((r: Response) => r.url().includes(`/entries/${entryAId}/approve`) && r.request().method() === 'POST'),
      confirmBtn.click(),
    ]);
    expect(approveResponse.status(), 'Approve must succeed').toBe(200);

    // Verify row A status is approved
    await expect(rowA).toHaveCount(0);

    // Verify Entry C remains pending_committee
    const rowC = page.locator(`[data-entry-id="${entryCId}"]`);
    await expect(rowC).toBeVisible();
    await expect(rowC).toHaveAttribute('data-status', /pending_committee/);
  });

  test('Step 9: API-level cross-check proves backend returns entry A as approved', async ({
    request,
  }) => {
    expect(createdEventId, 'createdEventId required').toBeTruthy();

    // Query approved entries directly from API
    const response = await request.get(`/api/v1/events/${createdEventId}/entries?status=approved`);
    expect(response.status(), 'GET /entries?status=approved must succeed').toBe(200);

    const json = unwrap(await response.json());
    const list: Array<{ id: string }> = Array.isArray(json) ? json : json.items || [];
    const approvedIds = list.map((e) => e.id);

    // Entry A must be in approved list; Entry B (rejected) and C (pending) must NOT be present
    expect(approvedIds, 'Entry A must be returned as approved by API').toContain(entryAId);
    expect(approvedIds, 'Entry B (rejected) must not be returned in approved API list').not.toContain(entryBId);
    expect(approvedIds, 'Entry C (pending) must not be returned in approved API list').not.toContain(entryCId);
  });
});

// ===========================================================================
// MEMBER VIEW VERIFICATION (RG-37)
// ===========================================================================

test.describe.serial('Member Role Visibility (RG-37)', () => {
  test.use({ storageState: MEMBER_AUTH_FILE });

  test('Step 10: RG-37 Member session sees ONLY approved entry A (B and C absent)', async ({
    page,
  }) => {
    expect(createdEventId, 'createdEventId required').toBeTruthy();
    expect(entryAId, 'entryAId required').toBeTruthy();
    expect(entryBId, 'entryBId required').toBeTruthy();
    expect(entryCId, 'entryCId required').toBeTruthy();

    await page.goto(ROUTES.publicEntries(createdEventId));

    await expect(page.getByTestId(SELECTORS.entryList.table)).toBeVisible();

    // Member MUST see at least 1 row (Entry A). Zero rows is a FAIL.
    const allRows = page.getByTestId(SELECTORS.entryList.row);
    const rowCount = await allRows.count();
    expect(rowCount, 'Member view must display at least one approved entry row').toBeGreaterThan(0);

    // Entry A row MUST be visible
    const rowA = page.locator(`[data-entry-id="${entryAId}"]`);
    await expect(rowA, 'Approved Entry A must be visible to Member').toBeVisible();

    // Entry A must show grade hidden
    await expect(rowA.getByTestId(SELECTORS.entryList.gradeHidden).first()).toBeVisible();

    // Entry B (rejected) and Entry C (pending) MUST NOT be visible to Member
    const rowB = page.locator(`[data-entry-id="${entryBId}"]`);
    await expect(rowB, 'Rejected Entry B must NOT be visible to Member').not.toBeVisible();

    const rowC = page.locator(`[data-entry-id="${entryCId}"]`);
    await expect(rowC, 'Pending Entry C must NOT be visible to Member').not.toBeVisible();
  });
});
