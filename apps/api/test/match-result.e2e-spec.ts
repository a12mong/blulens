import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-mr-${randomUUID().slice(0, 6)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

describe('match-result (bl-25-3 API)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const userIds: string[] = [];
  let adminId: string;
  let committeeId: string;
  let umpireAssignedId: string;
  let umpireUnassignedId: string;
  let p1Id: string;
  let p2Id: string;
  let p3Id: string;
  let memberId: string;

  let openEventId: string;
  let match1Id: string; // groupA scheduled
  let match2Id: string; // groupA scheduled -> will enter & correct
  let match3Id: string; // groupB scheduled -> walkover_a
  let matchOwnId: string; // groupB scheduled -> p1 plays
  let groupAId: string;
  let entry1Id: string;

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

    const committee = await prisma.user.create({
      data: { email: `${tag}-comm@test.local`, passwordHash: 'x', displayName: `${tag} Committee` },
    });
    committeeId = committee.id;
    userIds.push(committeeId);

    const umpireAssigned = await prisma.user.create({
      data: { email: `${tag}-ump1@test.local`, passwordHash: 'x', displayName: `${tag} Umpire 1` },
    });
    umpireAssignedId = umpireAssigned.id;
    userIds.push(umpireAssignedId);

    const umpireUnassigned = await prisma.user.create({
      data: { email: `${tag}-ump2@test.local`, passwordHash: 'x', displayName: `${tag} Umpire 2` },
    });
    umpireUnassignedId = umpireUnassigned.id;
    userIds.push(umpireUnassignedId);

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

    const p3 = await prisma.user.create({
      data: { email: `${tag}-p3@test.local`, passwordHash: 'x', displayName: `${tag} Player 3` },
    });
    p3Id = p3.id;
    userIds.push(p3Id);

    const member = await prisma.user.create({
      data: { email: `${tag}-member@test.local`, passwordHash: 'x', displayName: `${tag} Member` },
    });
    memberId = member.id;
    userIds.push(memberId);

    // 2. Clubs / Teams
    const team = await prisma.team.create({
      data: { name: `${tag} Team`, nameKey: `${tag}-team` },
    });

    // 3. Tournament & Event
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

    // 4. Entries
    const e1 = await prisma.entry.create({
      data: {
        eventId: openEventId,
        status: 'approved',
        name: `${tag} Entry 1`,
        createdBy: adminId,
        players: { create: [{ userId: p1Id, eventId: openEventId, teamId: team.id }] },
      },
    });
    entry1Id = e1.id;

    const e2 = await prisma.entry.create({
      data: {
        eventId: openEventId,
        status: 'approved',
        name: `${tag} Entry 2`,
        createdBy: adminId,
        players: { create: [{ userId: p2Id, eventId: openEventId, teamId: team.id }] },
      },
    });

    const e3 = await prisma.entry.create({
      data: {
        eventId: openEventId,
        status: 'approved',
        name: `${tag} Entry 3`,
        createdBy: adminId,
        players: { create: [{ userId: p3Id, eventId: openEventId }] },
      },
    });

    // 5. Published Draw & Groups
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

    // 6. Matches
    const m1 = await prisma.match.create({
      data: {
        eventId: openEventId,
        drawId: draw.id,
        groupId: groupA.id,
        stage: 'group',
        round: 1,
        matchNo: 1,
        court: 'Court 1',
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
        groupId: groupA.id,
        stage: 'group',
        round: 1,
        matchNo: 2,
        court: 'Court 2',
        status: 'scheduled',
        resultVersion: 1,
        topEntryId: e2.id,
        bottomEntryId: e3.id,
      },
    });
    match2Id = m2.id;

    const m3 = await prisma.match.create({
      data: {
        eventId: openEventId,
        drawId: draw.id,
        groupId: groupB.id,
        stage: 'group',
        round: 1,
        matchNo: 3,
        court: 'Court 1',
        status: 'scheduled',
        topEntryId: e1.id,
        bottomEntryId: e3.id,
      },
    });
    match3Id = m3.id;

    const m4 = await prisma.match.create({
      data: {
        eventId: openEventId,
        drawId: draw.id,
        groupId: groupB.id,
        stage: 'group',
        round: 2,
        matchNo: 4,
        court: 'Court 1',
        status: 'scheduled',
        topEntryId: e1.id,
        bottomEntryId: e2.id,
      },
    });
    matchOwnId = m4.id;

    // 7. EventUmpire rows:
    // umpireAssigned is assigned to every court (empty courts array)
    await prisma.eventUmpire.create({
      data: { eventId: openEventId, userId: umpireAssignedId, courts: [] },
    });
    // p1 is also registered as an EventUmpire
    await prisma.eventUmpire.create({
      data: { eventId: openEventId, userId: p1Id, courts: [] },
    });
  });

  afterAll(async () => {
    // Disable test users rather than deleting append-only rows
    if (userIds.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: { status: 'disabled' },
      });
    }
    await app.close();
    await prisma.$disconnect();
  });

  it('umpire reports valid 2x15 -> 200 reported + 1 audit row', async () => {
    const cookie = cookieFor(umpireAssignedId, ['Umpire']);
    const res = await http()
      .put(`/api/v1/matches/${match1Id}/result`)
      .set('Cookie', cookie)
      .send({
        outcome: 'played',
        games: [
          { a: 15, b: 12 },
          { a: 15, b: 10 },
        ],
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.id).toBe(match1Id);
    expect(data.status).toBe('reported');
    expect(data.result).toBe('a_win');
    expect(data.games).toEqual([
      { a: 15, b: 12 },
      { a: 15, b: 10 },
    ]);
    expect(data.reportedBy).toBe(umpireAssignedId);
    expect(data.reportedAt).not.toBeNull();
    expect(data.confirmedBy).toBeNull();
    expect(data.format.preset).toBe('group_2x15');

    // Audit log check
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: match1Id, action: 'match.result.report' },
    });
    expect(audit).toBeDefined();
    expect(audit?.actorId).toBe(umpireAssignedId);
    expect(audit?.entityType).toBe('match');
  });

  it('invalid score -> 422 MATCH_SCORE_INVALID', async () => {
    const cookie = cookieFor(umpireAssignedId, ['Umpire']);
    const res = await http()
      .put(`/api/v1/matches/${match2Id}/result`)
      .set('Cookie', cookie)
      .send({
        outcome: 'played',
        games: [{ a: 15, b: 10 }], // incomplete (only 1 game for 2x15)
      })
      .expect(422);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('MATCH_SCORE_INVALID');
    expect(res.body.error.details.code).toBe('GAMES_INCOMPLETE');
  });

  it('umpire not assigned -> 403 UMPIRE_NOT_ASSIGNED', async () => {
    const cookie = cookieFor(umpireUnassignedId, ['Umpire']);
    const res = await http()
      .put(`/api/v1/matches/${match2Id}/result`)
      .set('Cookie', cookie)
      .send({
        outcome: 'played',
        games: [
          { a: 15, b: 10 },
          { a: 15, b: 12 },
        ],
      })
      .expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UMPIRE_NOT_ASSIGNED');
  });

  it('umpire who plays in the match -> 403 UMPIRE_OWN_MATCH', async () => {
    const cookie = cookieFor(p1Id, ['Umpire']);
    const res = await http()
      .put(`/api/v1/matches/${matchOwnId}/result`)
      .set('Cookie', cookie)
      .send({
        outcome: 'played',
        games: [
          { a: 15, b: 10 },
          { a: 15, b: 12 },
        ],
      })
      .expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UMPIRE_OWN_MATCH');
  });

  it('Committee enters -> confirmed with COMMITTEE_DIRECT_ENTRY flag', async () => {
    const cookie = cookieFor(committeeId, ['Committee']);
    const res = await http()
      .put(`/api/v1/matches/${match2Id}/result`)
      .set('Cookie', cookie)
      .send({
        outcome: 'played',
        games: [
          { a: 11, b: 15 },
          { a: 10, b: 15 },
        ],
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.status).toBe('confirmed');
    expect(data.result).toBe('b_win');
    expect(data.flags).toContain('COMMITTEE_DIRECT_ENTRY');
    expect(data.confirmedBy).toBe(committeeId);
    expect(data.confirmedAt).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: match2Id, action: 'match.result.enter' },
    });
    expect(audit).toBeDefined();
    expect(audit?.actorId).toBe(committeeId);
  });

  it('Committee correct without reason -> 400, with reason -> resultVersion 2 + CORRECTED', async () => {
    const cookie = cookieFor(committeeId, ['Committee']);

    // Without reason -> 400
    const failRes = await http()
      .put(`/api/v1/matches/${match2Id}/result`)
      .set('Cookie', cookie)
      .send({
        outcome: 'played',
        games: [
          { a: 15, b: 13 },
          { a: 15, b: 12 },
        ],
      })
      .expect(400);

    expect(failRes.body.success).toBe(false);
    expect(failRes.body.error.code).toBe('VALIDATION_FAILED');

    // With reason -> 200, resultVersion 2, CORRECTED flag
    const okRes = await http()
      .put(`/api/v1/matches/${match2Id}/result`)
      .set('Cookie', cookie)
      .send({
        outcome: 'played',
        games: [
          { a: 15, b: 13 },
          { a: 15, b: 12 },
        ],
        reason: 'Score sheet transcription correction',
      })
      .expect(200);

    expect(okRes.body.success).toBe(true);
    const data = okRes.body.data;
    expect(data.status).toBe('confirmed');
    expect(data.result).toBe('a_win');
    expect(data.flags).toContain('CORRECTED');

    // Check DB resultVersion
    const inDb = await prisma.match.findUnique({ where: { id: match2Id } });
    expect(inDb?.resultVersion).toBe(2);

    // Audit log check
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: match2Id, action: 'match.result.correct' },
    });
    expect(audit).toBeDefined();
    expect(audit?.reason).toBe('Score sheet transcription correction');
  });

  it('GroupStanding row for the group -> 409 STAGE_CONFIRMED', async () => {
    // Confirm group stage by creating a GroupStanding row
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

    const cookie = cookieFor(committeeId, ['Committee']);
    const res = await http()
      .put(`/api/v1/matches/${match2Id}/result`)
      .set('Cookie', cookie)
      .send({
        outcome: 'played',
        games: [
          { a: 15, b: 10 },
          { a: 15, b: 11 },
        ],
        reason: 'Attempted edit after group confirmed',
      })
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('STAGE_CONFIRMED');
  });

  it('walkover_a -> a_win-style games', async () => {
    const cookie = cookieFor(committeeId, ['Committee']);
    const res = await http()
      .put(`/api/v1/matches/${match3Id}/result`)
      .set('Cookie', cookie)
      .send({
        outcome: 'walkover_a',
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.status).toBe('confirmed');
    expect(data.result).toBe('walkover_a');
    expect(data.games).toEqual([
      { a: 15, b: 0 },
      { a: 15, b: 0 },
    ]);
  });

  it('Member role returns 403 Forbidden', async () => {
    const cookie = cookieFor(memberId, ['Member']);
    const res = await http()
      .put(`/api/v1/matches/${match3Id}/result`)
      .set('Cookie', cookie)
      .send({ outcome: 'walkover_a' })
      .expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('Unauthenticated caller returns 401', async () => {
    const res = await http()
      .put(`/api/v1/matches/${match3Id}/result`)
      .send({ outcome: 'walkover_a' })
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('Missing match returns 404 MATCH_NOT_FOUND', async () => {
    const cookie = cookieFor(committeeId, ['Committee']);
    const badId = randomUUID();
    const res = await http()
      .put(`/api/v1/matches/${badId}/result`)
      .set('Cookie', cookie)
      .send({ outcome: 'walkover_a' })
      .expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('MATCH_NOT_FOUND');
  });

  it('played without games returns 400 VALIDATION_FAILED', async () => {
    const cookie = cookieFor(committeeId, ['Committee']);
    const res = await http()
      .put(`/api/v1/matches/${match3Id}/result`)
      .set('Cookie', cookie)
      .send({ outcome: 'played' })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});
