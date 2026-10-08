import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-mra-${randomUUID().slice(0, 6)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt(
    { sub: id, roles },
    process.env.JWT_ACCESS_SECRET ?? 'blulens-jwt-secret-for-development-change-in-production',
    900,
    Math.floor(Date.now() / 1000),
  )}`;

describe('match-result-approve (bl-25-4 API)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const userIds: string[] = [];
  let adminId: string;
  let committeeId: string;
  let umpireId: string;
  let p1Id: string;
  let p2Id: string;

  let openEventId: string;
  let groupAId: string;
  let groupLockedId: string;
  let entry1Id: string;
  let entry2Id: string;

  let matchApproveId: string;
  let matchRejectId: string;
  let matchScheduledId: string;
  let matchLockedId: string;

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

    const umpire = await prisma.user.create({
      data: { email: `${tag}-ump@test.local`, passwordHash: 'x', displayName: `${tag} Umpire` },
    });
    umpireId = umpire.id;
    userIds.push(umpireId);

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
        players: { create: [{ userId: p1Id, eventId: openEventId }] },
      },
    });
    entry1Id = e1.id;

    const e2 = await prisma.entry.create({
      data: {
        eventId: openEventId,
        status: 'approved',
        name: `${tag} Entry 2`,
        createdBy: adminId,
        players: { create: [{ userId: p2Id, eventId: openEventId }] },
      },
    });
    entry2Id = e2.id;

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

    const groupLocked = await prisma.group.create({
      data: { eventId: openEventId, drawId: draw.id, label: 'B' },
    });
    groupLockedId = groupLocked.id;

    // 5. Matches
    // Match for approve test: will be reported first
    const mApprove = await prisma.match.create({
      data: {
        eventId: openEventId,
        drawId: draw.id,
        groupId: groupA.id,
        stage: 'group',
        round: 1,
        matchNo: 1,
        court: 'Court 1',
        status: 'scheduled',
        topEntryId: entry1Id,
        bottomEntryId: entry2Id,
      },
    });
    matchApproveId = mApprove.id;

    // Match for reject test: will be reported first
    const mReject = await prisma.match.create({
      data: {
        eventId: openEventId,
        drawId: draw.id,
        groupId: groupA.id,
        stage: 'group',
        round: 1,
        matchNo: 2,
        court: 'Court 1',
        status: 'scheduled',
        topEntryId: entry1Id,
        bottomEntryId: entry2Id,
      },
    });
    matchRejectId = mReject.id;

    // Match staying scheduled for scheduled-check tests
    const mSched = await prisma.match.create({
      data: {
        eventId: openEventId,
        drawId: draw.id,
        groupId: groupA.id,
        stage: 'group',
        round: 1,
        matchNo: 3,
        court: 'Court 1',
        status: 'scheduled',
        topEntryId: entry1Id,
        bottomEntryId: entry2Id,
      },
    });
    matchScheduledId = mSched.id;

    // Match in locked group
    const mLock = await prisma.match.create({
      data: {
        eventId: openEventId,
        drawId: draw.id,
        groupId: groupLocked.id,
        stage: 'group',
        round: 1,
        matchNo: 4,
        court: 'Court 1',
        status: 'scheduled',
        topEntryId: entry1Id,
        bottomEntryId: entry2Id,
      },
    });
    matchLockedId = mLock.id;

    // 6. EventUmpire
    await prisma.eventUmpire.create({
      data: { eventId: openEventId, userId: umpireId, courts: [] },
    });
  });

  afterAll(async () => {
    // Disable test users (avoid deleting from append-only tables)
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
    await http().post(`/api/v1/matches/${matchScheduledId}/result/approve`).expect(401);

    await http()
      .post(`/api/v1/matches/${matchScheduledId}/result/reject`)
      .send({ reason: 'Valid reason here' })
      .expect(401);
  });

  it('umpire calling approve or reject -> 403 FORBIDDEN', async () => {
    const umpireCookie = cookieFor(umpireId, ['Umpire']);

    await http()
      .post(`/api/v1/matches/${matchScheduledId}/result/approve`)
      .set('Cookie', umpireCookie)
      .expect(403);

    await http()
      .post(`/api/v1/matches/${matchScheduledId}/result/reject`)
      .set('Cookie', umpireCookie)
      .send({ reason: 'Valid reason here' })
      .expect(403);
  });

  it('missing match -> 404 MATCH_NOT_FOUND', async () => {
    const committeeCookie = cookieFor(committeeId, ['Committee']);
    const nonExistentMatchId = randomUUID();

    const resApprove = await http()
      .post(`/api/v1/matches/${nonExistentMatchId}/result/approve`)
      .set('Cookie', committeeCookie)
      .expect(404);
    expect(resApprove.body.error.code).toBe('MATCH_NOT_FOUND');

    const resReject = await http()
      .post(`/api/v1/matches/${nonExistentMatchId}/result/reject`)
      .set('Cookie', committeeCookie)
      .send({ reason: 'Valid reason here' })
      .expect(404);
    expect(resReject.body.error.code).toBe('MATCH_NOT_FOUND');
  });

  it('approve on scheduled match -> 409 MATCH_NOT_REPORTED', async () => {
    const committeeCookie = cookieFor(committeeId, ['Committee']);

    const res = await http()
      .post(`/api/v1/matches/${matchScheduledId}/result/approve`)
      .set('Cookie', committeeCookie)
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('MATCH_NOT_REPORTED');
  });

  it('reject on scheduled match -> 409 MATCH_NOT_REPORTED', async () => {
    const committeeCookie = cookieFor(committeeId, ['Committee']);

    const res = await http()
      .post(`/api/v1/matches/${matchScheduledId}/result/reject`)
      .set('Cookie', committeeCookie)
      .send({ reason: 'Match not played correctly' })
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('MATCH_NOT_REPORTED');
  });

  it('reject without reason or reason < 5 chars -> 400 VALIDATION_FAILED', async () => {
    const committeeCookie = cookieFor(committeeId, ['Committee']);

    // Missing reason body entirely
    const resNoBody = await http()
      .post(`/api/v1/matches/${matchScheduledId}/result/reject`)
      .set('Cookie', committeeCookie)
      .send({})
      .expect(400);
    expect(resNoBody.body.success).toBe(false);
    expect(resNoBody.body.error.code).toBe('VALIDATION_FAILED');

    // Reason shorter than 5 chars
    const resShort = await http()
      .post(`/api/v1/matches/${matchScheduledId}/result/reject`)
      .set('Cookie', committeeCookie)
      .send({ reason: 'bad' })
      .expect(400);
    expect(resShort.body.success).toBe(false);
    expect(resShort.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('umpire reports via PUT -> Committee approve -> 200 confirmed + confirmedBy + audit row', async () => {
    const umpireCookie = cookieFor(umpireId, ['Umpire']);
    const committeeCookie = cookieFor(committeeId, ['Committee']);

    // 1. Umpire reports match result
    const putRes = await http()
      .put(`/api/v1/matches/${matchApproveId}/result`)
      .set('Cookie', umpireCookie)
      .send({
        outcome: 'played',
        games: [
          { a: 15, b: 10 },
          { a: 15, b: 12 },
        ],
      })
      .expect(200);

    expect(putRes.body.data.status).toBe('reported');
    expect(putRes.body.data.reportedBy).toBe(umpireId);

    // 2. Committee approves match result
    const approveRes = await http()
      .post(`/api/v1/matches/${matchApproveId}/result/approve`)
      .set('Cookie', committeeCookie)
      .expect(200);

    expect(approveRes.body.success).toBe(true);
    const data = approveRes.body.data;
    expect(data.id).toBe(matchApproveId);
    expect(data.status).toBe('confirmed');
    expect(data.confirmedBy).toBe(committeeId);
    expect(data.confirmedAt).not.toBeNull();
    expect(data.reportedBy).toBe(umpireId);
    expect(data.result).toBe('a_win');
    expect(data.games).toEqual([
      { a: 15, b: 10 },
      { a: 15, b: 12 },
    ]);

    // 3. Verify audit row
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: matchApproveId, action: 'match.result.approve' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).toBeDefined();
    expect(audit?.actorId).toBe(committeeId);
    expect(audit?.entityType).toBe('match');
    const beforeData = audit?.before as Record<string, unknown>;
    const afterData = audit?.after as Record<string, unknown>;
    expect(beforeData.status).toBe('reported');
    expect(afterData.status).toBe('confirmed');
    expect(afterData.confirmedBy).toBe(committeeId);
  });

  it('approve again -> 409 MATCH_NOT_REPORTED', async () => {
    const committeeCookie = cookieFor(committeeId, ['Committee']);

    // matchApproveId is now confirmed; approving again must fail
    const res = await http()
      .post(`/api/v1/matches/${matchApproveId}/result/approve`)
      .set('Cookie', committeeCookie)
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('MATCH_NOT_REPORTED');
  });

  it('report -> reject with reason -> 200 scheduled, games [] in response, audit row with reason', async () => {
    const umpireCookie = cookieFor(umpireId, ['Umpire']);
    const committeeCookie = cookieFor(committeeId, ['Committee']);

    // 1. Umpire reports match result
    await http()
      .put(`/api/v1/matches/${matchRejectId}/result`)
      .set('Cookie', umpireCookie)
      .send({
        outcome: 'played',
        games: [
          { a: 15, b: 13 },
          { a: 15, b: 11 },
        ],
      })
      .expect(200);

    // 2. Committee rejects result with valid reason
    const rejectReason = 'Scoresheet transcription error, needs re-verification';
    const rejectRes = await http()
      .post(`/api/v1/matches/${matchRejectId}/result/reject`)
      .set('Cookie', committeeCookie)
      .send({ reason: rejectReason })
      .expect(200);

    expect(rejectRes.body.success).toBe(true);
    const data = rejectRes.body.data;
    expect(data.id).toBe(matchRejectId);
    expect(data.status).toBe('scheduled');
    expect(data.games).toEqual([]);
    expect(data.result).toBeNull();
    expect(data.reportedBy).toBeNull();
    expect(data.reportedAt).toBeNull();
    expect(data.confirmedBy).toBeNull();
    expect(data.confirmedAt).toBeNull();

    // 3. Verify audit row
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: matchRejectId, action: 'match.result.reject' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).toBeDefined();
    expect(audit?.actorId).toBe(committeeId);
    expect(audit?.reason).toBe(rejectReason);
    const beforeData = audit?.before as Record<string, unknown>;
    const afterData = audit?.after as Record<string, unknown>;
    expect(beforeData.status).toBe('reported');
    expect(beforeData.reportedBy).toBe(umpireId);
    expect(afterData.status).toBe('scheduled');
    expect(afterData.reportedBy).toBeNull();
  });

  it('GroupStanding row for the group -> 409 STAGE_CONFIRMED on approve and reject', async () => {
    const umpireCookie = cookieFor(umpireId, ['Umpire']);
    const committeeCookie = cookieFor(committeeId, ['Committee']);

    // 1. Report match in groupLocked before standing is created
    await http()
      .put(`/api/v1/matches/${matchLockedId}/result`)
      .set('Cookie', umpireCookie)
      .send({
        outcome: 'played',
        games: [
          { a: 15, b: 5 },
          { a: 15, b: 8 },
        ],
      })
      .expect(200);

    // 2. Lock group by creating a GroupStanding row
    await prisma.groupStanding.create({
      data: {
        groupId: groupLockedId,
        entryId: entry1Id,
        rank: 1,
        played: 1,
        won: 1,
        drawn: 0,
        lost: 0,
        points: 2,
        pointsFor: 30,
        pointsAgainst: 13,
        diff: 17,
        qualification: 'qualified',
        confirmedBy: adminId,
      },
    });

    // 3. Attempt approve -> 409 STAGE_CONFIRMED
    const approveRes = await http()
      .post(`/api/v1/matches/${matchLockedId}/result/approve`)
      .set('Cookie', committeeCookie)
      .expect(409);

    expect(approveRes.body.success).toBe(false);
    expect(approveRes.body.error.code).toBe('STAGE_CONFIRMED');

    // 4. Attempt reject -> 409 STAGE_CONFIRMED
    const rejectRes = await http()
      .post(`/api/v1/matches/${matchLockedId}/result/reject`)
      .set('Cookie', committeeCookie)
      .send({ reason: 'Attempt to reject locked group match' })
      .expect(409);

    expect(rejectRes.body.success).toBe(false);
    expect(rejectRes.body.error.code).toBe('STAGE_CONFIRMED');
  });

  it('admin can also approve reported match', async () => {
    const umpireCookie = cookieFor(umpireId, ['Umpire']);
    const adminCookie = cookieFor(adminId, ['Admin']);

    // Re-report matchRejectId (which was reset to scheduled)
    await http()
      .put(`/api/v1/matches/${matchRejectId}/result`)
      .set('Cookie', umpireCookie)
      .send({
        outcome: 'played',
        games: [
          { a: 15, b: 10 },
          { a: 15, b: 8 },
        ],
      })
      .expect(200);

    // Admin approves
    const res = await http()
      .post(`/api/v1/matches/${matchRejectId}/result/approve`)
      .set('Cookie', adminCookie)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('confirmed');
    expect(res.body.data.confirmedBy).toBe(adminId);
  });
});
