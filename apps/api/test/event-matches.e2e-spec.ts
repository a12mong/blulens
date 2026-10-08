import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-mat-${randomUUID().slice(0, 6)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

describe('event-matches (bl-25-1)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const userIds: string[] = [];
  const teamIds: string[] = [];
  const tournamentIds: string[] = [];
  const eventIds: string[] = [];

  let openEventId: string;
  let draftEventId: string;
  let confirmedMatchId: string;
  let reportedMatchId: string;
  let scheduledMatchId: string;
  let previewMatchId: string;
  let customEventId: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();

    // 1. Admin user for createdBy / reportedBy / confirmedBy
    const adminUser = await prisma.user.create({
      data: {
        email: `${tag}-admin@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Admin`,
      },
    });
    userIds.push(adminUser.id);

    // 2. Clubs / Teams
    const teamBlue = await prisma.team.create({
      data: {
        name: `${tag} Blue Club`,
        nameKey: `${tag}-blue-club`,
      },
    });
    teamIds.push(teamBlue.id);

    // 3. Players
    const p1 = await prisma.user.create({
      data: {
        email: `${tag}-p1@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Player 1`,
      },
    });
    userIds.push(p1.id);

    const p2 = await prisma.user.create({
      data: {
        email: `${tag}-p2@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Player 2`,
      },
    });
    userIds.push(p2.id);

    const p3 = await prisma.user.create({
      data: {
        email: `${tag}-p3@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Player 3`,
      },
    });
    userIds.push(p3.id);

    // 4. Open Tournament + Event
    const openTournament = await prisma.tournament.create({
      data: {
        name: `${tag} Open Tourney`,
        status: 'open',
        startsOn: new Date('2026-12-05T00:00:00Z'),
        entriesCloseAt: new Date('2026-11-30T17:00:00Z'),
        createdBy: adminUser.id,
      },
    });
    tournamentIds.push(openTournament.id);

    const openEvent = await prisma.event.create({
      data: {
        tournamentId: openTournament.id,
        discipline: 'MS',
        gradeMinIndex: 6,
        gradeMaxIndex: 10,
        minReviewers: 2,
      },
    });
    openEventId = openEvent.id;
    eventIds.push(openEventId);

    // 5. 3 Approved Entries
    const entry1 = await prisma.entry.create({
      data: {
        eventId: openEventId,
        status: 'approved',
        name: 'Entry One Name',
        createdBy: adminUser.id,
        players: {
          create: [{ userId: p1.id, eventId: openEventId, teamId: teamBlue.id }],
        },
      },
    });

    const entry2 = await prisma.entry.create({
      data: {
        eventId: openEventId,
        status: 'approved',
        name: 'Entry Two Name',
        createdBy: adminUser.id,
        players: {
          create: [{ userId: p2.id, eventId: openEventId, teamId: teamBlue.id }],
        },
      },
    });

    const entry3 = await prisma.entry.create({
      data: {
        eventId: openEventId,
        status: 'approved',
        createdBy: adminUser.id,
        players: {
          create: [{ userId: p3.id, eventId: openEventId }],
        },
      },
    });

    // 6. Published Group Draw + Group
    const publishedDraw = await prisma.draw.create({
      data: {
        eventId: openEventId,
        kind: 'group',
        version: 1,
        status: 'published',
        seed: 'seed-published',
        seedSource: 'server',
        inputHash: '1'.repeat(64),
        snapshot: {},
        rulesetVersion: '1.0',
        prngId: 'pcg32',
        size: 3,
        seedsCount: 0,
        createdBy: adminUser.id,
      },
    });

    const groupA = await prisma.group.create({
      data: {
        eventId: openEventId,
        drawId: publishedDraw.id,
        label: 'A',
      },
    });

    // 7. 3 Matches in published draw
    const m1 = await prisma.match.create({
      data: {
        eventId: openEventId,
        drawId: publishedDraw.id,
        groupId: groupA.id,
        stage: 'group',
        round: 1,
        matchNo: 1,
        court: 'Court 1',
        status: 'confirmed',
        topEntryId: entry1.id,
        bottomEntryId: entry2.id,
        games: [{ a: 15, b: 11 }],
        result: 'a_win',
        confirmedBy: adminUser.id,
        confirmedAt: new Date('2026-10-08T08:00:00Z'),
      },
    });
    confirmedMatchId = m1.id;

    const m2 = await prisma.match.create({
      data: {
        eventId: openEventId,
        drawId: publishedDraw.id,
        groupId: groupA.id,
        stage: 'group',
        round: 2,
        matchNo: 2,
        status: 'reported',
        topEntryId: entry2.id,
        bottomEntryId: entry3.id,
        games: [{ a: 10, b: 15 }],
        result: 'b_win',
        reportedBy: adminUser.id,
        reportedAt: new Date('2026-10-08T09:00:00Z'),
      },
    });
    reportedMatchId = m2.id;

    const m3 = await prisma.match.create({
      data: {
        eventId: openEventId,
        drawId: publishedDraw.id,
        groupId: groupA.id,
        stage: 'group',
        round: 3,
        matchNo: 3,
        status: 'scheduled',
        topEntryId: entry3.id,
        bottomEntryId: entry1.id,
      },
    });
    scheduledMatchId = m3.id;

    // 8. Preview draw with 1 match
    const previewDraw = await prisma.draw.create({
      data: {
        eventId: openEventId,
        kind: 'group',
        version: 2,
        status: 'preview',
        seed: 'seed-preview',
        seedSource: 'server',
        inputHash: '2'.repeat(64),
        snapshot: {},
        rulesetVersion: '1.0',
        prngId: 'pcg32',
        size: 3,
        seedsCount: 0,
        createdBy: adminUser.id,
      },
    });

    const mPrev = await prisma.match.create({
      data: {
        eventId: openEventId,
        drawId: previewDraw.id,
        stage: 'group',
        round: 1,
        matchNo: 1,
        status: 'scheduled',
        topEntryId: entry1.id,
        bottomEntryId: entry2.id,
      },
    });
    previewMatchId = mPrev.id;

    // 9. Draft Tournament + Event
    const draftTournament = await prisma.tournament.create({
      data: {
        name: `${tag} Draft Tourney`,
        status: 'draft',
        startsOn: new Date('2026-12-10T00:00:00Z'),
        entriesCloseAt: new Date('2026-12-05T17:00:00Z'),
        createdBy: adminUser.id,
      },
    });
    tournamentIds.push(draftTournament.id);

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
    eventIds.push(draftEventId);

    // 10. Groups_knockout event with custom groupMatchFormat
    const customEvent = await prisma.event.create({
      data: {
        tournamentId: openTournament.id,
        discipline: 'MD',
        gradeMinIndex: 6,
        gradeMaxIndex: 10,
        minReviewers: 2,
        format: {
          type: 'groups_knockout',
          groupSize: 4,
          advancePerGroup: 2,
          groupMatchFormat: {
            preset: 'custom',
            mode: 'fixed_games',
            games: 2,
            pointsPerGame: 21,
            deuce: false,
            cap: null,
            drawAllowed: true,
          },
        },
      },
    });
    customEventId = customEvent.id;
    eventIds.push(customEventId);

    const customDraw = await prisma.draw.create({
      data: {
        eventId: customEventId,
        kind: 'group',
        version: 1,
        status: 'published',
        seed: 'seed-custom',
        seedSource: 'server',
        inputHash: '3'.repeat(64),
        snapshot: {},
        rulesetVersion: '1.0',
        prngId: 'pcg32',
        size: 2,
        seedsCount: 0,
        createdBy: adminUser.id,
      },
    });

    const customGroup = await prisma.group.create({
      data: {
        eventId: customEventId,
        drawId: customDraw.id,
        label: 'A',
      },
    });

    await prisma.match.create({
      data: {
        eventId: customEventId,
        drawId: customDraw.id,
        groupId: customGroup.id,
        stage: 'group',
        round: 1,
        matchNo: 1,
        status: 'scheduled',
      },
    });

    await prisma.match.create({
      data: {
        eventId: customEventId,
        drawId: customDraw.id,
        stage: 'knockout',
        round: 1,
        matchNo: 2,
        status: 'scheduled',
      },
    });
  });

  afterAll(async () => {
    await prisma.match.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.group.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.draw.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.entryPlayer.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.entry.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
    await prisma.teamMembership.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.team.deleteMany({ where: { id: { in: teamIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('Guest gets 3 matches (not the preview one), with aEntry.displayName and teamNames filled', async () => {
    const res = await http().get(`/api/v1/events/${openEventId}/matches`).expect(200);

    expect(res.body.success).toBe(true);
    const matches = res.body.data;
    expect(matches).toHaveLength(3);

    // Ensure preview match is NOT returned
    const ids = matches.map((m: { id: string }) => m.id);
    expect(ids).toContain(confirmedMatchId);
    expect(ids).toContain(reportedMatchId);
    expect(ids).toContain(scheduledMatchId);
    expect(ids).not.toContain(previewMatchId);

    // Verify ordering: stage, groupId, round, matchNo
    expect(matches[0].id).toBe(confirmedMatchId);
    expect(matches[1].id).toBe(reportedMatchId);
    expect(matches[2].id).toBe(scheduledMatchId);

    // Verify match fields and entry labels
    const first = matches[0];
    expect(first.status).toBe('confirmed');
    expect(first.court).toBe('Court 1');
    expect(first.games).toEqual([{ a: 15, b: 11 }]);
    expect(first.result).toBe('a_win');
    expect(first.confirmedAt).toBe('2026-10-08T08:00:00.000Z');
    expect(first.flags).toEqual([]);
    expect(first.format).toEqual({
      preset: 'group_2x15',
      mode: 'fixed_games',
      games: 2,
      pointsPerGame: 15,
      deuce: false,
      cap: null,
      drawAllowed: true,
    });

    expect(first.aEntry).toMatchObject({
      displayName: 'Entry One Name',
      teamNames: [`${tag} Blue Club`],
      gradeLabel: null,
    });
    expect(first.aEntry.players).toHaveLength(1);
    expect(first.aEntry.players[0].displayName).toBe(`${tag} Player 1`);

    expect(first.bEntry).toMatchObject({
      displayName: 'Entry Two Name',
      teamNames: [`${tag} Blue Club`],
      gradeLabel: null,
    });

    // Verify entry without name falls back to player displayName
    const third = matches[2];
    expect(third.aEntry.displayName).toBe(`${tag} Player 3`);
    expect(third.aEntry.teamNames).toEqual([]);
  });

  it('?status=reported -> 1', async () => {
    const res = await http()
      .get(`/api/v1/events/${openEventId}/matches?status=reported`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(reportedMatchId);
    expect(res.body.data[0].status).toBe('reported');
  });

  it('?round=abc -> 400', async () => {
    const res = await http().get(`/api/v1/events/${openEventId}/matches?round=abc`).expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('unknown event -> 404', async () => {
    const res = await http().get(`/api/v1/events/${randomUUID()}/matches`).expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('EVENT_NOT_FOUND');
  });

  it('draft tournament as Guest -> 404', async () => {
    const res = await http().get(`/api/v1/events/${draftEventId}/matches`).expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('EVENT_NOT_FOUND');
  });

  it('draft tournament as Committee -> 200', async () => {
    const committeeCookie = cookieFor(randomUUID(), ['Committee']);
    const res = await http()
      .get(`/api/v1/events/${draftEventId}/matches`)
      .set('Cookie', committeeCookie)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('event with no format -> matches carry group_2x15 preset (bl-25-1b)', async () => {
    const res = await http().get(`/api/v1/events/${openEventId}/matches`).expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const match of res.body.data) {
      expect(match.format).toEqual({
        preset: 'group_2x15',
        mode: 'fixed_games',
        games: 2,
        pointsPerGame: 15,
        deuce: false,
        cap: null,
        drawAllowed: true,
      });
    }
  });

  it('groups_knockout event with custom groupMatchFormat -> group matches carry it, knockout carries bo3_21 preset (bl-25-1b)', async () => {
    const res = await http().get(`/api/v1/events/${customEventId}/matches`).expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);

    const groupMatch = res.body.data.find((m: { stage: string }) => m.stage === 'group');
    expect(groupMatch).toBeDefined();
    expect(groupMatch.format).toEqual({
      preset: 'custom',
      mode: 'fixed_games',
      games: 2,
      pointsPerGame: 21,
      deuce: false,
      cap: null,
      drawAllowed: true,
    });

    const knockoutMatch = res.body.data.find((m: { stage: string }) => m.stage === 'knockout');
    expect(knockoutMatch).toBeDefined();
    expect(knockoutMatch.format).toEqual({
      preset: 'bo3_21',
      mode: 'best_of',
      games: 3,
      pointsPerGame: 21,
      deuce: true,
      cap: 30,
      drawAllowed: false,
    });
  });
});
