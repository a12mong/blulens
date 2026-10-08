import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-pub-${randomUUID().slice(0, 6)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

describe('publish-draw (bl-25-9)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const userIds: string[] = [];
  let adminId: string;
  let committeeId: string;
  let memberId: string;
  let extraPlayerId: string;

  let event1Id: string;
  let event2Id: string;
  let event3Id: string;
  let event4Id: string;
  let knockoutEventId: string;
  let knockoutDrawId: string;

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

    // Extra player for late entry in event 3
    const extraP = await prisma.user.create({
      data: {
        email: `${tag}-extra@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Extra Player`,
      },
    });
    extraPlayerId = extraP.id;
    userIds.push(extraPlayerId);

    // 2. Tournament
    const tourney = await prisma.tournament.create({
      data: {
        name: `${tag} Tourney`,
        status: 'open',
        startsOn: new Date('2026-12-05T00:00:00Z'),
        entriesCloseAt: new Date('2026-11-30T17:00:00Z'),
        createdBy: adminId,
      },
    });

    // Helper to create group event + 6 entries
    const createGroupEventWithEntries = async (
      discipline: 'MS' | 'WS' | 'MD' | 'WD' | 'XD',
      suffix: string,
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
          },
        },
      });

      for (let i = 1; i <= 6; i++) {
        const p = await prisma.user.create({
          data: {
            email: `${tag}-${suffix}-p${i}@test.local`,
            passwordHash: 'x',
            displayName: `${tag} ${suffix} P${i}`,
          },
        });
        userIds.push(p.id);

        await prisma.entry.create({
          data: {
            eventId: ev.id,
            status: 'approved',
            name: `${suffix} Entry ${i}`,
            createdBy: adminId,
            players: {
              create: [{ userId: p.id, eventId: ev.id }],
            },
          },
        });
      }

      return ev.id;
    };

    event1Id = await createGroupEventWithEntries('MS', 'e1');
    event2Id = await createGroupEventWithEntries('WS', 'e2');
    event3Id = await createGroupEventWithEntries('MD', 'e3');
    event4Id = await createGroupEventWithEntries('WD', 'e4');

    // Knockout event with a preview draw (for kind check)
    const koEv = await prisma.event.create({
      data: {
        tournamentId: tourney.id,
        discipline: 'XD',
        gradeMinIndex: 0,
        gradeMaxIndex: 10,
        minReviewers: 2,
        format: {
          type: 'knockout',
        },
      },
    });
    knockoutEventId = koEv.id;

    const koDraw = await prisma.draw.create({
      data: {
        eventId: knockoutEventId,
        kind: 'knockout',
        version: 1,
        status: 'preview',
        seed: '0123456789abcdef0123456789abcdef',
        seedSource: 'server',
        inputHash: '0000000000000000000000000000000000000000000000000000000000000000',
        snapshot: { entries: [] },
        rulesetVersion: 'draw-v1',
        prngId: 'prng-v1',
        size: 4,
        seedsCount: 0,
        createdBy: adminId,
      },
    });
    knockoutDrawId = koDraw.id;
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
    await http().post(`/api/v1/draws/${randomUUID()}/publish`).send({}).expect(401);
  });

  it('member role calling endpoint -> 403 FORBIDDEN', async () => {
    await http()
      .post(`/api/v1/draws/${randomUUID()}/publish`)
      .set('Cookie', cookieFor(memberId, ['Member']))
      .send({})
      .expect(403);
  });

  it('missing draw -> 404 DRAW_NOT_FOUND', async () => {
    const fakeId = randomUUID();
    const res = await http()
      .post(`/api/v1/draws/${fakeId}/publish`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DRAW_NOT_FOUND');
  });

  it("kind 'knockout' -> 409 DRAW_KIND_NOT_SUPPORTED", async () => {
    const res = await http()
      .post(`/api/v1/draws/${knockoutDrawId}/publish`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DRAW_KIND_NOT_SUPPORTED');
  });

  let publishedDrawId: string;

  it('preview (via POST groups/preview) -> publish -> 200 published', async () => {
    // 1. Generate preview
    const prevRes = await http()
      .post(`/api/v1/events/${event1Id}/groups/preview`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(201);

    expect(prevRes.body.success).toBe(true);
    publishedDrawId = prevRes.body.data.id;
    expect(prevRes.body.data.status).toBe('preview');

    // 2. Publish it
    const pubRes = await http()
      .post(`/api/v1/draws/${publishedDrawId}/publish`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({ reason: 'Initial publishing' })
      .expect(200);

    expect(pubRes.body.success).toBe(true);
    const draw = pubRes.body.data;
    expect(draw.id).toBe(publishedDrawId);
    expect(draw.status).toBe('published');
    expect(draw.kind).toBe('group');

    // 3. Verify in DB
    const dbDraw = await prisma.draw.findUnique({
      where: { id: publishedDrawId },
    });
    expect(dbDraw?.status).toBe('published');
    expect(dbDraw?.reason).toBe('Initial publishing');

    // 4. Verify audit log
    const audit = await prisma.auditLog.findFirst({
      where: {
        entityType: 'draw',
        entityId: publishedDrawId,
        action: 'draw.publish',
      },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorId).toBe(committeeId);
    expect(audit?.reason).toBe('Initial publishing');
  });

  it('GET /events/{id}/matches now lists its matches', async () => {
    const res = await http().get(`/api/v1/events/${event1Id}/matches`).expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(6);
    expect(res.body.data.every((m: { stage: string }) => m.stage === 'group')).toBe(true);
  });

  it('publish again -> 409 DRAW_ALREADY_LOCKED', async () => {
    const res = await http()
      .post(`/api/v1/draws/${publishedDrawId}/publish`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DRAW_ALREADY_LOCKED');
  });

  it('a second preview made before publish is now discarded', async () => {
    // 1. Create preview 1 on event 2
    const prev1 = await http()
      .post(`/api/v1/events/${event2Id}/groups/preview`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(201);
    const prev1Id = prev1.body.data.id;

    // 2. Create preview 2 on event 2
    const prev2 = await http()
      .post(`/api/v1/events/${event2Id}/groups/preview`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(201);
    const prev2Id = prev2.body.data.id;

    // 3. Publish preview 2
    await http()
      .post(`/api/v1/draws/${prev2Id}/publish`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(200);

    // 4. Verify preview 1 is discarded and preview 2 is published
    const db1 = await prisma.draw.findUnique({ where: { id: prev1Id } });
    expect(db1?.status).toBe('discarded');

    const db2 = await prisma.draw.findUnique({ where: { id: prev2Id } });
    expect(db2?.status).toBe('published');
  });

  it('approve one more entry after preview then publish -> 409 DRAW_INPUT_CHANGED', async () => {
    // 1. Create preview on event 3
    const prev3 = await http()
      .post(`/api/v1/events/${event3Id}/groups/preview`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(201);
    const prev3Id = prev3.body.data.id;

    // 2. Add an approved entry to event 3 (changes current approved entries)
    await prisma.entry.create({
      data: {
        eventId: event3Id,
        status: 'approved',
        name: 'Late Entry',
        createdBy: adminId,
        players: {
          create: [{ userId: extraPlayerId, eventId: event3Id }],
        },
      },
    });

    // 3. Attempt publish -> DRAW_INPUT_CHANGED
    const res = await http()
      .post(`/api/v1/draws/${prev3Id}/publish`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DRAW_INPUT_CHANGED');
  });

  it('a draw with sameTeamR1Count > 0 -> 409 without ack, 200 with acknowledgeConflicts true + acknowledgedBy set', async () => {
    // 1. Create preview on event 4
    const prev4 = await http()
      .post(`/api/v1/events/${event4Id}/groups/preview`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(201);
    const prev4Id = prev4.body.data.id;

    // 2. Manually set sameTeamR1Count > 0
    await prisma.draw.update({
      where: { id: prev4Id },
      data: { sameTeamR1Count: 1 },
    });

    // 3. Attempt publish without acknowledgeConflicts -> 409 DRAW_CONFLICTS_NOT_ACKNOWLEDGED
    const failRes = await http()
      .post(`/api/v1/draws/${prev4Id}/publish`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({ acknowledgeConflicts: false })
      .expect(409);

    expect(failRes.body.success).toBe(false);
    expect(failRes.body.error.code).toBe('DRAW_CONFLICTS_NOT_ACKNOWLEDGED');

    // 4. Publish with acknowledgeConflicts: true -> 200
    const okRes = await http()
      .post(`/api/v1/draws/${prev4Id}/publish`)
      .set('Cookie', cookieFor(adminId, ['Admin']))
      .send({ acknowledgeConflicts: true })
      .expect(200);

    expect(okRes.body.success).toBe(true);
    expect(okRes.body.data.status).toBe('published');

    // 5. Verify acknowledgedBy & acknowledgedAt in DB
    const db4 = await prisma.draw.findUnique({
      where: { id: prev4Id },
    });
    expect(db4?.status).toBe('published');
    expect(db4?.conflictsAcknowledgedBy).toBe(adminId);
    expect(db4?.conflictsAcknowledgedAt).not.toBeNull();
  });
});
