import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { nextSlot } from '../src/modules/draws/bracket';

describe('nextSlot unit tests', () => {
  it('round 1, match 0 -> round 2, match 0, top', () => {
    expect(nextSlot(1, 0)).toEqual({ round: 2, index: 0, side: 'top' });
  });

  it('round 1, match 1 -> round 2, match 0, bottom', () => {
    expect(nextSlot(1, 1)).toEqual({ round: 2, index: 0, side: 'bottom' });
  });

  it('round 1, match 2 -> round 2, match 1, top', () => {
    expect(nextSlot(1, 2)).toEqual({ round: 2, index: 1, side: 'top' });
  });

  it('round 1, match 3 -> round 2, match 1, bottom', () => {
    expect(nextSlot(1, 3)).toEqual({ round: 2, index: 1, side: 'bottom' });
  });

  it('round 2, match 0 -> round 3, match 0, top', () => {
    expect(nextSlot(2, 0)).toEqual({ round: 3, index: 0, side: 'top' });
  });

  it('round 2, match 1 -> round 3, match 0, bottom', () => {
    expect(nextSlot(2, 1)).toEqual({ round: 3, index: 0, side: 'bottom' });
  });

  it('round 3, match 4 -> round 4, match 2, top', () => {
    expect(nextSlot(3, 4)).toEqual({ round: 4, index: 2, side: 'top' });
  });

  it('round 3, match 5 -> round 4, match 2, bottom', () => {
    expect(nextSlot(3, 5)).toEqual({ round: 4, index: 2, side: 'bottom' });
  });
});

describe('POST /api/v1/draws/:drawId/publish for knockout (bl-33-2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const tag = `ko-pub-${Date.now().toString(36)}`;
  const userIds: string[] = [];
  const entryIds: string[] = [];

  let adminId: string;
  let committeeId: string;
  let memberId: string;

  let tourneyId: string;
  let eventId: string;
  let groupDrawId: string;

  let q3EventId: string;
  let q3GroupDrawId: string;

  let noThirdPlaceEventId: string;
  let noThirdPlaceGroupDrawId: string;

  const http = () => request(app.getHttpServer());

  const cookieFor = (id: string, roles: string[]) =>
    `bl_access=${signJwt(
      { sub: id, roles },
      process.env.JWT_ACCESS_SECRET ?? 'blulens-jwt-secret-for-development-change-in-production',
      900,
      Math.floor(Date.now() / 1000),
    )}`;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();

    prisma = app.get(PrismaService);

    // 1. Users
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

    // 2. Tournament
    const tourney = await prisma.tournament.create({
      data: {
        name: `${tag} Open Tourney`,
        status: 'open',
        startsOn: new Date('2026-12-05T00:00:00Z'),
        entriesCloseAt: new Date('2026-11-30T17:00:00Z'),
        createdBy: adminId,
      },
    });
    tourneyId = tourney.id;

    // Helper to set up an event with 6 entries in 2 groups of 3 and completed matches
    const setupEventWithGroups = async (
      discipline: 'MS' | 'WS' | 'MD' | 'WD' | 'XD',
      formatOverrides: Record<string, unknown> = {},
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
            thirdPlacePlayoff: true,
            points: { win: 3, draw: 1, loss: 0 },
            groupMatchFormat: {
              preset: 'group_2x15',
              mode: 'fixed_games',
              games: 2,
              pointsPerGame: 15,
              deuce: false,
              drawAllowed: true,
            },
            knockoutMatchFormat: {
              preset: 'bo3_21',
              mode: 'best_of',
              games: 3,
              pointsPerGame: 21,
              deuce: true,
              cap: 30,
            },
            ...formatOverrides,
          },
        },
      });

      // 6 entries
      for (let i = 1; i <= 6; i++) {
        const u = await prisma.user.create({
          data: {
            email: `${tag}-${discipline}-p${i}@test.local`,
            passwordHash: 'x',
            displayName: `${discipline} Player ${i}`,
            roles: { create: [{ role: 'Member' }] },
          },
        });
        userIds.push(u.id);

        const entry = await prisma.entry.create({
          data: {
            eventId: ev.id,
            status: 'approved',
            name: `${discipline} Pair ${i}`,
            createdBy: adminId,
            players: { create: [{ userId: u.id, eventId: ev.id }] },
          },
        });
        entryIds.push(entry.id);
      }

      // Preview & publish groups
      const gPrev = await http()
        .post(`/api/v1/events/${ev.id}/groups/preview`)
        .set('Cookie', cookieFor(committeeId, ['Committee']))
        .send({})
        .expect(201);

      const gPub = await http()
        .post(`/api/v1/draws/${gPrev.body.data.id}/publish`)
        .set('Cookie', cookieFor(committeeId, ['Committee']))
        .send({ acknowledgeConflicts: true })
        .expect(200);

      const drawId = gPub.body.data.id;

      // Complete all group matches
      const matches = await prisma.match.findMany({
        where: { drawId },
        orderBy: [{ stage: 'asc' }, { round: 'asc' }, { matchNo: 'asc' }],
      });

      for (let idx = 0; idx < matches.length; idx++) {
        const m = matches[idx]!;
        await http()
          .put(`/api/v1/matches/${m.id}/result`)
          .set('Cookie', cookieFor(committeeId, ['Committee']))
          .send({
            outcome: 'played',
            games: [
              { a: 15, b: 10 + (idx % 3) },
              { a: 15, b: 8 + (idx % 3) },
            ],
          })
          .expect(200);
      }

      return { eventId: ev.id, drawId };
    };

    // 1. Standard Q = 4 event
    const standard = await setupEventWithGroups('MS');
    eventId = standard.eventId;
    groupDrawId = standard.drawId;

    // Confirm groups for standard
    await http()
      .post(`/api/v1/events/${eventId}/groups/confirm`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .expect(200);

    // 2. thirdPlacePlayoff = false event
    const noThird = await setupEventWithGroups('WS', { thirdPlacePlayoff: false });
    noThirdPlaceEventId = noThird.eventId;
    noThirdPlaceGroupDrawId = noThird.drawId;

    await http()
      .post(`/api/v1/events/${noThirdPlaceEventId}/groups/confirm`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .expect(200);

    // 3. Q = 3 event (advancePerGroup: 1, bestThirds: 1 naturally yields 3 qualifiers)
    const q3 = await setupEventWithGroups('MD', { advancePerGroup: 1, bestThirds: 1 });
    q3EventId = q3.eventId;
    q3GroupDrawId = q3.drawId;

    await http()
      .post(`/api/v1/events/${q3EventId}/groups/confirm`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .expect(200);
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
    await http().post('/api/v1/draws/00000000-0000-0000-0000-000000000000/publish').expect(401);
  });

  it('Member caller -> 403 FORBIDDEN', async () => {
    await http()
      .post('/api/v1/draws/00000000-0000-0000-0000-000000000000/publish')
      .set('Cookie', cookieFor(memberId, ['Member']))
      .send({})
      .expect(403);
  });

  it('fixture Q = 4: publish -> 4 matches (2 semis with entries, final empty, third place empty)', async () => {
    // 1. Create preview
    const prevRes = await http()
      .post(`/api/v1/events/${eventId}/knockout/preview`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(201);

    const drawId = prevRes.body.data.id;
    expect(prevRes.body.data.size).toBe(4);

    // 2. Publish knockout draw
    const pubRes = await http()
      .post(`/api/v1/draws/${drawId}/publish`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({ reason: 'Official knockout publishing' })
      .expect(200);

    expect(pubRes.body.success).toBe(true);
    expect(pubRes.body.data.id).toBe(drawId);
    expect(pubRes.body.data.status).toBe('published');
    expect(pubRes.body.data.kind).toBe('knockout');
    expect(pubRes.body.data.size).toBe(4);

    // 3. Verify matches created
    // GET /events/{id}/matches?stage=knockout lists 3
    const koMatchesRes = await http()
      .get(`/api/v1/events/${eventId}/matches?stage=knockout`)
      .expect(200);
    expect(koMatchesRes.body.data).toHaveLength(3);

    // GET /events/{id}/matches?stage=third_place lists 1
    const tpMatchesRes = await http()
      .get(`/api/v1/events/${eventId}/matches?stage=third_place`)
      .expect(200);
    expect(tpMatchesRes.body.data).toHaveLength(1);

    // Total 4 matches for this draw
    const allMatches = await prisma.match.findMany({
      where: { drawId },
      orderBy: [{ stage: 'asc' }, { round: 'asc' }, { matchNo: 'asc' }],
    });
    expect(allMatches).toHaveLength(4);

    // Check matchNo 1 & 2: round 1 semifinals
    const semi1 = allMatches.find((m) => m.matchNo === 1)!;
    const semi2 = allMatches.find((m) => m.matchNo === 2)!;
    expect(semi1.stage).toBe('knockout');
    expect(semi1.round).toBe(1);
    expect(semi1.status).toBe('scheduled');
    expect(semi1.topEntryId).not.toBeNull();
    expect(semi1.bottomEntryId).not.toBeNull();
    expect(semi1.winnerEntryId).toBeNull();
    expect(semi1.court).toBeNull();
    expect(semi1.umpireId).toBeNull();

    expect(semi2.stage).toBe('knockout');
    expect(semi2.round).toBe(1);
    expect(semi2.status).toBe('scheduled');
    expect(semi2.topEntryId).not.toBeNull();
    expect(semi2.bottomEntryId).not.toBeNull();
    expect(semi2.winnerEntryId).toBeNull();
    expect(semi2.court).toBeNull();
    expect(semi2.umpireId).toBeNull();

    // Check matchNo 3: round 2 final
    const finalMatch = allMatches.find((m) => m.matchNo === 3)!;
    expect(finalMatch.stage).toBe('knockout');
    expect(finalMatch.round).toBe(2);
    expect(finalMatch.status).toBe('scheduled');
    expect(finalMatch.topEntryId).toBeNull();
    expect(finalMatch.bottomEntryId).toBeNull();
    expect(finalMatch.winnerEntryId).toBeNull();

    // Check matchNo 4: stage third_place
    const thirdPlaceMatch = allMatches.find((m) => m.matchNo === 4)!;
    expect(thirdPlaceMatch.stage).toBe('third_place');
    expect(thirdPlaceMatch.round).toBe(2);
    expect(thirdPlaceMatch.status).toBe('scheduled');
    expect(thirdPlaceMatch.topEntryId).toBeNull();
    expect(thirdPlaceMatch.bottomEntryId).toBeNull();
    expect(thirdPlaceMatch.winnerEntryId).toBeNull();

    // Verify audit log
    const audit = await prisma.auditLog.findFirst({
      where: {
        entityType: 'draw',
        entityId: drawId,
        action: 'draw.publish',
      },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorId).toBe(committeeId);
    expect(audit?.reason).toBe('Official knockout publishing');
  });

  it('publish twice -> 409 DRAW_ALREADY_LOCKED', async () => {
    // Find published draw for eventId
    const published = await prisma.draw.findFirst({
      where: { eventId, kind: 'knockout', status: 'published' },
    });
    expect(published).not.toBeNull();

    const res = await http()
      .post(`/api/v1/draws/${published!.id}/publish`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DRAW_ALREADY_LOCKED');
  });

  it('source group draw not locked -> 409 DRAW_INPUT_CHANGED', async () => {
    // Create preview for noThirdPlaceEventId
    const prevRes = await http()
      .post(`/api/v1/events/${noThirdPlaceEventId}/knockout/preview`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(201);

    const drawId = prevRes.body.data.id;

    // Temporarily set source group draw to 'published' (not locked)
    await prisma.draw.update({
      where: { id: noThirdPlaceGroupDrawId },
      data: { status: 'published' },
    });

    try {
      const res = await http()
        .post(`/api/v1/draws/${drawId}/publish`)
        .set('Cookie', cookieFor(committeeId, ['Committee']))
        .send({})
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('DRAW_INPUT_CHANGED');
    } finally {
      // Restore source group draw to locked
      await prisma.draw.update({
        where: { id: noThirdPlaceGroupDrawId },
        data: { status: 'locked' },
      });
    }
  });

  it('thirdPlacePlayoff: false -> no third_place match created', async () => {
    // Create preview for noThirdPlaceEventId
    const prevRes = await http()
      .post(`/api/v1/events/${noThirdPlaceEventId}/knockout/preview`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({ reason: 'Preview for no third place' })
      .expect(201);

    const drawId = prevRes.body.data.id;

    const pubRes = await http()
      .post(`/api/v1/draws/${drawId}/publish`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(200);

    expect(pubRes.body.success).toBe(true);

    // Stage knockout has 3 matches
    const koMatches = await http()
      .get(`/api/v1/events/${noThirdPlaceEventId}/matches?stage=knockout`)
      .expect(200);
    expect(koMatches.body.data).toHaveLength(3);

    // Stage third_place has 0 matches
    const tpMatches = await http()
      .get(`/api/v1/events/${noThirdPlaceEventId}/matches?stage=third_place`)
      .expect(200);
    expect(tpMatches.body.data).toHaveLength(0);

    // In DB, exactly 3 matches created for this draw
    const matches = await prisma.match.findMany({
      where: { drawId },
    });
    expect(matches).toHaveLength(3);
  });

  it('conflicts without acknowledgeConflicts -> 409 DRAW_CONFLICTS_NOT_ACKNOWLEDGED, succeeds with acknowledgeConflicts', async () => {
    // Create preview for q3EventId
    const prevRes = await http()
      .post(`/api/v1/events/${q3EventId}/knockout/preview`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(201);

    const drawId = prevRes.body.data.id;

    // Inject a conflict artificially on this preview draw
    await prisma.draw.update({
      where: { id: drawId },
      data: {
        sameTeamR1Count: 1,
        conflicts: [
          {
            matchNo: 1,
            kind: 'team',
            teamId: '00000000-0000-0000-0000-000000000001',
            groupLabel: null,
          },
        ],
      },
    });

    // 1. Publish without acknowledgeConflicts -> 409
    const failRes = await http()
      .post(`/api/v1/draws/${drawId}/publish`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(409);

    expect(failRes.body.success).toBe(false);
    expect(failRes.body.error.code).toBe('DRAW_CONFLICTS_NOT_ACKNOWLEDGED');

    // 2. Publish with acknowledgeConflicts: true -> 200
    const okRes = await http()
      .post(`/api/v1/draws/${drawId}/publish`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({ acknowledgeConflicts: true })
      .expect(200);

    expect(okRes.body.success).toBe(true);

    const dbDraw = await prisma.draw.findUnique({
      where: { id: drawId },
    });
    expect(dbDraw?.conflictsAcknowledgedBy).toBe(committeeId);
    expect(dbDraw?.conflictsAcknowledgedAt).not.toBeNull();
  });

  it('Q = 3 case (size 4, one bye): R1 has one bye match whose entry already sits in the final', async () => {
    // q3EventId draw is already published in previous test, let's verify its matches
    const publishedQ3Draw = await prisma.draw.findFirst({
      where: { eventId: q3EventId, kind: 'knockout', status: 'published' },
    });
    expect(publishedQ3Draw).not.toBeNull();
    const drawId = publishedQ3Draw!.id;

    const matches = await prisma.match.findMany({
      where: { drawId, stage: 'knockout' },
      orderBy: [{ round: 'asc' }, { matchNo: 'asc' }],
    });

    expect(matches).toHaveLength(3); // 2 R1 matches + 1 final

    // Find the bye match in R1
    const byeMatch = matches.find((m) => m.round === 1 && m.status === 'bye');
    const scheduledMatch = matches.find((m) => m.round === 1 && m.status === 'scheduled');
    const finalMatch = matches.find((m) => m.round === 2)!;

    expect(byeMatch).toBeDefined();
    expect(scheduledMatch).toBeDefined();
    expect(finalMatch).toBeDefined();

    // Bye match has exactly one entry present and winnerEntryId set
    const advancedWinnerId = byeMatch!.winnerEntryId;
    expect(advancedWinnerId).not.toBeNull();
    expect(
      (byeMatch!.topEntryId === null && byeMatch!.bottomEntryId === advancedWinnerId) ||
        (byeMatch!.bottomEntryId === null && byeMatch!.topEntryId === advancedWinnerId),
    ).toBe(true);

    // That winnerEntryId already sits in the final match!
    expect([finalMatch.topEntryId, finalMatch.bottomEntryId]).toContain(advancedWinnerId);
  });
});
