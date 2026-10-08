import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-event-umpires-${randomUUID().slice(0, 8)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

describe('GET/PUT /events/{eventId}/umpires (bl-33-5)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  let committeeId: string;
  let committeeCookie: string;
  let umpire1Id: string;
  let umpire1Name: string;
  let umpire2Id: string;
  let umpire2Name: string;
  let memberId: string;
  let memberCookie: string;
  let tournamentId: string;
  let eventId: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();

    // Create committee user
    const committee = await prisma.user.create({
      data: {
        email: `${tag}-committee@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Committee`,
      },
    });
    committeeId = committee.id;
    await prisma.userRole.create({ data: { userId: committeeId, role: 'Committee' } });
    committeeCookie = cookieFor(committeeId, ['Committee']);

    // Create umpire 1
    umpire1Name = `${tag} Umpire 1`;
    const umpire1 = await prisma.user.create({
      data: {
        email: `${tag}-umpire1@test.local`,
        passwordHash: 'x',
        displayName: umpire1Name,
      },
    });
    umpire1Id = umpire1.id;
    await prisma.userRole.create({ data: { userId: umpire1Id, role: 'Umpire' } });

    // Create umpire 2
    umpire2Name = `${tag} Umpire 2`;
    const umpire2 = await prisma.user.create({
      data: {
        email: `${tag}-umpire2@test.local`,
        passwordHash: 'x',
        displayName: umpire2Name,
      },
    });
    umpire2Id = umpire2.id;
    await prisma.userRole.create({ data: { userId: umpire2Id, role: 'Umpire' } });

    // Create member (no Umpire role)
    const member = await prisma.user.create({
      data: {
        email: `${tag}-member@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Member`,
      },
    });
    memberId = member.id;
    await prisma.userRole.create({ data: { userId: memberId, role: 'Member' } });
    memberCookie = cookieFor(memberId, ['Member']);

    // Create tournament and event
    const tournament = await prisma.tournament.create({
      data: {
        name: `${tag} Tournament`,
        venue: 'Test Venue',
        status: 'draft',
        startsOn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        entriesCloseAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      },
    });
    tournamentId = tournament.id;

    const event = await prisma.event.create({
      data: {
        tournamentId,
        discipline: 'MD',
        gradeMinIndex: 6,
        gradeMaxIndex: 8,
        minReviewers: 2,
      },
    });
    eventId = event.id;
  });

  afterAll(async () => {
    await app.close();
    // Cleanup in reverse dependency order
    await prisma.eventUmpire.deleteMany({ where: { eventId } });
    await prisma.event.deleteMany({ where: { tournamentId } });
    await prisma.tournament.deleteMany({ where: { id: tournamentId } });
    await prisma.userRole.deleteMany({ where: { userId: { in: [committeeId, umpire1Id, umpire2Id, memberId] } } });
    await prisma.user.updateMany({
      where: { id: { in: [committeeId, umpire1Id, umpire2Id, memberId] } },
      data: { status: 'disabled' },
    });
  });

  describe('PUT /events/{eventId}/umpires', () => {
    it('PUT two umpires (one courts [], one with duplicate courts) -> 200, courts de-duplicated', async () => {
      const res = await http()
        .put(`/api/v1/events/${eventId}/umpires`)
        .set('Cookie', committeeCookie)
        .send([
          {
            userId: umpire1Id,
            displayName: umpire1Name,
            courts: [],
          },
          {
            userId: umpire2Id,
            displayName: umpire2Name,
            courts: ['สนาม 2', 'สนาม 2'],
          },
        ])
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      const u1 = res.body.data.find((u: any) => u.userId === umpire1Id);
      const u2 = res.body.data.find((u: any) => u.userId === umpire2Id);
      expect(u1).toBeDefined();
      expect(u1.displayName).toBe(umpire1Name);
      expect(u1.courts).toEqual([]);
      expect(u2).toBeDefined();
      expect(u2.displayName).toBe(umpire2Name);
      expect(u2.courts).toEqual(['สนาม 2']); // de-duplicated
    });

    it('GET returns both with displayName and sorted courts', async () => {
      const res = await http().get(`/api/v1/events/${eventId}/umpires`).set('Cookie', committeeCookie).expect(200);

      expect(res.body.data).toHaveLength(2);
      // Should be sorted by displayName
      expect(res.body.data[0].displayName).toBe(umpire1Name);
      expect(res.body.data[1].displayName).toBe(umpire2Name);
    });

    it('PUT with only one umpire -> the other is removed', async () => {
      const res = await http()
        .put(`/api/v1/events/${eventId}/umpires`)
        .set('Cookie', committeeCookie)
        .send([
          {
            userId: umpire1Id,
            displayName: umpire1Name,
            courts: [],
          },
        ])
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].userId).toBe(umpire1Id);
    });

    it('PUT with Member without Umpire role -> 409 UMPIRE_NOT_ELIGIBLE + details.userId', async () => {
      const res = await http()
        .put(`/api/v1/events/${eventId}/umpires`)
        .set('Cookie', committeeCookie)
        .send([
          {
            userId: memberId,
            displayName: 'Member',
            courts: [],
          },
        ])
        .expect(409);

      expect(res.body.error?.code).toBe('UMPIRE_NOT_ELIGIBLE');
      expect(res.body.error?.details?.userId).toBe(memberId);
    });

    it('PUT with duplicate userIds -> 400', async () => {
      const res = await http()
        .put(`/api/v1/events/${eventId}/umpires`)
        .set('Cookie', committeeCookie)
        .send([
          {
            userId: umpire1Id,
            displayName: umpire1Name,
            courts: [],
          },
          {
            userId: umpire1Id,
            displayName: umpire1Name,
            courts: ['สนาม 3'],
          },
        ])
        .expect(400);

      expect(res.body.error?.code).toBe('VALIDATION_FAILED');
    });

    it('PUT without displayName (readOnly) and without courts -> 200, courts [] and an audit row', async () => {
      const res = await http()
        .put(`/api/v1/events/${eventId}/umpires`)
        .set('Cookie', committeeCookie)
        .send([{ userId: umpire1Id }])
        .expect(200);

      expect(res.body.data).toEqual([{ userId: umpire1Id, displayName: umpire1Name, courts: [] }]);
      const audit = await prisma.auditLog.findFirst({
        where: { action: 'event.umpires', entityId: eventId },
        orderBy: { createdAt: 'desc' },
      });
      expect(audit).not.toBeNull();
    });

    it('Umpire PUT -> 403', async () => {
      const umpireCookie = cookieFor(umpire1Id, ['Umpire']);
      await http()
        .put(`/api/v1/events/${eventId}/umpires`)
        .set('Cookie', umpireCookie)
        .send([])
        .expect(403);
    });

    it('Unknown event -> 404', async () => {
      const unknownEventId = randomUUID();
      await http()
        .put(`/api/v1/events/${unknownEventId}/umpires`)
        .set('Cookie', committeeCookie)
        .send([])
        .expect(404);
    });

    it('GET Umpire -> 200', async () => {
      const umpireCookie = cookieFor(umpire1Id, ['Umpire']);
      const res = await http()
        .get(`/api/v1/events/${eventId}/umpires`)
        .set('Cookie', umpireCookie)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].userId).toBe(umpire1Id);
    });

    it('GET with unknown event -> 404', async () => {
      const unknownEventId = randomUUID();
      await http().get(`/api/v1/events/${unknownEventId}/umpires`).set('Cookie', committeeCookie).expect(404);
    });
  });
});
