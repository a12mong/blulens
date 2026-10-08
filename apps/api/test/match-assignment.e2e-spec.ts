import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-ma-${randomUUID().slice(0, 6)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt(
    { sub: id, roles },
    process.env.JWT_ACCESS_SECRET ?? 'blulens-jwt-secret-for-development-change-in-production',
    900,
    Math.floor(Date.now() / 1000),
  )}`;

describe('match-assignment (bl-25-16)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const userIds: string[] = [];
  let adminId: string;
  let committeeId: string;
  let memberId: string;
  let umpire1Id: string;
  let umpire2Id: string;
  let disabledUmpireId: string;
  let player1Id: string;
  let player2Id: string;
  let player3Id: string;

  let openEventId: string;
  let groupAId: string;
  let groupBId: string;
  let entry1Id: string;
  let match1Id: string;
  let match2Id: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();

    // 1. Users & Roles
    const admin = await prisma.user.create({
      data: {
        email: `${tag}-admin@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Admin`,
        roles: { create: [{ role: 'Admin' }] },
      },
    });
    adminId = admin.id;
    userIds.push(adminId);

    const committee = await prisma.user.create({
      data: {
        email: `${tag}-comm@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Committee`,
        roles: { create: [{ role: 'Committee' }] },
      },
    });
    committeeId = committee.id;
    userIds.push(committeeId);

    const member = await prisma.user.create({
      data: {
        email: `${tag}-member@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Member`,
        roles: { create: [{ role: 'Member' }] },
      },
    });
    memberId = member.id;
    userIds.push(memberId);

    const umpire1 = await prisma.user.create({
      data: {
        email: `${tag}-ump1@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Umpire 1`,
        roles: { create: [{ role: 'Umpire' }] },
      },
    });
    umpire1Id = umpire1.id;
    userIds.push(umpire1Id);

    const umpire2 = await prisma.user.create({
      data: {
        email: `${tag}-ump2@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Umpire 2`,
        roles: { create: [{ role: 'Umpire' }] },
      },
    });
    umpire2Id = umpire2.id;
    userIds.push(umpire2Id);

    const disabledUmpire = await prisma.user.create({
      data: {
        email: `${tag}-dis-ump@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Disabled Umpire`,
        status: 'disabled',
        roles: { create: [{ role: 'Umpire' }] },
      },
    });
    disabledUmpireId = disabledUmpire.id;
    userIds.push(disabledUmpireId);

    // player1 has Umpire role too, to test UMPIRE_OWN_MATCH
    const player1 = await prisma.user.create({
      data: {
        email: `${tag}-p1@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Player 1`,
        roles: { create: [{ role: 'Member' }, { role: 'Umpire' }] },
      },
    });
    player1Id = player1.id;
    userIds.push(player1Id);

    const player2 = await prisma.user.create({
      data: {
        email: `${tag}-p2@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Player 2`,
        roles: { create: [{ role: 'Member' }] },
      },
    });
    player2Id = player2.id;
    userIds.push(player2Id);

    const player3 = await prisma.user.create({
      data: {
        email: `${tag}-p3@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Player 3`,
        roles: { create: [{ role: 'Member' }] },
      },
    });
    player3Id = player3.id;
    userIds.push(player3Id);

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

    const event = await prisma.event.create({
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
    openEventId = event.id;

    // 3. Entries
    const e1 = await prisma.entry.create({
      data: {
        eventId: openEventId,
        status: 'approved',
        name: `${tag} Entry 1`,
        createdBy: adminId,
        players: { create: [{ userId: player1Id, eventId: openEventId }] },
      },
    });
    entry1Id = e1.id;

    const e2 = await prisma.entry.create({
      data: {
        eventId: openEventId,
        status: 'approved',
        name: `${tag} Entry 2`,
        createdBy: adminId,
        players: { create: [{ userId: player2Id, eventId: openEventId }] },
      },
    });

    const e3 = await prisma.entry.create({
      data: {
        eventId: openEventId,
        status: 'approved',
        name: `${tag} Entry 3`,
        createdBy: adminId,
        players: { create: [{ userId: player3Id, eventId: openEventId }] },
      },
    });

    // 4. Published Draw & Groups
    const draw = await prisma.draw.create({
      data: {
        eventId: openEventId,
        kind: 'group',
        version: 1,
        status: 'published',
        seed: 'seed',
        seedSource: 'server',
        inputHash: '1'.repeat(64),
        snapshot: {},
        rulesetVersion: '1.0',
        prngId: 'pcg32',
        size: 3,
        seedsCount: 0,
        createdBy: adminId,
      },
    });

    const groupA = await prisma.group.create({
      data: { eventId: openEventId, drawId: draw.id, label: 'A' },
    });
    groupAId = groupA.id;

    const groupB = await prisma.group.create({
      data: { eventId: openEventId, drawId: draw.id, label: 'B' },
    });
    groupBId = groupB.id;

    // 5. Matches
    const m1 = await prisma.match.create({
      data: {
        eventId: openEventId,
        drawId: draw.id,
        groupId: groupA.id,
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

    const m2 = await prisma.match.create({
      data: {
        eventId: openEventId,
        drawId: draw.id,
        groupId: groupB.id,
        stage: 'group',
        round: 1,
        matchNo: 2,
        court: null,
        status: 'scheduled',
        topEntryId: e2.id,
        bottomEntryId: e3.id,
      },
    });
    match2Id = m2.id;
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

  it('unauthenticated caller -> 401 UNAUTHENTICATED', async () => {
    const res = await http()
      .patch(`/api/v1/matches/${match1Id}/assignment`)
      .send({ court: 'สนาม 2' })
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('Member caller -> 403', async () => {
    const res = await http()
      .patch(`/api/v1/matches/${match1Id}/assignment`)
      .set('Cookie', cookieFor(memberId, ['Member']))
      .send({ court: 'สนาม 2' })
      .expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('empty body -> 400', async () => {
    const res = await http()
      .patch(`/api/v1/matches/${match1Id}/assignment`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('court of 21 chars -> 400', async () => {
    const res = await http()
      .patch(`/api/v1/matches/${match1Id}/assignment`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({ court: '123456789012345678901' })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('invalid umpireId (not uuid) -> 400', async () => {
    const res = await http()
      .patch(`/api/v1/matches/${match1Id}/assignment`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({ umpireId: 'not-a-valid-uuid' })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('match not found -> 404', async () => {
    const nonExistent = randomUUID();
    const res = await http()
      .patch(`/api/v1/matches/${nonExistent}/assignment`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({ court: 'สนาม 2' })
      .expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('MATCH_NOT_FOUND');
  });

  it("set court 'สนาม 2' -> 200 court set", async () => {
    const res = await http()
      .patch(`/api/v1/matches/${match1Id}/assignment`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({ court: 'สนาม 2' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.court).toBe('สนาม 2');
    expect(res.body.data.umpireId).toBeNull();

    // Check DB row
    const dbMatch = await prisma.match.findUnique({ where: { id: match1Id } });
    expect(dbMatch?.court).toBe('สนาม 2');
    expect(dbMatch?.umpireId).toBeNull();

    // Check audit log
    const audit = await prisma.auditLog.findFirst({
      where: {
        entityType: 'match',
        entityId: match1Id,
        action: 'match.assign',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorId).toBe(committeeId);
    expect((audit?.before as Record<string, unknown>).court).toBe('สนาม 1');
    expect((audit?.after as Record<string, unknown>).court).toBe('สนาม 2');
  });

  it('set umpireId of an Umpire -> 200, that umpire now sees it in GET /umpire/matches', async () => {
    const res = await http()
      .patch(`/api/v1/matches/${match1Id}/assignment`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({ umpireId: umpire1Id })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.umpireId).toBe(umpire1Id);
    expect(res.body.data.court).toBe('สนาม 2'); // court remains untouched

    // Check DB row
    const dbMatch = await prisma.match.findUnique({ where: { id: match1Id } });
    expect(dbMatch?.umpireId).toBe(umpire1Id);
    expect(dbMatch?.court).toBe('สนาม 2');

    // Umpire 1 now sees it in GET /api/v1/umpire/matches
    const umpireRes = await http()
      .get('/api/v1/umpire/matches')
      .set('Cookie', cookieFor(umpire1Id, ['Umpire']))
      .expect(200);

    expect(umpireRes.body.success).toBe(true);
    const matchIds = umpireRes.body.data.map((m: { id: string }) => m.id);
    expect(matchIds).toContain(match1Id);
  });

  it('umpireId of a Member without Umpire role -> 422', async () => {
    const res = await http()
      .patch(`/api/v1/matches/${match1Id}/assignment`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({ umpireId: memberId })
      .expect(422);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UMPIRE_INVALID');
  });

  it('umpireId of a disabled user with Umpire role -> 422', async () => {
    const res = await http()
      .patch(`/api/v1/matches/${match1Id}/assignment`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({ umpireId: disabledUmpireId })
      .expect(422);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UMPIRE_INVALID');
  });

  it('a player as umpire -> 422 UMPIRE_OWN_MATCH', async () => {
    // player1Id is a player in entry 1 (topEntry of match1)
    const res = await http()
      .patch(`/api/v1/matches/${match1Id}/assignment`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({ umpireId: player1Id })
      .expect(422);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UMPIRE_OWN_MATCH');
  });

  it('unsetting court with empty string -> 200 court is null', async () => {
    const res = await http()
      .patch(`/api/v1/matches/${match1Id}/assignment`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({ court: '' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.court).toBeNull();
    expect(res.body.data.umpireId).toBe(umpire1Id); // umpire remains untouched
  });

  it('unsetting umpire with null -> 200 umpireId is null', async () => {
    const res = await http()
      .patch(`/api/v1/matches/${match1Id}/assignment`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({ umpireId: null })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.umpireId).toBeNull();
  });

  it('Admin caller can assign court and umpire simultaneously -> 200', async () => {
    const res = await http()
      .patch(`/api/v1/matches/${match2Id}/assignment`)
      .set('Cookie', cookieFor(adminId, ['Admin']))
      .send({ court: 'สนาม 3', umpireId: umpire2Id })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.court).toBe('สนาม 3');
    expect(res.body.data.umpireId).toBe(umpire2Id);
  });

  it('confirmed stage -> 409', async () => {
    // Confirm group stage for groupA by creating a GroupStanding row
    await prisma.groupStanding.create({
      data: {
        groupId: groupAId,
        entryId: entry1Id,
        rank: 1,
        played: 1,
        won: 1,
        drawn: 0,
        lost: 0,
        points: 2,
        pointsFor: 30,
        pointsAgainst: 22,
        diff: 8,
        qualification: 'qualified',
        confirmedBy: adminId,
      },
    });

    const res = await http()
      .patch(`/api/v1/matches/${match1Id}/assignment`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({ court: 'สนาม 9' })
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('STAGE_CONFIRMED');
  });
});
