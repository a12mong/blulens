import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('GET /events/{eventId}/bracket (bl-33-3)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const tag = `ko-br-${Date.now().toString(36)}`;
  const userIds: string[] = [];
  let committeeId: string;
  let committeeCookie: string;
  let tourneyId: string;

  const http = () => request(app.getHttpServer());
  const cookieFor = (id: string, roles: string[]) =>
    `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;
  const bracket = (eventId: string) => http().get(`/api/v1/events/${eventId}/bracket`);
  const topWins = [
    { a: 21, b: 10 },
    { a: 21, b: 12 },
  ];

  /** groups_knockout event with 6 entries (2 groups of 3) and a published group draw. */
  const setupEvent = async (discipline: 'MS' | 'WS' | 'MD', overrides: Record<string, unknown> = {}) => {
    const ev = await prisma.event.create({
      data: {
        tournamentId: tourneyId,
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
          knockoutMatchFormat: { preset: 'bo3_21', mode: 'best_of', games: 3, pointsPerGame: 21, deuce: true, cap: 30 },
          ...overrides,
        },
      },
    });
    for (let i = 1; i <= 6; i++) {
      const u = await prisma.user.create({
        data: {
          email: `${tag}-${discipline}-p${i}@test.local`,
          passwordHash: 'x',
          displayName: `${tag} ${discipline} Player ${i}`,
          roles: { create: [{ role: 'Member' }] },
        },
      });
      userIds.push(u.id);
      await prisma.entry.create({
        data: {
          eventId: ev.id,
          status: 'approved',
          name: `${tag} ${discipline} Pair ${i}`,
          createdBy: committeeId,
          players: { create: [{ userId: u.id, eventId: ev.id }] },
        },
      });
    }
    const gPrev = await http()
      .post(`/api/v1/events/${ev.id}/groups/preview`)
      .set('Cookie', committeeCookie)
      .send({})
      .expect(201);
    await http()
      .post(`/api/v1/draws/${gPrev.body.data.id}/publish`)
      .set('Cookie', committeeCookie)
      .send({ acknowledgeConflicts: true })
      .expect(200);
    return { eventId: ev.id, groupDrawId: gPrev.body.data.id as string };
  };

  /** Plays every group match, confirms the groups, previews and publishes the knockout draw. */
  const publishKnockout = async (eventId: string, groupDrawId: string) => {
    const groupMatches = await prisma.match.findMany({ where: { drawId: groupDrawId } });
    for (const [idx, m] of groupMatches.entries()) {
      await http()
        .put(`/api/v1/matches/${m.id}/result`)
        .set('Cookie', committeeCookie)
        .send({
          outcome: 'played',
          games: [
            { a: 15, b: 10 + (idx % 3) },
            { a: 15, b: 8 + (idx % 3) },
          ],
        })
        .expect(200);
    }
    await http().post(`/api/v1/events/${eventId}/groups/confirm`).set('Cookie', committeeCookie).expect(200);
    const kPrev = await http()
      .post(`/api/v1/events/${eventId}/knockout/preview`)
      .set('Cookie', committeeCookie)
      .send({})
      .expect(201);
    await http()
      .post(`/api/v1/draws/${kPrev.body.data.id}/publish`)
      .set('Cookie', committeeCookie)
      .send({})
      .expect(200);
    return kPrev.body.data.id as string;
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);

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
    committeeCookie = cookieFor(committeeId, ['Committee']);

    const tourney = await prisma.tournament.create({
      data: {
        name: `${tag} Tourney`,
        status: 'open',
        startsOn: new Date('2026-12-05T00:00:00Z'),
        entriesCloseAt: new Date('2026-11-30T17:00:00Z'),
        createdBy: committeeId,
      },
    });
    tourneyId = tourney.id;
  });

  afterAll(async () => {
    await prisma.user.updateMany({ where: { id: { in: userIds } }, data: { status: 'disabled' } });
    await app.close();
  });

  describe('groups_knockout Q = 4 (2 groups x 2)', () => {
    let eventId: string;
    let groupDrawId: string;
    let knockoutDrawId: string;

    beforeAll(async () => {
      ({ eventId, groupDrawId } = await setupEvent('MS'));
    });

    it('before the knockout draw -> provisional size 4 with group placeholders only (Guest)', async () => {
      const res = await bracket(eventId).expect(200);
      const b = res.body.data;
      expect(b).toMatchObject({ eventId, drawId: null, drawVersion: null, drawStatus: null, provisional: true, size: 4 });
      expect(b.thirdPlace).toBeNull();
      expect(b.champion).toBeNull();
      expect(b.rounds.map((r: { nameTh: string }) => r.nameTh)).toEqual(['รองชนะเลิศ', 'ชิงชนะเลิศ']);

      const [m1, m2] = b.rounds[0].matches;
      expect(m1).toMatchObject({
        matchId: null,
        matchNo: 1,
        top: null,
        topEntry: null,
        topPlaceholder: 'แชมป์กลุ่ม A',
        bottomPlaceholder: 'รองแชมป์กลุ่ม B',
        nextMatchNo: 3,
        nextSide: 'top',
      });
      expect(m2).toMatchObject({
        matchNo: 2,
        topPlaceholder: 'แชมป์กลุ่ม B',
        bottomPlaceholder: 'รองแชมป์กลุ่ม A',
        nextMatchNo: 3,
        nextSide: 'bottom',
      });
      expect(b.rounds[1].matches[0]).toMatchObject({
        matchId: null,
        matchNo: 3,
        topPlaceholder: 'ผู้ชนะคู่ที่ 1',
        bottomPlaceholder: 'ผู้ชนะคู่ที่ 2',
        nextMatchNo: null,
        nextSide: null,
      });
    });

    it('published knockout -> semis with entries + seedNos, final and third place placeholders', async () => {
      knockoutDrawId = await publishKnockout(eventId, groupDrawId);
      const b = (await bracket(eventId).expect(200)).body.data;
      const draw = await prisma.draw.findUniqueOrThrow({ where: { id: knockoutDrawId }, include: { slots: true } });
      const seedAt = (p: number) => draw.slots.find((s) => s.position === p)?.seedNo ?? null;

      expect(b).toMatchObject({ drawId: knockoutDrawId, drawVersion: draw.version, drawStatus: 'published', provisional: false, size: 4 });
      expect(b.rounds.map((r: { nameTh: string }) => r.nameTh)).toEqual(['รองชนะเลิศ', 'ชิงชนะเลิศ']);

      const [s1, s2] = b.rounds[0].matches;
      expect(s1.matchId).toEqual(expect.any(String));
      expect(s1.topEntry.entryId).toBe(s1.top);
      expect(s1.bottomEntry.entryId).toBe(s1.bottom);
      expect([s1.topSeedNo, s1.bottomSeedNo, s2.topSeedNo, s2.bottomSeedNo]).toEqual([
        seedAt(1),
        seedAt(2),
        seedAt(3),
        seedAt(4),
      ]);
      expect(s1.topSeedNo).toEqual(expect.any(Number));
      expect(s1).toMatchObject({ matchNo: 1, nextMatchNo: 3, nextSide: 'top', topPlaceholder: null, winner: null });
      expect(s2).toMatchObject({ matchNo: 2, nextMatchNo: 3, nextSide: 'bottom' });

      expect(b.rounds[1].matches[0]).toMatchObject({
        matchNo: 3,
        top: null,
        topPlaceholder: 'ผู้ชนะคู่ที่ 1',
        bottomPlaceholder: 'ผู้ชนะคู่ที่ 2',
        topSeedNo: null,
        nextMatchNo: null,
        nextSide: null,
      });
      expect(b.thirdPlace).toMatchObject({
        matchNo: 4,
        topPlaceholder: 'ผู้แพ้คู่ที่ 1',
        bottomPlaceholder: 'ผู้แพ้คู่ที่ 2',
        nextMatchNo: null,
        nextSide: null,
      });
      expect(b.champion).toBeNull();
    });

    it('semis and final confirmed -> winners, games, final filled, champion = final winner', async () => {
      const before = (await bracket(eventId).expect(200)).body.data;
      const [s1, s2] = before.rounds[0].matches;
      for (const m of [s1, s2]) {
        await http()
          .put(`/api/v1/matches/${m.matchId}/result`)
          .set('Cookie', committeeCookie)
          .send({ outcome: 'played', games: topWins })
          .expect(200);
      }
      const finalId = before.rounds[1].matches[0].matchId;
      await http()
        .put(`/api/v1/matches/${finalId}/result`)
        .set('Cookie', committeeCookie)
        .send({ outcome: 'played', games: topWins })
        .expect(200);

      const b = (await bracket(eventId).expect(200)).body.data;
      expect(b.rounds[0].matches[0]).toMatchObject({ status: 'confirmed', winner: s1.top, games: topWins });
      expect(b.rounds[1].matches[0]).toMatchObject({
        top: s1.top,
        bottom: s2.top,
        topPlaceholder: null,
        winner: s1.top,
      });
      expect(b.thirdPlace).toMatchObject({ top: s1.bottom, bottom: s2.bottom, topPlaceholder: null });
      expect(b.champion.entryId).toBe(s1.top);
    });
  });

  it('Q = 3 published knockout -> round 1 bye has winner set and placeholder บาย', async () => {
    const { eventId, groupDrawId } = await setupEvent('MD', { advancePerGroup: 1, bestThirds: 1 });
    await publishKnockout(eventId, groupDrawId);

    const b = (await bracket(eventId).expect(200)).body.data;
    expect(b.size).toBe(4);
    const bye = b.rounds[0].matches.find((m: { status: string }) => m.status === 'bye');
    expect(bye).toBeDefined();
    const byeEntry = bye.top ?? bye.bottom;
    expect(byeEntry).toEqual(expect.any(String));
    expect(bye.winner).toBe(byeEntry);
    expect(bye.top === null ? bye.topPlaceholder : bye.bottomPlaceholder).toBe('บาย');

    const final = b.rounds[1].matches[0];
    expect([final.top, final.bottom]).toContain(byeEntry);
  });

  it('knockout event without a published draw -> 404 BRACKET_NOT_PUBLISHED', async () => {
    const ev = await prisma.event.create({
      data: {
        tournamentId: tourneyId,
        discipline: 'XD',
        gradeMinIndex: 0,
        gradeMaxIndex: 10,
        minReviewers: 2,
        format: { type: 'knockout' },
      },
    });
    const res = await bracket(ev.id).expect(404);
    expect(res.body.error.code).toBe('BRACKET_NOT_PUBLISHED');
  });

  it('draft tournament as Guest -> 404 EVENT_NOT_FOUND; unknown event -> 404 EVENT_NOT_FOUND', async () => {
    const draft = await prisma.tournament.create({
      data: {
        name: `${tag} Draft`,
        status: 'draft',
        startsOn: new Date('2026-12-05T00:00:00Z'),
        entriesCloseAt: new Date('2026-11-30T17:00:00Z'),
        createdBy: committeeId,
      },
    });
    const ev = await prisma.event.create({
      data: { tournamentId: draft.id, discipline: 'WD', gradeMinIndex: 0, gradeMaxIndex: 10, minReviewers: 2 },
    });
    expect((await bracket(ev.id).expect(404)).body.error.code).toBe('EVENT_NOT_FOUND');
    expect((await bracket(randomUUID()).expect(404)).body.error.code).toBe('EVENT_NOT_FOUND');
  });
});
