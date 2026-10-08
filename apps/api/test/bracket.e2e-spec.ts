import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-bracket-${randomUUID().slice(0, 8)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

describe('GET /events/{eventId}/bracket (bl-33-3)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  let committeeId: string;
  let committeeCookie: string;
  let guestCookie: string;
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

    // Create guest user (no staff roles)
    const guest = await prisma.user.create({
      data: {
        email: `${tag}-guest@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Guest`,
      },
    });
    guestCookie = cookieFor(guest.id, []);

    // Create tournament
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
    // Cleanup
    await prisma.eventUmpire.deleteMany({ where: { eventId } });
    await prisma.event.deleteMany({ where: { tournamentId } });
    await prisma.tournament.deleteMany({ where: { id: tournamentId } });
    const users = await prisma.user.findMany({ where: { email: { contains: tag } } });
    await prisma.userRole.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    await prisma.user.updateMany({
      where: { id: { in: users.map((u) => u.id) } },
      data: { status: 'disabled' },
    });
  });

  describe('Draft event', () => {
    it('Draft as Guest -> 404 EVENT_NOT_FOUND', async () => {
      await http()
        .get(`/api/v1/events/${eventId}/bracket`)
        .set('Cookie', guestCookie)
        .expect(404);
    });
  });

  describe('No draws published', () => {
    it('No bracket draws -> 404 BRACKET_NOT_PUBLISHED', async () => {
      await http()
        .get(`/api/v1/events/${eventId}/bracket`)
        .set('Cookie', committeeCookie)
        .expect(404);
    });
  });

  describe('Published event without bracket', () => {
    let publishedTournament: any;
    let publishedEvent: any;

    beforeAll(async () => {
      publishedTournament = await prisma.tournament.create({
        data: {
          name: `${tag}-published`,
          venue: 'Test Venue',
          status: 'open',
          startsOn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          entriesCloseAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
        },
      });

      publishedEvent = await prisma.event.create({
        data: {
          tournamentId: publishedTournament.id,
          discipline: 'MD',
          gradeMinIndex: 6,
          gradeMaxIndex: 8,
          minReviewers: 2,
        },
      });
    });

    afterAll(async () => {
      await prisma.event.deleteMany({ where: { tournamentId: publishedTournament.id } });
      await prisma.tournament.delete({ where: { id: publishedTournament.id } });
    });

    it('Published event as Guest, no draws -> 404 BRACKET_NOT_PUBLISHED', async () => {
      await http()
        .get(`/api/v1/events/${publishedEvent.id}/bracket`)
        .set('Cookie', guestCookie)
        .expect(404);
    });

    it('Unknown event -> 404 EVENT_NOT_FOUND', async () => {
      const unknownEventId = randomUUID();
      await http()
        .get(`/api/v1/events/${unknownEventId}/bracket`)
        .set('Cookie', committeeCookie)
        .expect(404);
    });
  });
});
