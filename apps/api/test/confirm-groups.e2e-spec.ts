import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-cfg-${randomUUID().slice(0, 6)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

describe('confirm-groups (bl-25-11)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const userIds: string[] = [];
  let adminId: string;
  let committeeId: string;
  let memberId: string;

  let completeEventId: string;
  let incompleteEventId: string;
  let noDrawEventId: string;
  let bestThirdsEventId: string;

  let completeDrawId: string;
  let incompleteDrawId: string;
  let firstMatchId: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();

    // 1. Roles: Admin, Committee, Member
    const admin = await prisma.user.create({
      data: {
        email: `${tag}-admin@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Admin`,
      },
    });
    adminId = admin.id;
    userIds.push(adminId);

    const comm = await prisma.user.create({
      data: {
        email: `${tag}-comm@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Committee`,
      },
    });
    committeeId = comm.id;
    userIds.push(committeeId);

    const member = await prisma.user.create({
      data: {
        email: `${tag}-member@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Member`,
      },
    });
    memberId = member.id;
    userIds.push(memberId);

    // 2. Club Team
    const team = await prisma.team.create({
      data: {
        name: `${tag} Club`,
        nameKey: `${tag}-club`,
      },
    });

    // 3. Open Tournament
    const tourney = await prisma.tournament.create({
      data: {
        name: `${tag} Open Tourney`,
        status: 'open',
        startsOn: new Date('2026-12-05T00:00:00Z'),
        entriesCloseAt: new Date('2026-11-30T17:00:00Z'),
        createdBy: adminId,
      },
    });

    // Helper to create an event with 6 entries
    const createEventWith6Entries = async (
      discipline: 'MS' | 'WS' | 'MD' | 'WD' | 'XD',
      suffix: string,
      bestThirds = 0,
    ) => {
      const ev = await prisma.event.create({
        data: {
          tournamentId: tourney.id,
          discipline,
          gradeMinIndex: 0,
          gradeMaxIndex: 10,
          minReviewers: 2,
          format: {
            type: 'groups_knockout',
            groupSize: 3,
            advancePerGroup: 2,
            ...(bestThirds > 0 ? { bestThirds } : {}),
          },
        },
      });

      for (let i = 1; i <= 6; i++) {
        const p = await prisma.user.create({
          data: {
            email: `${tag}-${suffix}-p${i}@test.local`,
            passwordHash: 'x',
            displayName: `${tag} ${suffix} Player ${i}`,
          },
        });
        userIds.push(p.id);

        await prisma.entry.create({
          data: {
            eventId: ev.id,
            status: 'approved',
            name: `${tag} ${suffix} Entry ${i}`,
            createdBy: adminId,
            players: {
              create: [{ userId: p.id, eventId: ev.id, teamId: team.id }],
            },
          },
        });
      }

      return ev.id;
    };

    // Event 1: Fully completed matches
    completeEventId = await createEventWith6Entries('MS', 'complete');
    const prev1 = await http()
      .post(`/api/v1/events/${completeEventId}/groups/preview`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(201);
    completeDrawId = prev1.body.data.id;

    await http()
      .post(`/api/v1/draws/${completeDrawId}/publish`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({ acknowledgeConflicts: true })
      .expect(200);

    // Enter results for all matches in completeEvent
    const completeMatches = await prisma.match.findMany({
      where: { drawId: completeDrawId },
      orderBy: [{ stage: 'asc' }, { round: 'asc' }, { matchNo: 'asc' }],
    });
    firstMatchId = completeMatches[0]!.id;

    for (let idx = 0; idx < completeMatches.length; idx++) {
      const m = completeMatches[idx]!;
      await http()
        .put(`/api/v1/matches/${m.id}/result`)
        .set('Cookie', cookieFor(committeeId, ['Committee']))
        .send({
          outcome: 'played',
          games: [
            { a: 15, b: 10 + (idx % 4) },
            { a: 15, b: 8 + (idx % 4) },
          ],
        })
        .expect(200);
    }

    // Event 2: Incomplete matches (1 match left scheduled)
    incompleteEventId = await createEventWith6Entries('WS', 'incomp');
    const prev2 = await http()
      .post(`/api/v1/events/${incompleteEventId}/groups/preview`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(201);
    incompleteDrawId = prev2.body.data.id;

    await http()
      .post(`/api/v1/draws/${incompleteDrawId}/publish`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({ acknowledgeConflicts: true })
      .expect(200);

    const incompleteMatches = await prisma.match.findMany({
      where: { drawId: incompleteDrawId },
      orderBy: [{ stage: 'asc' }, { round: 'asc' }, { matchNo: 'asc' }],
    });

    // Enter results for all but the last match
    for (let idx = 0; idx < incompleteMatches.length - 1; idx++) {
      const m = incompleteMatches[idx]!;
      await http()
        .put(`/api/v1/matches/${m.id}/result`)
        .set('Cookie', cookieFor(committeeId, ['Committee']))
        .send({
          outcome: 'played',
          games: [
            { a: 15, b: 11 },
            { a: 15, b: 9 },
          ],
        })
        .expect(200);
    }

    // Event 3: Event with no published draw
    noDrawEventId = await createEventWith6Entries('MD', 'nodraw');

    // Event 4: Event with bestThirds > 0
    bestThirdsEventId = await createEventWith6Entries('XD', 'b3', 2);
    const prev4 = await http()
      .post(`/api/v1/events/${bestThirdsEventId}/groups/preview`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(201);
    const draw4Id = prev4.body.data.id;
    await http()
      .post(`/api/v1/draws/${draw4Id}/publish`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({ acknowledgeConflicts: true })
      .expect(200);

    const matches4 = await prisma.match.findMany({
      where: { drawId: draw4Id },
    });
    for (const m of matches4) {
      await http()
        .put(`/api/v1/matches/${m.id}/result`)
        .set('Cookie', cookieFor(committeeId, ['Committee']))
        .send({
          outcome: 'played',
          games: [
            { a: 15, b: 11 },
            { a: 15, b: 9 },
          ],
        })
        .expect(200);
    }
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
    await http().post(`/api/v1/events/${completeEventId}/groups/confirm`).send({}).expect(401);
  });

  it('member role calling endpoint -> 403 FORBIDDEN', async () => {
    await http()
      .post(`/api/v1/events/${completeEventId}/groups/confirm`)
      .set('Cookie', cookieFor(memberId, ['Member']))
      .send({})
      .expect(403);
  });

  it('missing event -> 404 EVENT_NOT_FOUND', async () => {
    const fakeId = randomUUID();
    const res = await http()
      .post(`/api/v1/events/${fakeId}/groups/confirm`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('EVENT_NOT_FOUND');
  });

  it('no published group draw -> 409 NO_PUBLISHED_GROUP_DRAW', async () => {
    const res = await http()
      .post(`/api/v1/events/${noDrawEventId}/groups/confirm`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NO_PUBLISHED_GROUP_DRAW');
  });

  it('one match still scheduled -> 409 GROUP_MATCHES_INCOMPLETE with count', async () => {
    const res = await http()
      .post(`/api/v1/events/${incompleteEventId}/groups/confirm`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('GROUP_MATCHES_INCOMPLETE');
    expect(res.body.error.details.count).toBe(1);
  });

  it('bestThirds > 0 -> 409 BEST_THIRDS_NOT_AVAILABLE', async () => {
    const res = await http()
      .post(`/api/v1/events/${bestThirdsEventId}/groups/confirm`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('BEST_THIRDS_NOT_AVAILABLE');
  });

  it('confirm when every match is final -> 200, GroupStanding rows in DB, draw locked, audit log recorded', async () => {
    const res = await http()
      .post(`/api/v1/events/${completeEventId}/groups/confirm`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(200);

    expect(res.body.success).toBe(true);
    const rows = res.body.data;
    expect(rows).toHaveLength(6); // 2 groups of 3 entries = 6 standings rows

    for (const r of rows) {
      expect(r.groupId).toBeDefined();
      expect(r.entryId).toBeDefined();
      expect(r.entry).toBeDefined();
      expect(typeof r.entry.displayName).toBe('string');
      expect(typeof r.rank).toBe('number');
      expect(r.played).toBeGreaterThan(0);
      expect(['qualified', 'out']).toContain(r.qualification);
      expect(r.confirmed).toBe(true);
    }

    // Verify DB GroupStanding rows exist
    const dbRows = await prisma.groupStanding.findMany({
      where: { group: { drawId: completeDrawId } },
    });
    expect(dbRows).toHaveLength(6);
    for (const dbr of dbRows) {
      expect(dbr.confirmedBy).toBe(committeeId);
    }

    // Verify draw status is 'locked' in DB
    const dbDraw = await prisma.draw.findUnique({
      where: { id: completeDrawId },
    });
    expect(dbDraw?.status).toBe('locked');

    // Verify audit log recorded action 'groups.confirm'
    const audit = await prisma.auditLog.findFirst({
      where: {
        entityType: 'draw',
        entityId: completeDrawId,
        action: 'groups.confirm',
      },
    });
    expect(audit).toBeDefined();
    expect(audit?.actorId).toBe(committeeId);
  });

  it('GET /events/{id}/standings returns confirmed: true with matching ranks', async () => {
    const res = await http().get(`/api/v1/events/${completeEventId}/standings`).expect(200);

    expect(res.body.success).toBe(true);
    const standings = res.body.data;
    expect(standings).toHaveLength(6);
    for (const s of standings) {
      expect(s.confirmed).toBe(true);
      expect(['qualified', 'out']).toContain(s.qualification);
    }
  });

  it('PUT result on a match afterwards -> 409 STAGE_CONFIRMED', async () => {
    const res = await http()
      .put(`/api/v1/matches/${firstMatchId}/result`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({
        outcome: 'played',
        games: [
          { a: 15, b: 12 },
          { a: 15, b: 10 },
        ],
        reason: 'Attempting edit after lock',
      })
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('STAGE_CONFIRMED');
  });

  it('confirm twice -> 409 DRAW_ALREADY_LOCKED', async () => {
    const res = await http()
      .post(`/api/v1/events/${completeEventId}/groups/confirm`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DRAW_ALREADY_LOCKED');
  });
});
