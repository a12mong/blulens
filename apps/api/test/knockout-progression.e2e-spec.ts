import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-ko-${randomUUID().slice(0, 6)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

describe('knockout-progression (bl-33-4)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  let committeeId: string;
  let umpireId: string;
  let eventId: string;
  let drawId: string;
  let semi1Id: string;
  let semi2Id: string;
  let finalId: string;
  let thirdPlaceId: string;
  let entry1Id: string;
  let entry2Id: string;
  let entry3Id: string;
  let entry4Id: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();

    // Create users
    const committee = await prisma.user.create({
      data: { email: `${tag}-comm@test.local`, passwordHash: 'x', displayName: `${tag} Committee` },
    });
    committeeId = committee.id;

    const umpire = await prisma.user.create({
      data: { email: `${tag}-ump@test.local`, passwordHash: 'x', displayName: `${tag} Umpire` },
    });
    umpireId = umpire.id;

    // Create tournament and event
    const tournament = await prisma.tournament.create({
      data: {
        name: `${tag} Tournament`,
        status: 'open',
        startsOn: new Date('2026-12-01T00:00:00Z'),
        entriesCloseAt: new Date('2026-11-20T17:00:00Z'),
        createdBy: committeeId,
      },
    });

    const event = await prisma.event.create({
      data: {
        tournamentId: tournament.id,
        discipline: 'MS',
        gradeMinIndex: 6,
        gradeMaxIndex: 10,
        minReviewers: 2,
        format: { Q: 4 },
      },
    });
    eventId = event.id;

    // Create entries
    const e1 = await prisma.entry.create({
      data: {
        eventId,
        status: 'approved',
        name: `${tag} Entry 1`,
        createdBy: committeeId,
      },
    });
    entry1Id = e1.id;

    const e2 = await prisma.entry.create({
      data: {
        eventId,
        status: 'approved',
        name: `${tag} Entry 2`,
        createdBy: committeeId,
      },
    });
    entry2Id = e2.id;

    const e3 = await prisma.entry.create({
      data: {
        eventId,
        status: 'approved',
        name: `${tag} Entry 3`,
        createdBy: committeeId,
      },
    });
    entry3Id = e3.id;

    const e4 = await prisma.entry.create({
      data: {
        eventId,
        status: 'approved',
        name: `${tag} Entry 4`,
        createdBy: committeeId,
      },
    });
    entry4Id = e4.id;

    // Create draw
    const draw = await prisma.draw.create({
      data: {
        eventId,
        kind: 'knockout',
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
        createdBy: committeeId,
      },
    });
    drawId = draw.id;

    // Create knockout matches: semi 1, semi 2, final, third_place
    const semi1 = await prisma.match.create({
      data: {
        eventId,
        drawId,
        stage: 'knockout',
        round: 1,
        matchNo: 1,
        topEntryId: entry1Id,
        bottomEntryId: entry2Id,
      },
    });
    semi1Id = semi1.id;

    const semi2 = await prisma.match.create({
      data: {
        eventId,
        drawId,
        stage: 'knockout',
        round: 1,
        matchNo: 2,
        topEntryId: entry3Id,
        bottomEntryId: entry4Id,
      },
    });
    semi2Id = semi2.id;

    const final = await prisma.match.create({
      data: {
        eventId,
        drawId,
        stage: 'knockout',
        round: 2,
        matchNo: 3,
      },
    });
    finalId = final.id;

    const thirdPlace = await prisma.match.create({
      data: {
        eventId,
        drawId,
        stage: 'third_place',
        round: 2,
        matchNo: 4,
      },
    });
    thirdPlaceId = thirdPlace.id;

    // Assign umpire
    await prisma.eventUmpire.create({
      data: {
        eventId,
        userId: umpireId,
        courts: [],
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    await Promise.all([
      prisma.match.deleteMany({ where: { drawId } }),
      prisma.draw.deleteMany({ where: { id: drawId } }),
      prisma.entry.deleteMany({ where: { id: { in: [entry1Id, entry2Id, entry3Id, entry4Id] } } }),
      prisma.eventUmpire.deleteMany({ where: { userId: { in: [committeeId, umpireId] } } }),
      prisma.event.deleteMany({ where: { id: eventId } }),
      prisma.tournament.deleteMany({ where: { id: (await prisma.event.findUnique({ where: { id: eventId } }))?.tournamentId } }),
      prisma.user.deleteMany({ where: { id: { in: [committeeId, umpireId] } } }),
    ]);
    await app.close();
  });

  it('Committee enters semi 1: final top filled with winner, third_place top filled with loser', async () => {
    const res = await http()
      .post(`/api/v1/matches/${semi1Id}/result`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({
        outcome: 'played',
        games: [
          { a: 21, b: 10 },
          { a: 21, b: 15 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.winnerEntryId).toBe(entry1Id);

    // Check final top entry
    const final = await prisma.match.findUnique({ where: { id: finalId } });
    expect(final?.topEntryId).toBe(entry1Id);

    // Check third_place top entry
    const third = await prisma.match.findUnique({ where: { id: thirdPlaceId } });
    expect(third?.topEntryId).toBe(entry2Id);
  });

  it('Semi 2 via umpire report then Committee approve: final bottom filled only after approve', async () => {
    // Umpire reports
    const reportRes = await http()
      .post(`/api/v1/matches/${semi2Id}/result`)
      .set('Cookie', cookieFor(umpireId, ['Umpire']))
      .send({
        outcome: 'played',
        games: [
          { a: 21, b: 18 },
          { a: 21, b: 14 },
        ],
      });

    expect(reportRes.status).toBe(200);

    // After report, final bottom should NOT be filled yet
    let final = await prisma.match.findUnique({ where: { id: finalId } });
    expect(final?.bottomEntryId).toBeNull();

    // Committee approves
    const approveRes = await http()
      .post(`/api/v1/matches/${semi2Id}/result-approve`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({ approvalDecision: 'approved' });

    expect(approveRes.status).toBe(200);

    // After approve, final bottom should be filled
    final = await prisma.match.findUnique({ where: { id: finalId } });
    expect(final?.bottomEntryId).toBe(entry3Id);
    expect(final?.status).toBe('confirmed');
  });

  it('Correction of semi 1 changing winner while final scheduled: final top updated', async () => {
    // Correct semi 1 to change winner
    const correctRes = await http()
      .post(`/api/v1/matches/${semi1Id}/result-correct`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({
        outcome: 'played',
        games: [
          { a: 18, b: 21 },
          { a: 15, b: 21 },
        ],
        reason: 'Score correction',
      });

    expect(correctRes.status).toBe(200);
    expect(correctRes.body.winnerEntryId).toBe(entry2Id);

    // Final top should now be entry2 (changed winner)
    const final = await prisma.match.findUnique({ where: { id: finalId } });
    expect(final?.topEntryId).toBe(entry2Id);
  });

  it('After final confirmed, winner-changing correction of semi 1 returns 409', async () => {
    // First, confirm the final
    const finalConfirm = await http()
      .post(`/api/v1/matches/${finalId}/result`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({
        outcome: 'played',
        games: [
          { a: 21, b: 12 },
          { a: 21, b: 14 },
        ],
      });

    expect(finalConfirm.status).toBe(200);

    // Now try to correct semi 1 again (changes winner)
    const correctRes = await http()
      .post(`/api/v1/matches/${semi1Id}/result-correct`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({
        outcome: 'played',
        games: [
          { a: 21, b: 10 },
          { a: 21, b: 15 },
        ],
        reason: 'Reverting correction',
      });

    expect(correctRes.status).toBe(409);
    expect(correctRes.body.code).toBe('NEXT_MATCH_ALREADY_PLAYED');
  });

  it('Final confirmed with winner entry filled', async () => {
    const final = await prisma.match.findUnique({ where: { id: finalId } });
    expect(final?.status).toBe('confirmed');
    expect(final?.winnerEntryId).toBeTruthy();
  });
});
