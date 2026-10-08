import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-es-${randomUUID().slice(0, 6)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt(
    { sub: id, roles },
    process.env.JWT_ACCESS_SECRET ?? 'blulens-jwt-secret-for-development-change-in-production',
    900,
    Math.floor(Date.now() / 1000),
  )}`;

describe('event-standings (bl-25-7 API)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const userIds: string[] = [];
  let adminId: string;
  let committeeId: string;
  let p1Id: string;
  let p2Id: string;
  let p3Id: string;
  let p4Id: string;
  let p5Id: string;
  let p6Id: string;

  let openEventId: string;
  let previewEventId: string;
  let draftEventId: string;

  let groupAId: string;
  let groupBId: string;
  let e1Id: string;
  let e2Id: string;
  let e3Id: string;
  let e4Id: string;
  let e5Id: string;
  let e6Id: string;

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

    const playersData = [
      { email: `${tag}-p1@test.local`, displayName: `${tag} Player 1` },
      { email: `${tag}-p2@test.local`, displayName: `${tag} Player 2` },
      { email: `${tag}-p3@test.local`, displayName: `${tag} Player 3` },
      { email: `${tag}-p4@test.local`, displayName: `${tag} Player 4` },
      { email: `${tag}-p5@test.local`, displayName: `${tag} Player 5` },
      { email: `${tag}-p6@test.local`, displayName: `${tag} Player 6` },
    ];

    const createdPlayers: string[] = [];
    for (const p of playersData) {
      const u = await prisma.user.create({
        data: { email: p.email, passwordHash: 'x', displayName: p.displayName },
      });
      createdPlayers.push(u.id);
      userIds.push(u.id);
    }
    p1Id = createdPlayers[0]!;
    p2Id = createdPlayers[1]!;
    p3Id = createdPlayers[2]!;
    p4Id = createdPlayers[3]!;
    p5Id = createdPlayers[4]!;
    p6Id = createdPlayers[5]!;

    // 2. Open Tournament & Event
    const tournament = await prisma.tournament.create({
      data: {
        name: `${tag} Tournament`,
        status: 'open',
        startsOn: new Date('2026-12-01T00:00:00Z'),
        entriesCloseAt: new Date('2026-11-20T17:00:00Z'),
        createdBy: adminId,
      },
    });

    const openEvent = await prisma.event.create({
      data: {
        tournamentId: tournament.id,
        discipline: 'MS',
        gradeMinIndex: 6,
        gradeMaxIndex: 10,
        minReviewers: 2,
        format: {
          type: 'groups_knockout',
          advancePerGroup: 2,
          bestThirds: 0,
          points: { win: 3, draw: 1, loss: 0 },
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
    openEventId = openEvent.id;

    // 3. Entries for Open Event
    const e1 = await prisma.entry.create({
      data: {
        eventId: openEventId,
        status: 'approved',
        name: `${tag} Entry 1`,
        createdBy: adminId,
        players: { create: [{ userId: p1Id, eventId: openEventId }] },
      },
    });
    e1Id = e1.id;

    const e2 = await prisma.entry.create({
      data: {
        eventId: openEventId,
        status: 'approved',
        name: `${tag} Entry 2`,
        createdBy: adminId,
        players: { create: [{ userId: p2Id, eventId: openEventId }] },
      },
    });
    e2Id = e2.id;

    const e3 = await prisma.entry.create({
      data: {
        eventId: openEventId,
        status: 'approved',
        name: `${tag} Entry 3`,
        createdBy: adminId,
        players: { create: [{ userId: p3Id, eventId: openEventId }] },
      },
    });
    e3Id = e3.id;

    const e4 = await prisma.entry.create({
      data: {
        eventId: openEventId,
        status: 'approved',
        name: `${tag} Entry 4`,
        createdBy: adminId,
        players: { create: [{ userId: p4Id, eventId: openEventId }] },
      },
    });
    e4Id = e4.id;

    const e5 = await prisma.entry.create({
      data: {
        eventId: openEventId,
        status: 'approved',
        name: `${tag} Entry 5`,
        createdBy: adminId,
        players: { create: [{ userId: p5Id, eventId: openEventId }] },
      },
    });
    e5Id = e5.id;

    const e6 = await prisma.entry.create({
      data: {
        eventId: openEventId,
        status: 'approved',
        name: `${tag} Entry 6`,
        createdBy: adminId,
        players: { create: [{ userId: p6Id, eventId: openEventId }] },
      },
    });
    e6Id = e6.id;

    // 4. Published Draw on Open Event
    const draw = await prisma.draw.create({
      data: {
        eventId: openEventId,
        kind: 'group',
        version: 1,
        status: 'published',
        seed: 'seed123',
        seedSource: 'server',
        inputHash: '1'.repeat(64),
        snapshot: {},
        rulesetVersion: '1.0',
        prngId: 'pcg32',
        size: 6,
        seedsCount: 0,
        createdBy: adminId,
      },
    });

    // Group A (Live computation)
    const groupA = await prisma.group.create({
      data: { eventId: openEventId, drawId: draw.id, label: 'A' },
    });
    groupAId = groupA.id;

    await prisma.groupMember.createMany({
      data: [
        { groupId: groupA.id, entryId: e1.id, seedInGroup: 1, pot: 1 },
        { groupId: groupA.id, entryId: e2.id, seedInGroup: 2, pot: 2 },
        { groupId: groupA.id, entryId: e3.id, seedInGroup: 3, pot: 3 },
      ],
    });

    // Group A matches:
    // Match 1: Confirmed [15-11, 15-9] -> e1 wins
    await prisma.match.create({
      data: {
        eventId: openEventId,
        drawId: draw.id,
        groupId: groupA.id,
        stage: 'group',
        round: 1,
        matchNo: 1,
        status: 'confirmed',
        games: [
          { a: 15, b: 11 },
          { a: 15, b: 9 },
        ],
        result: 'a_win',
        winnerEntryId: e1.id,
        topEntryId: e1.id,
        bottomEntryId: e2.id,
      },
    });

    // Match 2: Reported (should NOT be counted in live standings)
    await prisma.match.create({
      data: {
        eventId: openEventId,
        drawId: draw.id,
        groupId: groupA.id,
        stage: 'group',
        round: 1,
        matchNo: 2,
        status: 'reported',
        games: [
          { a: 15, b: 10 },
          { a: 15, b: 12 },
        ],
        result: 'b_win',
        winnerEntryId: e3.id,
        topEntryId: e2.id,
        bottomEntryId: e3.id,
      },
    });

    // Match 3: Scheduled
    await prisma.match.create({
      data: {
        eventId: openEventId,
        drawId: draw.id,
        groupId: groupA.id,
        stage: 'group',
        round: 2,
        matchNo: 3,
        status: 'scheduled',
        topEntryId: e1.id,
        bottomEntryId: e3.id,
      },
    });

    // Group B (Confirmed snapshot)
    const groupB = await prisma.group.create({
      data: { eventId: openEventId, drawId: draw.id, label: 'B' },
    });
    groupBId = groupB.id;

    await prisma.groupMember.createMany({
      data: [
        { groupId: groupB.id, entryId: e4.id, seedInGroup: 1, pot: 1 },
        { groupId: groupB.id, entryId: e5.id, seedInGroup: 2, pot: 2 },
        { groupId: groupB.id, entryId: e6.id, seedInGroup: 3, pot: 3 },
      ],
    });

    // Group B GroupStanding rows (confirmed snapshot)
    await prisma.groupStanding.createMany({
      data: [
        {
          groupId: groupB.id,
          entryId: e4.id,
          rank: 1,
          played: 2,
          won: 2,
          drawn: 0,
          lost: 0,
          points: 6,
          pointsFor: 60,
          pointsAgainst: 40,
          diff: 20,
          qualification: 'qualified',
          confirmedBy: adminId,
          tiebreakNote: null,
        },
        {
          groupId: groupB.id,
          entryId: e5.id,
          rank: 2,
          played: 2,
          won: 1,
          drawn: 0,
          lost: 1,
          points: 3,
          pointsFor: 50,
          pointsAgainst: 50,
          diff: 0,
          qualification: 'qualified',
          confirmedBy: adminId,
          tiebreakNote: null,
        },
        {
          groupId: groupB.id,
          entryId: e6.id,
          rank: 3,
          played: 2,
          won: 0,
          drawn: 0,
          lost: 2,
          points: 0,
          pointsFor: 40,
          pointsAgainst: 60,
          diff: -20,
          qualification: 'out',
          confirmedBy: adminId,
          tiebreakNote: 'head_to_head',
        },
      ],
    });

    // 5. Preview-only Event
    const previewEvent = await prisma.event.create({
      data: {
        tournamentId: tournament.id,
        discipline: 'WS',
        gradeMinIndex: 6,
        gradeMaxIndex: 10,
        minReviewers: 2,
      },
    });
    previewEventId = previewEvent.id;

    await prisma.draw.create({
      data: {
        eventId: previewEvent.id,
        kind: 'group',
        version: 1,
        status: 'preview',
        seed: 'seed_prev',
        seedSource: 'server',
        inputHash: '3'.repeat(64),
        snapshot: {},
        rulesetVersion: '1.0',
        prngId: 'pcg32',
        size: 3,
        seedsCount: 0,
        createdBy: adminId,
      },
    });

    // 6. Draft Tournament & Event
    const draftTournament = await prisma.tournament.create({
      data: {
        name: `${tag} Draft Tournament`,
        status: 'draft',
        startsOn: new Date('2026-12-01T00:00:00Z'),
        entriesCloseAt: new Date('2026-11-20T17:00:00Z'),
        createdBy: adminId,
      },
    });

    const draftEvent = await prisma.event.create({
      data: {
        tournamentId: draftTournament.id,
        discipline: 'MS',
        gradeMinIndex: 6,
        gradeMaxIndex: 10,
        minReviewers: 2,
      },
    });
    draftEventId = draftEvent.id;
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

  it('published group of 3 with 1 confirmed match [15-11,15-9], 1 reported, 1 scheduled -> 3 rows, winner rank 1 with points 3, reported match NOT counted, confirmed false', async () => {
    const res = await http().get(`/api/v1/events/${openEventId}/standings`).expect(200);

    expect(res.body.success).toBe(true);
    const standings: Array<{
      groupId: string;
      entryId: string;
      entry: { displayName: string };
      rank: number;
      played: number;
      won: number;
      lost: number;
      points: number;
      pointsFor: number;
      pointsAgainst: number;
      diff: number;
      qualification: string;
      confirmed: boolean;
      tiebreakNote: string | null;
    }> = res.body.data;

    // Filter rows for Group A
    const groupARows = standings.filter((s) => s.groupId === groupAId);
    expect(groupARows).toHaveLength(3);

    // Winner of confirmed match is e1 (rank 1, points 3)
    const row1 = groupARows.find((s) => s.entryId === e1Id);
    expect(row1).toBeDefined();
    expect(row1?.rank).toBe(1);
    expect(row1?.played).toBe(1);
    expect(row1?.won).toBe(1);
    expect(row1?.lost).toBe(0);
    expect(row1?.points).toBe(3);
    expect(row1?.pointsFor).toBe(30);
    expect(row1?.pointsAgainst).toBe(20);
    expect(row1?.diff).toBe(10);
    expect(row1?.confirmed).toBe(false);
    expect(row1?.qualification).toBe('qualified');
    expect(row1?.entry.displayName).toBe(`${tag} Entry 1`);

    // e2 lost to e1 (points 0, played 1)
    const row2 = groupARows.find((s) => s.entryId === e2Id);
    expect(row2).toBeDefined();
    expect(row2?.played).toBe(1);
    expect(row2?.won).toBe(0);
    expect(row2?.lost).toBe(1);
    expect(row2?.points).toBe(0);

    // e3: reported match was NOT counted, so played is 0
    const row3 = groupARows.find((s) => s.entryId === e3Id);
    expect(row3).toBeDefined();
    expect(row3?.played).toBe(0);
    expect(row3?.won).toBe(0);
    expect(row3?.points).toBe(0);

    // advancePerGroup 2 -> ranks 1 and 2 qualified, rank 3 out
    const sortedA = [...groupARows].sort((a, b) => a.rank - b.rank);
    expect(sortedA[0]?.qualification).toBe('qualified');
    expect(sortedA[1]?.qualification).toBe('qualified');
    expect(sortedA[2]?.qualification).toBe('out');
  });

  it('a group with GroupStanding rows -> those values with confirmed true', async () => {
    const res = await http().get(`/api/v1/events/${openEventId}/standings`).expect(200);

    const groupBRows = res.body.data.filter((s: { groupId: string }) => s.groupId === groupBId);
    expect(groupBRows).toHaveLength(3);

    // Sorted by rank
    expect(groupBRows[0]?.entryId).toBe(e4Id);
    expect(groupBRows[0]?.rank).toBe(1);
    expect(groupBRows[0]?.points).toBe(6);
    expect(groupBRows[0]?.confirmed).toBe(true);
    expect(groupBRows[0]?.qualification).toBe('qualified');

    expect(groupBRows[1]?.entryId).toBe(e5Id);
    expect(groupBRows[1]?.rank).toBe(2);
    expect(groupBRows[1]?.points).toBe(3);
    expect(groupBRows[1]?.confirmed).toBe(true);
    expect(groupBRows[1]?.qualification).toBe('qualified');

    expect(groupBRows[2]?.entryId).toBe(e6Id);
    expect(groupBRows[2]?.rank).toBe(3);
    expect(groupBRows[2]?.points).toBe(0);
    expect(groupBRows[2]?.confirmed).toBe(true);
    expect(groupBRows[2]?.qualification).toBe('out');
    expect(groupBRows[2]?.tiebreakNote).toBe('head_to_head');
  });

  it('preview draw -> []', async () => {
    const res = await http().get(`/api/v1/events/${previewEventId}/standings`).expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('draft tournament as Guest -> 404 EVENT_NOT_FOUND', async () => {
    const res = await http().get(`/api/v1/events/${draftEventId}/standings`).expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('EVENT_NOT_FOUND');
  });

  it('draft tournament as Committee -> 200 []', async () => {
    const committeeCookie = cookieFor(committeeId, ['Committee']);
    const res = await http()
      .get(`/api/v1/events/${draftEventId}/standings`)
      .set('Cookie', committeeCookie)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });
});
