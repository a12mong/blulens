import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-um-${randomUUID().slice(0, 6)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt(
    { sub: id, roles },
    process.env.JWT_ACCESS_SECRET ?? 'blulens-jwt-secret-for-development-change-in-production',
    900,
    Math.floor(Date.now() / 1000),
  )}`;

describe('umpire-matches (bl-25-5 API)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const userIds: string[] = [];
  let adminId: string;
  let umpireAId: string;
  let umpireBId: string;
  let memberId: string;
  let p1Id: string;
  let p2Id: string;

  let event1Id: string;
  let match1Id: string; // Court 1 (สนาม 1), scheduled
  let match2Id: string; // Court 2 (สนาม 2), scheduled
  let match3Id: string; // Court 3 (สนาม 3), reported, umpireId = umpireB
  let matchAId: string; // Court 1 (สนาม 1), scheduled, umpireA plays as topEntry!
  let matchPrevId: string; // Preview draw match, should never be listed

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();

    // 1. Users
    const admin = await prisma.user.create({
      data: { email: `${tag}-admin@test.local`, passwordHash: 'x', displayName: `${tag} Admin` },
    });
    adminId = admin.id;
    userIds.push(adminId);

    const umpireA = await prisma.user.create({
      data: { email: `${tag}-umpa@test.local`, passwordHash: 'x', displayName: `${tag} Umpire A` },
    });
    umpireAId = umpireA.id;
    userIds.push(umpireAId);

    const umpireB = await prisma.user.create({
      data: { email: `${tag}-umpb@test.local`, passwordHash: 'x', displayName: `${tag} Umpire B` },
    });
    umpireBId = umpireB.id;
    userIds.push(umpireBId);

    const member = await prisma.user.create({
      data: { email: `${tag}-member@test.local`, passwordHash: 'x', displayName: `${tag} Member` },
    });
    memberId = member.id;
    userIds.push(memberId);

    const p1 = await prisma.user.create({
      data: { email: `${tag}-p1@test.local`, passwordHash: 'x', displayName: `${tag} Player 1` },
    });
    p1Id = p1.id;
    userIds.push(p1Id);

    const p2 = await prisma.user.create({
      data: { email: `${tag}-p2@test.local`, passwordHash: 'x', displayName: `${tag} Player 2` },
    });
    p2Id = p2.id;
    userIds.push(p2Id);

    // 2. Tournament & Event
    const tournament = await prisma.tournament.create({
      data: {
        name: `${tag} Tournament`,
        status: 'open',
        startsOn: new Date('2026-12-01T00:00:00Z'),
        entriesCloseAt: new Date('2026-11-20T17:00:00Z'),
        createdBy: adminId,
      },
    });

    const event1 = await prisma.event.create({
      data: {
        tournamentId: tournament.id,
        discipline: 'MS',
        gradeMinIndex: 6,
        gradeMaxIndex: 10,
        minReviewers: 2,
        format: {
          groupMatchFormat: {
            preset: 'group_2x15',
            mode: 'fixed_games',
            games: 2,
            pointsPerGame: 15,
            deuce: false,
            cap: null,
            drawAllowed: true,
          },
        },
      },
    });
    event1Id = event1.id;

    // 3. Entries
    const e1 = await prisma.entry.create({
      data: {
        eventId: event1Id,
        status: 'approved',
        name: `${tag} Entry 1`,
        createdBy: adminId,
        players: { create: [{ userId: p1Id, eventId: event1Id }] },
      },
    });

    const e2 = await prisma.entry.create({
      data: {
        eventId: event1Id,
        status: 'approved',
        name: `${tag} Entry 2`,
        createdBy: adminId,
        players: { create: [{ userId: p2Id, eventId: event1Id }] },
      },
    });

    const eA = await prisma.entry.create({
      data: {
        eventId: event1Id,
        status: 'approved',
        name: `${tag} Entry Umpire A`,
        createdBy: adminId,
        players: { create: [{ userId: umpireAId, eventId: event1Id }] },
      },
    });

    // 4. Draws: Published Draw and Preview Draw
    const drawPublished = await prisma.draw.create({
      data: {
        eventId: event1Id,
        kind: 'group',
        version: 1,
        status: 'published',
        seed: 'seed',
        seedSource: 'server',
        inputHash: '1'.repeat(64),
        snapshot: {},
        rulesetVersion: '1.0',
        prngId: 'pcg32',
        size: 4,
        seedsCount: 0,
        createdBy: adminId,
      },
    });

    const groupPub = await prisma.group.create({
      data: { eventId: event1Id, drawId: drawPublished.id, label: 'A' },
    });

    const drawPreview = await prisma.draw.create({
      data: {
        eventId: event1Id,
        kind: 'group',
        version: 2,
        status: 'preview',
        seed: 'seed',
        seedSource: 'server',
        inputHash: '2'.repeat(64),
        snapshot: {},
        rulesetVersion: '1.0',
        prngId: 'pcg32',
        size: 2,
        seedsCount: 0,
        createdBy: adminId,
      },
    });

    const groupPrev = await prisma.group.create({
      data: { eventId: event1Id, drawId: drawPreview.id, label: 'P' },
    });

    // 5. Matches in published draw
    // Match 1: court 'สนาม 1', scheduled
    const m1 = await prisma.match.create({
      data: {
        eventId: event1Id,
        drawId: drawPublished.id,
        groupId: groupPub.id,
        stage: 'group',
        round: 1,
        matchNo: 1,
        court: 'สนาม 1',
        status: 'scheduled',
        topEntryId: e1.id,
        bottomEntryId: e2.id,
      },
    });
    match1Id = m1.id;

    // Match 2: court 'สนาม 2', scheduled
    const m2 = await prisma.match.create({
      data: {
        eventId: event1Id,
        drawId: drawPublished.id,
        groupId: groupPub.id,
        stage: 'group',
        round: 1,
        matchNo: 2,
        court: 'สนาม 2',
        status: 'scheduled',
        topEntryId: e1.id,
        bottomEntryId: e2.id,
      },
    });
    match2Id = m2.id;

    // Match 3: court 'สนาม 3', reported, directly assigned to umpireB
    const m3 = await prisma.match.create({
      data: {
        eventId: event1Id,
        drawId: drawPublished.id,
        groupId: groupPub.id,
        stage: 'group',
        round: 1,
        matchNo: 3,
        court: 'สนาม 3',
        umpireId: umpireBId,
        status: 'reported',
        reportedBy: umpireBId,
        reportedAt: new Date(),
        result: 'a_win',
        topEntryId: e1.id,
        bottomEntryId: e2.id,
      },
    });
    match3Id = m3.id;

    // Match A: court 'สนาม 1', scheduled, where umpireA is a player!
    const mA = await prisma.match.create({
      data: {
        eventId: event1Id,
        drawId: drawPublished.id,
        groupId: groupPub.id,
        stage: 'group',
        round: 2,
        matchNo: 4,
        court: 'สนาม 1',
        status: 'scheduled',
        topEntryId: eA.id,
        bottomEntryId: e2.id,
      },
    });
    matchAId = mA.id;

    // Match in preview draw: should NEVER be listed
    const mPrev = await prisma.match.create({
      data: {
        eventId: event1Id,
        drawId: drawPreview.id,
        groupId: groupPrev.id,
        stage: 'group',
        round: 1,
        matchNo: 5,
        court: 'สนาม 1',
        status: 'scheduled',
        topEntryId: e1.id,
        bottomEntryId: e2.id,
      },
    });
    matchPrevId = mPrev.id;

    // 6. EventUmpire rows:
    // Umpire A: courts: [] (all courts of event 1)
    await prisma.eventUmpire.create({
      data: { eventId: event1Id, userId: umpireAId, courts: [] },
    });

    // Umpire B: courts: ['สนาม 2']
    await prisma.eventUmpire.create({
      data: { eventId: event1Id, userId: umpireBId, courts: ['สนาม 2'] },
    });
  });

  afterAll(async () => {
    if (userIds.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: { status: 'disabled' },
      });
    }
    await app.close();
    await prisma.$disconnect();
  });

  it('unauthenticated -> 401 UNAUTHENTICATED', async () => {
    await http().get('/api/v1/umpire/matches').expect(401);
  });

  it('a Member -> 403 FORBIDDEN', async () => {
    const memberCookie = cookieFor(memberId, ['Member']);
    await http().get('/api/v1/umpire/matches').set('Cookie', memberCookie).expect(403);
  });

  it('bad status -> 400 VALIDATION_FAILED', async () => {
    const umpireCookie = cookieFor(umpireAId, ['Umpire']);
    const res = await http()
      .get('/api/v1/umpire/matches?status=invalid_status')
      .set('Cookie', umpireCookie)
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('umpire A with EventUmpire courts [] on event 1 sees all its published matches (and not preview)', async () => {
    const umpireCookie = cookieFor(umpireAId, ['Umpire']);
    const res = await http().get('/api/v1/umpire/matches').set('Cookie', umpireCookie).expect(200);

    expect(res.body.success).toBe(true);
    const matches: Array<{ id: string; format: unknown }> = res.body.data;
    const matchIds = matches.map((m) => m.id);

    // Sees published matches on all courts
    expect(matchIds).toContain(match1Id);
    expect(matchIds).toContain(match2Id);
    expect(matchIds).toContain(match3Id);

    // Preview-draw match is never listed
    expect(matchIds).not.toContain(matchPrevId);

    // Match where Umpire A plays is excluded
    expect(matchIds).not.toContain(matchAId);

    // Format is included
    expect(matches[0]?.format).toBeDefined();
  });

  it('a match where A plays is not listed for A', async () => {
    const umpireCookie = cookieFor(umpireAId, ['Umpire']);
    const res = await http().get('/api/v1/umpire/matches').set('Cookie', umpireCookie).expect(200);

    const matchIds = res.body.data.map((m: { id: string }) => m.id);
    expect(matchIds).not.toContain(matchAId);
  });

  it("umpire B with courts ['สนาม 2'] sees only that court's matches", async () => {
    const umpireCookie = cookieFor(umpireBId, ['Umpire']);
    const res = await http()
      .get('/api/v1/umpire/matches?status=scheduled')
      .set('Cookie', umpireCookie)
      .expect(200);

    const matchIds = res.body.data.map((m: { id: string }) => m.id);

    // Sees match on 'สนาม 2'
    expect(matchIds).toContain(match2Id);

    // Does NOT see match on 'สนาม 1' (not assigned to this court, not direct umpireId)
    expect(matchIds).not.toContain(match1Id);
  });

  it('a match with umpireId = B on another court is also listed for B', async () => {
    const umpireCookie = cookieFor(umpireBId, ['Umpire']);
    const res = await http().get('/api/v1/umpire/matches').set('Cookie', umpireCookie).expect(200);

    const matchIds = res.body.data.map((m: { id: string }) => m.id);

    // m3 is on 'สนาม 3' (not in courts ['สนาม 2']), but has umpireId = umpireBId
    expect(matchIds).toContain(match3Id);
  });

  it('a preview-draw match is never listed', async () => {
    const umpireCookie = cookieFor(umpireBId, ['Umpire']);
    const res = await http().get('/api/v1/umpire/matches').set('Cookie', umpireCookie).expect(200);

    const matchIds = res.body.data.map((m: { id: string }) => m.id);
    expect(matchIds).not.toContain(matchPrevId);
  });

  it('?status=reported filters', async () => {
    const umpireCookie = cookieFor(umpireAId, ['Umpire']);
    const res = await http()
      .get('/api/v1/umpire/matches?status=reported')
      .set('Cookie', umpireCookie)
      .expect(200);

    expect(res.body.success).toBe(true);
    const matches: Array<{ id: string; status: string }> = res.body.data;
    const matchIds = matches.map((m) => m.id);

    // Only match3Id is 'reported'
    expect(matchIds).toContain(match3Id);
    expect(matchIds).not.toContain(match1Id);
    expect(matchIds).not.toContain(match2Id);
    expect(matches.every((m) => m.status === 'reported')).toBe(true);
  });
});
