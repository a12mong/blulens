import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-kp-${randomUUID().slice(0, 6)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt(
    { sub: id, roles },
    process.env.JWT_ACCESS_SECRET ?? 'blulens-jwt-secret-for-development-change-in-production',
    900,
    Math.floor(Date.now() / 1000),
  )}`;

describe('knockout-preview (bl-33-1)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const userIds: string[] = [];
  let adminId: string;
  let committeeId: string;
  let memberId: string;

  let eventId: string;
  let groupDrawId: string;

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

    // 2. Open Tournament
    const tourney = await prisma.tournament.create({
      data: {
        name: `${tag} Open Tourney`,
        status: 'open',
        startsOn: new Date('2026-12-05T00:00:00Z'),
        entriesCloseAt: new Date('2026-11-30T17:00:00Z'),
        createdBy: adminId,
      },
    });

    // 4. Event with groups_knockout format (2 groups of 3, advancePerGroup 2)
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
    eventId = ev.id;

    // 5. Create 6 entries (3 in teamA, 3 in teamB)
    for (let i = 1; i <= 6; i++) {
      const p = await prisma.user.create({
        data: {
          email: `${tag}-p${i}@test.local`,
          passwordHash: 'x',
          displayName: `${tag} Player ${i}`,
        },
      });
      userIds.push(p.id);

      await prisma.entry.create({
        data: {
          eventId: ev.id,
          status: 'approved',
          name: `${tag} Entry ${i}`,
          createdBy: adminId,
          players: {
            create: [{ userId: p.id, eventId: ev.id }],
          },
        },
      });
    }

    // 6. Create group preview and publish it
    const groupPrev = await http()
      .post(`/api/v1/events/${eventId}/groups/preview`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(201);
    groupDrawId = groupPrev.body.data.id;

    await http()
      .post(`/api/v1/draws/${groupDrawId}/publish`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({ acknowledgeConflicts: true })
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

  it('knockout preview before groups confirm -> 409 GROUP_STAGE_NOT_CONFIRMED', async () => {
    const res = await http()
      .post(`/api/v1/events/${eventId}/knockout/preview`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('GROUP_STAGE_NOT_CONFIRMED');
  });

  it('Member caller -> 403 FORBIDDEN', async () => {
    const res = await http()
      .post(`/api/v1/events/${eventId}/knockout/preview`)
      .set('Cookie', cookieFor(memberId, ['Member']))
      .send({})
      .expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('complete all group matches and confirm group stage -> success', async () => {
    const matches = await prisma.match.findMany({
      where: { drawId: groupDrawId },
      orderBy: [{ stage: 'asc' }, { round: 'asc' }, { matchNo: 'asc' }],
    });

    expect(matches.length).toBe(6);

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

    const confirmRes = await http()
      .post(`/api/v1/events/${eventId}/groups/confirm`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .expect(200);

    expect(confirmRes.body.success).toBe(true);
    expect(confirmRes.body.data.length).toBe(6);

    // Verify group draw status is now 'locked'
    const lockedDraw = await prisma.draw.findUnique({
      where: { id: groupDrawId },
    });
    expect(lockedDraw?.status).toBe('locked');
  });

  let createdKnockoutDrawId: string;

  it('knockout preview 201: size 4, 4 slots, no byes, winners on seeds 1-2, R1 pairs have no group clash', async () => {
    const res = await http()
      .post(`/api/v1/events/${eventId}/knockout/preview`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(201);

    expect(res.body.success).toBe(true);
    const draw = res.body.data;
    createdKnockoutDrawId = draw.id;

    expect(draw.kind).toBe('knockout');
    expect(draw.version).toBe(1);
    expect(draw.status).toBe('preview');
    expect(draw.size).toBe(4);
    expect(draw.slots.length).toBe(4);
    expect(draw.conflicts).toEqual([]);

    // Check slots
    const slots = draw.slots;
    // No byes
    expect(slots.every((s: { entryId: string | null }) => s.entryId !== null)).toBe(true);

    // Every slot has entry with displayName
    for (const s of slots) {
      expect(s.entry).not.toBeNull();
      expect(s.entry.displayName).toBeDefined();
      expect(s.source).not.toBeNull();
      expect(s.source.groupLabel).toBeDefined();
      expect(s.source.place).toBeDefined();
    }

    // Winners are on seedNo 1 and 2
    const seed1 = slots.find((s: { seedNo: number | null }) => s.seedNo === 1);
    const seed2 = slots.find((s: { seedNo: number | null }) => s.seedNo === 2);
    expect(seed1?.source.place).toBe(1);
    expect(seed2?.source.place).toBe(1);

    // Runners-up on seeds 3 and 4
    const seed3 = slots.find((s: { seedNo: number | null }) => s.seedNo === 3);
    const seed4 = slots.find((s: { seedNo: number | null }) => s.seedNo === 4);
    expect(seed3?.source.place).toBe(2);
    expect(seed4?.source.place).toBe(2);

    // In bracket of 4:
    // Match 1: position 1 vs position 2 (seed 1 vs seed 4)
    // Match 2: position 3 vs position 4 (seed 3 vs seed 2)
    const slot1 = slots.find((s: { position: number }) => s.position === 1);
    const slot2 = slots.find((s: { position: number }) => s.position === 2);
    const slot3 = slots.find((s: { position: number }) => s.position === 3);
    const slot4 = slots.find((s: { position: number }) => s.position === 4);

    // Pair 1: winner vs runner-up from DIFFERENT groups
    expect(slot1.source.place).not.toBe(slot2.source.place);
    expect(slot1.source.groupLabel).not.toBe(slot2.source.groupLabel);

    // Pair 2: winner vs runner-up from DIFFERENT groups
    expect(slot3.source.place).not.toBe(slot4.source.place);
    expect(slot3.source.groupLabel).not.toBe(slot4.source.groupLabel);

    // Verify Draw row in DB
    const dbDraw = await prisma.draw.findUnique({
      where: { id: draw.id },
      include: { slots: true },
    });
    expect(dbDraw).not.toBeNull();
    expect(dbDraw?.kind).toBe('knockout');
    expect(dbDraw?.version).toBe(1);
    expect(dbDraw?.sourceGroupDrawId).toBe(groupDrawId);
    expect(dbDraw?.slots.length).toBe(4);

    // Verify audit log
    const audit = await prisma.auditLog.findFirst({
      where: {
        entityType: 'draw',
        entityId: draw.id,
        action: 'draw.preview',
      },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorId).toBe(committeeId);
  });

  it('second preview without reason -> 400 VALIDATION_FAILED', async () => {
    const res = await http()
      .post(`/api/v1/events/${eventId}/knockout/preview`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({})
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.message).toBe('ต้องระบุเหตุผลเมื่อสุ่มตัวอย่างใหม่');
  });

  it('second preview with reason too short (< 5 chars) -> 400 VALIDATION_FAILED', async () => {
    const res = await http()
      .post(`/api/v1/events/${eventId}/knockout/preview`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({ reason: 'abc' })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  const previewReason = 'สุ่มสายรอบแพ้คัดออกใหม่เพื่อทดสอบการกระจาย';

  it('second preview with reason -> 201, version 2, reason stored in DB and audit', async () => {
    const res = await http()
      .post(`/api/v1/events/${eventId}/knockout/preview`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({ reason: previewReason })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.version).toBe(2);

    const dbDraw = await prisma.draw.findUnique({
      where: { id: res.body.data.id },
    });
    expect(dbDraw?.reason).toBe(previewReason);

    const audit = await prisma.auditLog.findFirst({
      where: {
        entityType: 'draw',
        entityId: res.body.data.id,
        action: 'draw.preview',
      },
    });
    expect(audit?.reason).toBe(previewReason);
  });

  it('event not found -> 404 EVENT_NOT_FOUND', async () => {
    const fakeId = randomUUID();
    const res = await http()
      .post(`/api/v1/events/${fakeId}/knockout/preview`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({ reason: previewReason })
      .expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('EVENT_NOT_FOUND');
  });

  it('invalid seed format -> 400 VALIDATION_FAILED', async () => {
    const res = await http()
      .post(`/api/v1/events/${eventId}/knockout/preview`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({ seed: 'not-32-hex-characters', reason: previewReason })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('published knockout draw exists -> 409 DRAW_ALREADY_LOCKED', async () => {
    // Mark the latest knockout draw as published
    const latestKnockout = await prisma.draw.findFirst({
      where: { eventId, kind: 'knockout' },
      orderBy: { version: 'desc' },
    });
    await prisma.draw.update({
      where: { id: latestKnockout!.id },
      data: { status: 'published' },
    });

    const res = await http()
      .post(`/api/v1/events/${eventId}/knockout/preview`)
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({ reason: previewReason })
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DRAW_ALREADY_LOCKED');
  });
});
