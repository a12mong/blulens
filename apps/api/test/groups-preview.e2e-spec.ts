import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { DRAW_RULESET_VERSION } from '@blulens/shared';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-gp-${randomUUID().slice(0, 6)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

describe('groups-preview (bl-25-8)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const userIds: string[] = [];
  let adminId: string;
  let committeeId: string;
  let memberId: string;

  let groupEventId: string;
  let knockoutEventId: string;
  let underflowEventId: string;

  const groupEntryIds: string[] = [];

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

    // 3. Team
    const team = await prisma.team.create({
      data: {
        name: `${tag} Club`,
        nameKey: `${tag}-club`,
      },
    });

    // 4. Group event with groups_knockout format (groupSize: 3)
    const grpEvent = await prisma.event.create({
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
        },
      },
    });
    groupEventId = grpEvent.id;

    // 6 Players and 6 Entries for group event
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
          eventId: groupEventId,
          status: 'approved',
          name: `Entry ${i}`,
          createdBy: adminId,
          players: {
            create: [
              {
                userId: p.id,
                eventId: groupEventId,
                teamId: i % 2 === 0 ? team.id : null,
              },
            ],
          },
        },
      });
      groupEntryIds.push(entry.id);
    }

    // 5. Knockout event (format: single elimination / knockout)
    const koEvent = await prisma.event.create({
      data: {
        tournamentId: tourney.id,
        discipline: 'WS',
        gradeMinIndex: 0,
        gradeMaxIndex: 10,
        minReviewers: 2,
        format: {
          type: 'knockout',
        },
      },
    });
    knockoutEventId = koEvent.id;

    for (let i = 1; i <= 4; i++) {
      const p = await prisma.user.create({
        data: {
          email: `${tag}-kop${i}@test.local`,
          passwordHash: 'x',
          displayName: `${tag} KO Player ${i}`,
        },
      });
      userIds.push(p.id);

      await prisma.entry.create({
        data: {
          eventId: knockoutEventId,
          status: 'approved',
          name: `KO Entry ${i}`,
          createdBy: adminId,
          players: {
            create: [{ userId: p.id, eventId: knockoutEventId }],
          },
        },
      });
    }

    // 6. Underflow event (<3 entries, format: groups_knockout)
    const ufEvent = await prisma.event.create({
      data: {
        tournamentId: tourney.id,
        discipline: 'MD',
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
    underflowEventId = ufEvent.id;

    for (let i = 1; i <= 2; i++) {
      const p = await prisma.user.create({
        data: {
          email: `${tag}-ufp${i}@test.local`,
          passwordHash: 'x',
          displayName: `${tag} UF Player ${i}`,
        },
      });
      userIds.push(p.id);

      await prisma.entry.create({
        data: {
          eventId: underflowEventId,
          status: 'approved',
          name: `UF Entry ${i}`,
          createdBy: adminId,
          players: {
            create: [{ userId: p.id, eventId: underflowEventId }],
          },
        },
      });
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
    await http().post(`/api/v1/events/${groupEventId}/groups/preview`).send({}).expect(401);
  });

  it('member role calling endpoint -> 403 FORBIDDEN', async () => {
    await http()
      .post(`/api/v1/events/${groupEventId}/groups/preview`)
      .set('Cookie', cookieFor(memberId, ['Member']))
      .send({})
      .expect(403);
  });

  it('invalid seed format -> 400 VALIDATION_FAILED', async () => {
    const res = await http()
      .post(`/api/v1/events/${groupEventId}/groups/preview`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({ seed: 'bad-seed-not-32-hex' })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('groupCount override passed -> 400 VALIDATION_FAILED', async () => {
    const res = await http()
      .post(`/api/v1/events/${groupEventId}/groups/preview`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({ groupCount: 2 })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.message).toBe('groupCount override not supported yet');
  });

  it('event not found -> 404 EVENT_NOT_FOUND', async () => {
    const fakeId = randomUUID();
    const res = await http()
      .post(`/api/v1/events/${fakeId}/groups/preview`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('EVENT_NOT_FOUND');
  });

  it('event with knockout format -> 409 EVENT_NOT_GROUP_FORMAT', async () => {
    const res = await http()
      .post(`/api/v1/events/${knockoutEventId}/groups/preview`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('EVENT_NOT_GROUP_FORMAT');
  });

  it('fewer than 3 approved entries -> 409 NOT_ENOUGH_ENTRIES', async () => {
    const res = await http()
      .post(`/api/v1/events/${underflowEventId}/groups/preview`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_ENOUGH_ENTRIES');
  });

  let createdDrawId: string;
  const fixedSeed = '0123456789abcdef0123456789abcdef';

  it('open tournament + groups_knockout event + 6 approved entries -> 201 preview, version 1, 2 groups of 3, 6 matches', async () => {
    const res = await http()
      .post(`/api/v1/events/${groupEventId}/groups/preview`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({ seed: fixedSeed })
      .expect(201);

    expect(res.body.success).toBe(true);
    const draw = res.body.data;
    createdDrawId = draw.id;
    expect(draw.eventId).toBe(groupEventId);
    expect(draw.version).toBe(1);
    expect(draw.status).toBe('preview');
    expect(draw.kind).toBe('group');
    expect(draw.seed).toBe(fixedSeed);
    expect(draw.size).toBe(6);
    expect(draw.createdBy).toBe(committeeId);
    expect(draw.rulesetVersion).toBe(DRAW_RULESET_VERSION);
    expect(draw.slots).toEqual([]);
    expect(typeof draw.inputHash).toBe('string');
    expect(draw.inputHash).toHaveLength(64);
    expect(draw.id).toBeDefined();

    // Verify DB records
    const dbDraw = await prisma.draw.findUnique({
      where: { id: createdDrawId },
    });
    expect(dbDraw).not.toBeNull();
    expect(dbDraw?.version).toBe(1);
    expect(dbDraw?.status).toBe('preview');

    const groups = await prisma.group.findMany({
      where: { drawId: createdDrawId },
      include: { members: true },
      orderBy: { label: 'asc' },
    });
    expect(groups).toHaveLength(2);
    expect(groups[0]?.label).toBe('A');
    expect(groups[1]?.label).toBe('B');
    expect(groups[0]?.members).toHaveLength(3);
    expect(groups[1]?.members).toHaveLength(3);

    const matches = await prisma.match.findMany({
      where: { drawId: createdDrawId },
      orderBy: { matchNo: 'asc' },
    });
    expect(matches).toHaveLength(6);
    expect(matches.every((m) => m.stage === 'group')).toBe(true);
    expect(matches.every((m) => m.status === 'scheduled')).toBe(true);
    expect(matches.every((m) => m.court === null)).toBe(true);

    // Verify audit log
    const audit = await prisma.auditLog.findFirst({
      where: {
        entityType: 'draw',
        entityId: createdDrawId,
        action: 'draw.preview',
      },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorId).toBe(committeeId);
  });

  it('GET /events/{eventId}/matches still returns [] (preview matches hidden from public)', async () => {
    const res = await http().get(`/api/v1/events/${groupEventId}/matches`).expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('second preview on same event -> version 2', async () => {
    const res = await http()
      .post(`/api/v1/events/${groupEventId}/groups/preview`)
      .set('Cookie', cookieFor(adminId, ['Admin']))
      .send({ seed: fixedSeed })
      .expect(201);

    expect(res.body.success).toBe(true);
    const draw2 = res.body.data;
    expect(draw2.version).toBe(2);
    expect(draw2.createdBy).toBe(adminId);

    // Same seed twice -> same group membership (determinism)
    const draw1Groups = await prisma.group.findMany({
      where: { drawId: createdDrawId },
      include: { members: { orderBy: { entryId: 'asc' } } },
      orderBy: { label: 'asc' },
    });
    const draw2Groups = await prisma.group.findMany({
      where: { drawId: draw2.id },
      include: { members: { orderBy: { entryId: 'asc' } } },
      orderBy: { label: 'asc' },
    });

    expect(draw1Groups.map((g) => g.members.map((m) => m.entryId))).toEqual(
      draw2Groups.map((g) => g.members.map((m) => m.entryId)),
    );
  });

  it('published draw exists -> 409 DRAW_ALREADY_LOCKED', async () => {
    // Mark the latest draw as published
    await prisma.draw.updateMany({
      where: { eventId: groupEventId, version: 2 },
      data: { status: 'published' },
    });

    const res = await http()
      .post(`/api/v1/events/${groupEventId}/groups/preview`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DRAW_ALREADY_LOCKED');
  });
});
