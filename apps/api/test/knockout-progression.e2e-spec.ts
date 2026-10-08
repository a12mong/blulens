import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Match } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('knockout progression on confirmed results (bl-33-4)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const tag = `ko-prog-${Date.now().toString(36)}`;
  const userIds: string[] = [];

  let committeeCookie: string;
  let umpireCookie: string;
  let semi1: Match;
  let semi2: Match;
  let finalId: string;
  let thirdId: string;

  const http = () => request(app.getHttpServer());
  const cookieFor = (id: string, roles: string[]) =>
    `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;
  const topWins = [
    { a: 21, b: 10 },
    { a: 21, b: 12 },
  ];
  const bottomWins = [
    { a: 10, b: 21 },
    { a: 12, b: 21 },
  ];
  const load = (id: string) => prisma.match.findUniqueOrThrow({ where: { id } });

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
    userIds.push(committee.id);
    committeeCookie = cookieFor(committee.id, ['Committee']);

    const umpire = await prisma.user.create({
      data: {
        email: `${tag}-ump@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Umpire`,
        roles: { create: [{ role: 'Umpire' }] },
      },
    });
    userIds.push(umpire.id);
    umpireCookie = cookieFor(umpire.id, ['Umpire']);

    const tourney = await prisma.tournament.create({
      data: {
        name: `${tag} Tourney`,
        status: 'open',
        startsOn: new Date('2026-12-05T00:00:00Z'),
        entriesCloseAt: new Date('2026-11-30T17:00:00Z'),
        createdBy: committee.id,
      },
    });
    const ev = await prisma.event.create({
      data: {
        tournamentId: tourney.id,
        discipline: 'MS',
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
        },
      },
    });
    await prisma.eventUmpire.create({ data: { eventId: ev.id, userId: umpire.id, courts: [] } });

    for (let i = 1; i <= 6; i++) {
      const u = await prisma.user.create({
        data: {
          email: `${tag}-p${i}@test.local`,
          passwordHash: 'x',
          displayName: `${tag} Player ${i}`,
          roles: { create: [{ role: 'Member' }] },
        },
      });
      userIds.push(u.id);
      await prisma.entry.create({
        data: {
          eventId: ev.id,
          status: 'approved',
          name: `${tag} Pair ${i}`,
          createdBy: committee.id,
          players: { create: [{ userId: u.id, eventId: ev.id }] },
        },
      });
    }

    // Group stage: publish, play every match, confirm (Q = 2 groups x 2 = 4)
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
    const groupMatches = await prisma.match.findMany({ where: { drawId: gPrev.body.data.id } });
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
    await http().post(`/api/v1/events/${ev.id}/groups/confirm`).set('Cookie', committeeCookie).expect(200);

    const kPrev = await http()
      .post(`/api/v1/events/${ev.id}/knockout/preview`)
      .set('Cookie', committeeCookie)
      .send({})
      .expect(201);
    await http()
      .post(`/api/v1/draws/${kPrev.body.data.id}/publish`)
      .set('Cookie', committeeCookie)
      .send({})
      .expect(200);

    const ko = await prisma.match.findMany({
      where: { drawId: kPrev.body.data.id },
      orderBy: { matchNo: 'asc' },
    });
    [semi1, semi2] = ko as [Match, Match];
    finalId = ko.find((m) => m.stage === 'knockout' && m.round === 2)!.id;
    thirdId = ko.find((m) => m.stage === 'third_place')!.id;
  });

  afterAll(async () => {
    await prisma.user.updateMany({ where: { id: { in: userIds } }, data: { status: 'disabled' } });
    await app.close();
  });

  it('Committee enters semi 1 -> final top = winner, third place top = loser', async () => {
    await http()
      .put(`/api/v1/matches/${semi1.id}/result`)
      .set('Cookie', committeeCookie)
      .send({ outcome: 'played', games: topWins })
      .expect(200);

    const final = await load(finalId);
    const third = await load(thirdId);
    expect(final.topEntryId).toBe(semi1.topEntryId);
    expect(final.bottomEntryId).toBeNull();
    expect(third.topEntryId).toBe(semi1.bottomEntryId);
    expect(third.bottomEntryId).toBeNull();
  });

  it('semi 2 umpire report does not advance; Committee approve fills final bottom and third place bottom', async () => {
    await http()
      .put(`/api/v1/matches/${semi2.id}/result`)
      .set('Cookie', umpireCookie)
      .send({ outcome: 'played', games: bottomWins })
      .expect(200);
    expect((await load(semi2.id)).status).toBe('reported');
    expect((await load(finalId)).bottomEntryId).toBeNull();
    expect((await load(thirdId)).bottomEntryId).toBeNull();

    await http().post(`/api/v1/matches/${semi2.id}/result/approve`).set('Cookie', committeeCookie).expect(200);

    const final = await load(finalId);
    const third = await load(thirdId);
    expect(final.topEntryId).toBe(semi1.topEntryId);
    expect(final.bottomEntryId).toBe(semi2.bottomEntryId);
    expect(third.topEntryId).toBe(semi1.bottomEntryId);
    expect(third.bottomEntryId).toBe(semi2.topEntryId);
  });

  it('correction of semi 1 keeping the winner leaves the final and third place unchanged', async () => {
    await http()
      .put(`/api/v1/matches/${semi1.id}/result`)
      .set('Cookie', committeeCookie)
      .send({
        outcome: 'played',
        games: [
          { a: 21, b: 15 },
          { a: 21, b: 17 },
        ],
        reason: 'แก้คะแนน',
      })
      .expect(200);

    expect((await load(finalId)).topEntryId).toBe(semi1.topEntryId);
    expect((await load(thirdId)).topEntryId).toBe(semi1.bottomEntryId);
  });

  it('correction of semi 1 changing the winner while the final is scheduled -> final top and third place top swap', async () => {
    await http()
      .put(`/api/v1/matches/${semi1.id}/result`)
      .set('Cookie', committeeCookie)
      .send({ outcome: 'played', games: bottomWins, reason: 'กรรมการบันทึกผลผิดฝั่ง' })
      .expect(200);

    const final = await load(finalId);
    const third = await load(thirdId);
    expect(final.topEntryId).toBe(semi1.bottomEntryId);
    expect(final.bottomEntryId).toBe(semi2.bottomEntryId);
    expect(third.topEntryId).toBe(semi1.topEntryId);
    expect(third.bottomEntryId).toBe(semi2.topEntryId);
  });

  it('final confirmed -> final winner set; a winner-changing correction of semi 1 -> 409 NEXT_MATCH_ALREADY_PLAYED, nothing changes', async () => {
    await http()
      .put(`/api/v1/matches/${finalId}/result`)
      .set('Cookie', committeeCookie)
      .send({ outcome: 'played', games: topWins })
      .expect(200);
    expect((await load(finalId)).winnerEntryId).toBe(semi1.bottomEntryId);

    const res = await http()
      .put(`/api/v1/matches/${semi1.id}/result`)
      .set('Cookie', committeeCookie)
      .send({ outcome: 'played', games: topWins, reason: 'ขอแก้อีกครั้ง' })
      .expect(409);
    expect(res.body.error.code).toBe('NEXT_MATCH_ALREADY_PLAYED');

    const s1 = await load(semi1.id);
    expect(s1.winnerEntryId).toBe(semi1.bottomEntryId);
    expect((await load(finalId)).topEntryId).toBe(semi1.bottomEntryId);
    expect((await load(thirdId)).topEntryId).toBe(semi1.topEntryId);
  });
});
