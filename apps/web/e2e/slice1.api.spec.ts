import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test';

/**
 * Packet bl-21: Slice 1 API-level Playwright Smoke Suite.
 *
 * Verifies backend slice (8eceaab) purely via APIRequestContext:
 * - Admin/Committee/Member1 session authentication (once each, rate-limit safe).
 * - Tournaments & Events creation + publish flow.
 * - Non-staff vs staff visibility rules.
 * - Doubles entries on behalf with distinct members and clubs.
 * - Forward -> Committee reject (with min length 5) & approve.
 * - Negative and hard error checks:
 *   - ENTRY_PLAYER_COUNT (1 player for doubles)
 *   - ENTRY_DUPLICATE_PLAYER (same player twice or already registered)
 *   - ENTRIES_CLOSED (creating entry while tournament is in draft)
 *   - 409 ENTRY_PLAYER_UNGRADED (attempting to approve an entry with an ungraded player)
 *   - 403 FORBIDDEN for non-staff role actions (mutations)
 */

const API_BASE = (process.env.API_URL ?? 'http://localhost:3101').replace(/\/+$/, '') + '/api/v1/';

async function getJson<T = any>(res: APIResponse): Promise<T> {
  const json = await res.json();
  if (json && typeof json === 'object' && 'data' in json) {
    return json.data as T;
  }
  return json as T;
}

async function getError(res: APIResponse): Promise<{ code: string; message: string; details?: unknown }> {
  const json = await res.json();
  return json?.error ?? json;
}

test.describe.serial('bl-21 API Slice Smoke Tests', () => {
  let adminCtx: APIRequestContext;
  let committeeCtx: APIRequestContext;
  let member1Ctx: APIRequestContext;

  let tournamentId = '';
  let eventId = '';
  let entryAId = '';
  let entryBId = '';
  let entryCId = '';

  let members: Array<{ id: string; displayName: string }> = [];
  let teamBlueId = '';
  let teamRedId = '';
  let teamGreenId = '';

  test.beforeAll(async ({ playwright }) => {
    adminCtx = await playwright.request.newContext({ baseURL: API_BASE });
    committeeCtx = await playwright.request.newContext({ baseURL: API_BASE });
    member1Ctx = await playwright.request.newContext({ baseURL: API_BASE });

    const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@blulens.local';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;
    const demoPassword = process.env.SEED_DEMO_PASSWORD;
    if (!adminPassword || !demoPassword) {
      throw new Error('SEED_ADMIN_PASSWORD and SEED_DEMO_PASSWORD must be set (no defaults)');
    }

    // 1. Authenticate each role once (within rate limit of 10/min)
    const adminLoginRes = await adminCtx.post('auth/login', {
      data: { identifier: adminEmail, password: adminPassword },
    });
    expect(adminLoginRes.status(), 'Admin login failed').toBe(200);

    const commLoginRes = await committeeCtx.post('auth/login', {
      data: { identifier: 'committee@blulens.local', password: demoPassword },
    });
    expect(commLoginRes.status(), 'Committee login failed').toBe(200);

    const memLoginRes = await member1Ctx.post('auth/login', {
      data: { identifier: 'member1@blulens.local', password: demoPassword },
    });
    expect(memLoginRes.status(), 'Member1 login failed').toBe(200);

    // 2. Fetch members and teams for test fixtures (unwrapping API envelope { success: true, data })
    const usersRes = await committeeCtx.get('users?role=Member&limit=50');
    expect(usersRes.status(), 'GET /users failed').toBe(200);
    const usersData = await getJson<{ items: Array<{ id: string; displayName: string }> }>(usersRes);
    const userByName = new Map(usersData.items.map((u) => [u.displayName, u]));

    const member1 = userByName.get('สมชาย ใจดี');
    const member2 = userByName.get('วิภา ศรีสุข');
    const member3 = userByName.get('ธนา รุ่งเรือง');
    const member4 = userByName.get('มาลี สายสมร');
    const member5 = userByName.get('กิตติ พานทอง');
    const member6 = userByName.get('นภา ทองดี');
    expect(member1 && member2 && member3 && member4 && member5 && member6, 'All 6 demo members must exist in seed').toBeTruthy();
    members = [member1!, member2!, member3!, member4!, member5!, member6!];

    const blueTeamRes = await committeeCtx.get('teams/suggest?q=blue');
    expect(blueTeamRes.status()).toBe(200);
    const blueJson = await getJson<Array<{ teamId: string; name: string }>>(blueTeamRes);
    teamBlueId = blueJson[0]?.teamId!;
    expect(teamBlueId, 'Blue Wing team must exist').toBeTruthy();

    const redTeamRes = await committeeCtx.get('teams/suggest?q=red');
    expect(redTeamRes.status()).toBe(200);
    const redJson = await getJson<Array<{ teamId: string; name: string }>>(redTeamRes);
    teamRedId = redJson[0]?.teamId!;
    expect(teamRedId, 'Red Phoenix team must exist').toBeTruthy();

    const greenTeamRes = await committeeCtx.get('teams/suggest?q=green');
    expect(greenTeamRes.status()).toBe(200);
    const greenJson = await getJson<Array<{ teamId: string; name: string }>>(greenTeamRes);
    teamGreenId = greenJson[0]?.teamId!;
    expect(teamGreenId, 'Green Valley team must exist').toBeTruthy();
  });

  test.afterAll(async () => {
    await adminCtx.dispose();
    await committeeCtx.dispose();
    await member1Ctx.dispose();
  });

  test('Step 1: Admin creates tournament (status draft)', async () => {
    const res = await adminCtx.post('tournaments', {
      data: {
        name: `API Test Tournament ${Date.now()}`,
        venue: 'Bangkok Arena',
        startsOn: '2026-12-01',
        entriesCloseAt: '2026-11-20T23:59:00.000Z',
      },
    });

    expect(res.status(), 'Tournament creation must return 201').toBe(201);
    const body = await getJson<{ id: string; status: string }>(res);
    expect(body.id).toBeTruthy();
    expect(body.status).toBe('draft');
    tournamentId = body.id;
  });

  test('Step 2: Admin creates MD event under tournament', async () => {
    expect(tournamentId).toBeTruthy();

    const res = await adminCtx.post(`tournaments/${tournamentId}/events`, {
      data: {
        discipline: 'MD',
        gradeMin: 'S-',
        gradeMax: 'S+',
        maxEntries: 16,
        minReviewers: 2,
      },
    });

    expect(res.status(), 'Event creation must return 201').toBe(201);
    const body = await getJson<{ id: string; discipline: string }>(res);
    expect(body.id).toBeTruthy();
    expect(body.discipline).toBe('MD');
    eventId = body.id;
  });

  test('Step 3 (Hard Error): ENTRIES_CLOSED when creating entry before tournament publish', async () => {
    expect(eventId).toBeTruthy();

    const res = await adminCtx.post(`events/${eventId}/entries`, {
      data: {
        players: [
          { userId: members[0]!.id, teamId: teamBlueId },
          { userId: members[1]!.id, teamId: teamRedId },
        ],
      },
    });

    expect(res.status(), 'Should return 409 Conflict when tournament is draft').toBe(409);
    const errBody = await getError(res);
    expect(errBody?.code).toBe('ENTRIES_CLOSED');
  });

  test('Step 4: Committee publishes tournament to open status', async () => {
    expect(tournamentId).toBeTruthy();

    const res = await committeeCtx.post(`tournaments/${tournamentId}/status`, {
      data: { to: 'open' },
    });

    expect(res.status(), 'Status change must return 200').toBe(200);
    const body = await getJson<{ status: string }>(res);
    expect(body.status).toBe('open');
  });

  test('Step 5 (Hard Error): ENTRY_PLAYER_COUNT when submitting 1 player for doubles', async () => {
    expect(eventId).toBeTruthy();

    const res = await adminCtx.post(`events/${eventId}/entries`, {
      data: {
        players: [{ userId: members[0]!.id, teamId: teamBlueId }],
      },
    });

    expect(res.status(), 'Should return 409 Conflict for 1 player in MD').toBe(409);
    const errBody = await getError(res);
    expect(errBody?.code).toBe('ENTRY_PLAYER_COUNT');
  });

  test('Step 6 (Hard Error): ENTRY_DUPLICATE_PLAYER when player is repeated in entry', async () => {
    expect(eventId).toBeTruthy();

    const res = await adminCtx.post(`events/${eventId}/entries`, {
      data: {
        players: [
          { userId: members[0]!.id, teamId: teamBlueId },
          { userId: members[0]!.id, teamId: teamRedId },
        ],
      },
    });

    expect(res.status(), 'Should return 409 Conflict for duplicate player in same entry').toBe(409);
    const errBody = await getError(res);
    expect(errBody?.code).toBe('ENTRY_DUPLICATE_PLAYER');
  });

  test('Step 7: Admin creates 3 valid doubles entries on behalf (A, B, C)', async () => {
    expect(eventId).toBeTruthy();

    // Entry A: member1 & member2
    const resA = await adminCtx.post(`events/${eventId}/entries`, {
      data: {
        name: 'Entry Pair A',
        players: [
          { userId: members[0]!.id, teamId: teamBlueId },
          { userId: members[1]!.id, teamId: teamRedId },
        ],
      },
    });
    expect(resA.status(), 'Entry A creation failed').toBe(201);
    const bodyA = await getJson<{ id: string; status: string }>(resA);
    expect(bodyA.status).toBe('draft');
    entryAId = bodyA.id;

    // Entry B: member3 & member4
    const resB = await adminCtx.post(`events/${eventId}/entries`, {
      data: {
        name: 'Entry Pair B',
        players: [
          { userId: members[2]!.id, teamId: teamRedId },
          { userId: members[3]!.id, teamId: teamGreenId },
        ],
      },
    });
    expect(resB.status(), 'Entry B creation failed').toBe(201);
    const bodyB = await getJson<{ id: string; status: string }>(resB);
    expect(bodyB.status).toBe('draft');
    entryBId = bodyB.id;

    // Entry C: member5 & member6
    const resC = await adminCtx.post(`events/${eventId}/entries`, {
      data: {
        name: 'Entry Pair C',
        players: [
          { userId: members[4]!.id, teamId: teamGreenId },
          { userId: members[5]!.id, teamId: teamBlueId },
        ],
      },
    });
    expect(resC.status(), 'Entry C creation failed').toBe(201);
    const bodyC = await getJson<{ id: string; status: string }>(resC);
    expect(bodyC.status).toBe('draft');
    entryCId = bodyC.id;
  });

  test('Step 8: Admin forwards entries A, B, C to Committee queue', async () => {
    expect(entryAId).toBeTruthy();
    expect(entryBId).toBeTruthy();
    expect(entryCId).toBeTruthy();

    const fwdA = await adminCtx.post(`entries/${entryAId}/forward`);
    expect(fwdA.status()).toBe(200);
    const bodyA = await getJson<{ status: string }>(fwdA);
    expect(bodyA.status).toBe('pending_committee');

    const fwdB = await adminCtx.post(`entries/${entryBId}/forward`);
    expect(fwdB.status()).toBe(200);
    const bodyB = await getJson<{ status: string }>(fwdB);
    expect(bodyB.status).toBe('pending_committee');

    const fwdC = await adminCtx.post(`entries/${entryCId}/forward`);
    expect(fwdC.status()).toBe(200);
    const bodyC = await getJson<{ status: string }>(fwdC);
    expect(bodyC.status).toBe('pending_committee');
  });

  test('Step 9: Committee rejects Entry B (reason min length validation & success)', async () => {
    expect(entryBId).toBeTruthy();

    // Reason validation: 9 chars must fail with 400
    const shortReasonRes = await committeeCtx.post(`entries/${entryBId}/reject`, {
      data: { reason: 'abcdefghi' },
    });
    expect(shortReasonRes.status(), 'Short reason (9 chars) must return 400').toBe(400);

    // Valid reason: 10+ chars must succeed
    const validRejectRes = await committeeCtx.post(`entries/${entryBId}/reject`, {
      data: { reason: 'Duplicate skill tier pairing' },
    });
    expect(validRejectRes.status(), 'Reject with valid reason must succeed').toBe(200);
    const body = await getJson<{ status: string }>(validRejectRes);
    expect(body.status).toBe('rejected');
  });

  test('Step 10: Committee approves Entry A', async () => {
    expect(entryAId).toBeTruthy();

    const res = await committeeCtx.post(`entries/${entryAId}/approve`, {
      data: {},
    });
    expect(res.status(), 'Approve must return 200').toBe(200);
    const body = await getJson<{ status: string }>(res);
    expect(body.status).toBe('approved');
  });

  test('Step 11: Member1 queries approved entries and sees ONLY Entry A (B & C absent)', async () => {
    expect(eventId).toBeTruthy();

    const res = await member1Ctx.get(`events/${eventId}/entries?status=approved`);
    expect(res.status(), 'GET /events/{id}/entries?status=approved must return 200').toBe(200);

    const list = await getJson<Array<{ id: string; status: string; players: Array<{ gradeView?: unknown }> }>>(res);
    const ids = list.map((e) => e.id);

    // Must return Entry A
    expect(ids, 'Approved entry A must be present in member view').toContain(entryAId);

    // Must NOT return Entry B (rejected) or Entry C (pending)
    expect(ids, 'Rejected entry B must NOT be present in member view').not.toContain(entryBId);
    expect(ids, 'Pending entry C must NOT be present in member view').not.toContain(entryCId);

    // Member view must hide grades (A14 disclosure privacy)
    const entryA = list.find((e) => e.id === entryAId)!;
    for (const p of entryA.players) {
      expect(p.gradeView, 'Grade must not be exposed to general members').toBeUndefined();
    }
  });

  test('Step 12 (Hard Error): 409 ENTRY_PLAYER_UNGRADED when attempting to approve an ungraded player', async ({ playwright }) => {
    expect(eventId).toBeTruthy();

    // Register two new users in a fresh context so admin session cookies aren't overwritten
    const tempCtx = await playwright.request.newContext({ baseURL: API_BASE });
    let user1: { id: string };
    let user2: { id: string };
    try {
      const randomSuffix = Math.floor(Math.random() * 100000);
      const regRes1 = await tempCtx.post('auth/register', {
        data: {
          email: `ungraded1.${randomSuffix}@blulens.local`,
          password: process.env.SEED_DEMO_PASSWORD as string,
          displayName: 'Ungraded Player 1',
        },
      });
      expect([200, 201], 'Registration of player 1 failed').toContain(regRes1.status());
      user1 = await getJson<{ id: string }>(regRes1);

      const regRes2 = await tempCtx.post('auth/register', {
        data: {
          email: `ungraded2.${randomSuffix}@blulens.local`,
          password: process.env.SEED_DEMO_PASSWORD as string,
          displayName: 'Ungraded Player 2',
        },
      });
      expect([200, 201], 'Registration of player 2 failed').toContain(regRes2.status());
      user2 = await getJson<{ id: string }>(regRes2);
    } finally {
      await tempCtx.dispose();
    }

    // Admin creates an entry containing these ungraded users
    const createRes = await adminCtx.post(`events/${eventId}/entries`, {
      data: {
        name: 'Ungraded Entry',
        players: [
          { userId: user1.id, teamId: teamBlueId },
          { userId: user2.id, teamId: teamRedId },
        ],
      },
    });
    expect(createRes.status(), 'Creation of ungraded entry failed').toBe(201);
    const ungradedEntry = await getJson<{ id: string; warnings: string[] }>(createRes);
    expect(ungradedEntry.warnings).toContain('NO_APPROVED_GRADE');

    // Forward to committee
    const fwdRes = await adminCtx.post(`entries/${ungradedEntry.id}/forward`);
    expect(fwdRes.status()).toBe(200);

    // Committee attempts to approve -> MUST fail with 409 ENTRY_PLAYER_UNGRADED
    const approveUngradedRes = await committeeCtx.post(`entries/${ungradedEntry.id}/approve`, {
      data: {},
    });
    expect(approveUngradedRes.status(), 'Approving ungraded player must return 409 Conflict').toBe(409);
    const errBody = await getError(approveUngradedRes);
    expect(errBody?.code).toBe('ENTRY_PLAYER_UNGRADED');
  });

  // ===========================================================================
  // MUTATION TESTS (Proving test suite catches invalid state / access violations)
  // ===========================================================================

  test('Mutation M1: Member attempts to approve an entry -> 403 Forbidden', async () => {
    expect(entryCId).toBeTruthy();

    const res = await member1Ctx.post(`entries/${entryCId}/approve`, {
      data: {},
    });
    expect(res.status(), 'Member approving entry must return 403 Forbidden').toBe(403);
  });

  test('Mutation M2: Member attempts to reject an entry -> 403 Forbidden', async () => {
    expect(entryCId).toBeTruthy();

    const res = await member1Ctx.post(`entries/${entryCId}/reject`, {
      data: { reason: 'Unauthorized rejection attempt' },
    });
    expect(res.status(), 'Member rejecting entry must return 403 Forbidden').toBe(403);
  });

  test('Mutation M3: Member attempts to create an entry on behalf of players -> 403 Forbidden', async () => {
    expect(eventId).toBeTruthy();

    const res = await member1Ctx.post(`events/${eventId}/entries`, {
      data: {
        players: [
          { userId: members[0]!.id, teamId: teamBlueId },
          { userId: members[1]!.id, teamId: teamRedId },
        ],
      },
    });
    expect(res.status(), 'Member creating entry on behalf must return 403 Forbidden').toBe(403);
  });
});
