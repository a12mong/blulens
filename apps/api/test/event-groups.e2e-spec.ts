import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-egr-${randomUUID().slice(0, 6)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

describe('event-groups (bl-25-10)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const userIds: string[] = [];
  let adminId: string;
  let committeeId: string;
  let memberId: string;
  let reviewerId: string;

  let openEventId: string;
  let noDrawEventId: string;
  let draftEventId: string;

  let publishedDrawId: string;
  let previewDrawId: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();

    // 1. Users
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

    const reviewer = await prisma.user.create({
      data: {
        email: `${tag}-reviewer@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Reviewer`,
      },
    });
    reviewerId = reviewer.id;
    userIds.push(reviewerId);

    // 2. Club Team
    const team = await prisma.team.create({
      data: {
        name: `${tag} Blue Club`,
        nameKey: `${tag}-blue-club`,
      },
    });

    // 3. Open Tournament
    const openTourney = await prisma.tournament.create({
      data: {
        name: `${tag} Open Tournament`,
        status: 'open',
        startsOn: new Date('2026-12-05T00:00:00Z'),
        entriesCloseAt: new Date('2026-11-30T17:00:00Z'),
        createdBy: adminId,
      },
    });

    // 4. Open Event with groups_knockout format (groupSize: 3, advancePerGroup: 2)
    const openEvent = await prisma.event.create({
      data: {
        tournamentId: openTourney.id,
        discipline: 'MS',
        gradeMinIndex: 0,
        gradeMaxIndex: 10,
        minReviewers: 2,
        format: {
          type: 'groups_knockout',
          groupSize: 3,
          advancePerGroup: 2,
        },
      },
    });
    openEventId = openEvent.id;

    // 5. 6 Approved Entries for Open Event
    const entryIds: string[] = [];
    for (let i = 1; i <= 6; i++) {
      const p = await prisma.user.create({
        data: {
          email: `${tag}-p${i}@test.local`,
          passwordHash: 'x',
          displayName: `${tag} Player ${i}`,
        },
      });
      userIds.push(p.id);

      const entry = await prisma.entry.create({
        data: {
          eventId: openEventId,
          status: 'approved',
          name: i % 2 === 0 ? `${tag} Custom Entry ${i}` : null,
          createdBy: adminId,
          players: {
            create: [{ userId: p.id, eventId: openEventId, teamId: team.id }],
          },
        },
      });
      entryIds.push(entry.id);
    }

    // 6. Event with no draw
    const noDrawEvent = await prisma.event.create({
      data: {
        tournamentId: openTourney.id,
        discipline: 'WS',
        gradeMinIndex: 0,
        gradeMaxIndex: 10,
        minReviewers: 2,
        format: {
          type: 'groups_knockout',
          groupSize: 3,
          advancePerGroup: 2,
        },
      },
    });
    noDrawEventId = noDrawEvent.id;

    // 7. Draft Tournament + Event
    const draftTourney = await prisma.tournament.create({
      data: {
        name: `${tag} Draft Tournament`,
        status: 'draft',
        startsOn: new Date('2026-12-10T00:00:00Z'),
        entriesCloseAt: new Date('2026-12-05T17:00:00Z'),
        createdBy: adminId,
      },
    });

    const draftEv = await prisma.event.create({
      data: {
        tournamentId: draftTourney.id,
        discipline: 'MD',
        gradeMinIndex: 0,
        gradeMaxIndex: 10,
        minReviewers: 2,
      },
    });
    draftEventId = draftEv.id;

    // 8. Generate Preview 1 and Publish it using the draws endpoints
    const prev1Res = await http()
      .post(`/api/v1/events/${openEventId}/groups/preview`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(201);
    publishedDrawId = prev1Res.body.data.id;

    const pubRes = await http()
      .post(`/api/v1/draws/${publishedDrawId}/publish`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({ acknowledgeConflicts: true })
      .expect(200);
    expect(pubRes.body.data.status).toBe('published');

    // 9. Create a newer preview draw (version 2) directly in DB to verify preview query behavior
    const prev2 = await prisma.draw.create({
      data: {
        eventId: openEventId,
        kind: 'group',
        version: 2,
        status: 'preview',
        seed: 'seed-preview-2',
        seedSource: 'server',
        inputHash: '2'.repeat(64),
        snapshot: {},
        rulesetVersion: '1.0',
        prngId: 'pcg32',
        size: 6,
        seedsCount: 0,
        createdBy: adminId,
      },
    });
    previewDrawId = prev2.id;

    const prevGroupA = await prisma.group.create({
      data: {
        eventId: openEventId,
        drawId: previewDrawId,
        label: 'A',
      },
    });
    const prevGroupB = await prisma.group.create({
      data: {
        eventId: openEventId,
        drawId: previewDrawId,
        label: 'B',
      },
    });

    for (let i = 1; i <= 3; i++) {
      await prisma.groupMember.create({
        data: {
          groupId: prevGroupA.id,
          entryId: entryIds[i - 1]!,
          seedInGroup: i,
          pot: i,
        },
      });
      await prisma.groupMember.create({
        data: {
          groupId: prevGroupB.id,
          entryId: entryIds[i + 2]!,
          seedInGroup: i,
          pot: i,
        },
      });
    }

    await prisma.match.create({
      data: {
        eventId: openEventId,
        drawId: previewDrawId,
        groupId: prevGroupA.id,
        stage: 'group',
        round: 1,
        matchNo: 1,
        status: 'scheduled',
        topEntryId: entryIds[0]!,
        bottomEntryId: entryIds[1]!,
      },
    });
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

  it('Guest gets 2 groups with 3 members each, entry.displayName set, 3 matches per group from published draw', async () => {
    const res = await http().get(`/api/v1/events/${openEventId}/groups`).expect(200);

    expect(res.body.success).toBe(true);
    const groups = res.body.data;
    expect(groups).toHaveLength(2);

    // Groups ordered by label: 'A', 'B'
    expect(groups[0].label).toBe('A');
    expect(groups[1].label).toBe('B');

    for (const group of groups) {
      // 3 members per group ordered by seedInGroup
      expect(group.members).toHaveLength(3);
      expect(group.members[0].seedInGroup).toBe(1);
      expect(group.members[1].seedInGroup).toBe(2);
      expect(group.members[2].seedInGroup).toBe(3);

      for (const member of group.members) {
        expect(member.entryId).toBeDefined();
        expect(member.pot).toBeDefined();
        expect(member.entry).toBeDefined();
        expect(typeof member.entry.displayName).toBe('string');
        expect(member.entry.displayName.length).toBeGreaterThan(0);
        expect(member.entry.players).toBeInstanceOf(Array);
        expect(member.entry.players.length).toBeGreaterThan(0);
        expect(member.entry.teamNames).toEqual([`${tag} Blue Club`]);
      }

      // 3 matches per group ordered by round, matchNo
      expect(group.matches).toHaveLength(3);
      for (let i = 0; i < group.matches.length; i++) {
        const match = group.matches[i];
        expect(match.stage).toBe('group');
        expect(match.groupId).toBe(group.id);
        expect(match.a).toBeDefined();
        expect(match.b).toBeDefined();
        expect(match.aEntry).toBeDefined();
        expect(match.bEntry).toBeDefined();
        expect(match.format).toBeDefined();
        expect(match.format.preset).toBe('group_2x15');
      }

      // Verify match round ordering
      expect(group.matches[0].round).toBeLessThanOrEqual(group.matches[1].round);
      expect(group.matches[1].round).toBeLessThanOrEqual(group.matches[2].round);
    }
  });

  it('a newer preview is NOT shown by default', async () => {
    // Default call returns the published draw, not the newer preview draw (version 2)
    const res = await http().get(`/api/v1/events/${openEventId}/groups`).expect(200);
    expect(res.body.success).toBe(true);

    // Check in database that the returned group matches belong to publishedDrawId
    const groups = res.body.data;
    const matchIds = groups.flatMap((g: { matches: Array<{ id: string }> }) =>
      g.matches.map((m) => m.id),
    );
    const dbMatches = await prisma.match.findMany({
      where: { id: { in: matchIds } },
      select: { drawId: true },
    });
    for (const m of dbMatches) {
      expect(m.drawId).toBe(publishedDrawId);
      expect(m.drawId).not.toBe(previewDrawId);
    }
  });

  it('?draw=published explicitly gets the published draw', async () => {
    const res = await http().get(`/api/v1/events/${openEventId}/groups?draw=published`).expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  it('Committee ?draw=preview gets the newer preview draw', async () => {
    const res = await http()
      .get(`/api/v1/events/${openEventId}/groups?draw=preview`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .expect(200);

    expect(res.body.success).toBe(true);
    const groups = res.body.data;
    expect(groups).toHaveLength(2);

    // Verify the matches belong to the preview draw (version 2)
    const matchIds = groups.flatMap((g: { matches: Array<{ id: string }> }) =>
      g.matches.map((m) => m.id),
    );
    const dbMatches = await prisma.match.findMany({
      where: { id: { in: matchIds } },
      select: { drawId: true },
    });
    for (const m of dbMatches) {
      expect(m.drawId).toBe(previewDrawId);
      expect(m.drawId).not.toBe(publishedDrawId);
    }
  });

  it('Admin ?draw=preview gets the preview draw', async () => {
    const res = await http()
      .get(`/api/v1/events/${openEventId}/groups?draw=preview`)
      .set('Cookie', cookieFor(adminId, ['Admin']))
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  it('Guest ?draw=preview -> 403 FORBIDDEN', async () => {
    const res = await http().get(`/api/v1/events/${openEventId}/groups?draw=preview`).expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('Member ?draw=preview -> 403 FORBIDDEN', async () => {
    const res = await http()
      .get(`/api/v1/events/${openEventId}/groups?draw=preview`)
      .set('Cookie', cookieFor(memberId, ['Member']))
      .expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('Reviewer ?draw=preview -> 403 FORBIDDEN', async () => {
    const res = await http()
      .get(`/api/v1/events/${openEventId}/groups?draw=preview`)
      .set('Cookie', cookieFor(reviewerId, ['Reviewer']))
      .expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('draft tournament as Guest -> 404 EVENT_NOT_FOUND', async () => {
    const res = await http().get(`/api/v1/events/${draftEventId}/groups`).expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('EVENT_NOT_FOUND');
  });

  it('draft tournament as Committee -> 200 []', async () => {
    const res = await http()
      .get(`/api/v1/events/${draftEventId}/groups`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('event with no draw -> 200 []', async () => {
    const res = await http().get(`/api/v1/events/${noDrawEventId}/groups`).expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('bad query param ?draw=bad -> 400 VALIDATION_FAILED', async () => {
    const res = await http().get(`/api/v1/events/${openEventId}/groups?draw=bad`).expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('unknown event UUID -> 404 EVENT_NOT_FOUND', async () => {
    const res = await http().get(`/api/v1/events/${randomUUID()}/groups`).expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('EVENT_NOT_FOUND');
  });

  it('invalid eventId parameter -> 400', async () => {
    const res = await http().get('/api/v1/events/not-a-uuid/groups').expect(400);

    expect(res.body.success).toBe(false);
  });
});
