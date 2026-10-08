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

  describe('Published knockout bracket (Q=4)', () => {
    let koTournament: any;
    let koEvent: any;
    let koEntryIds: string[] = [];
    let koDrawId: string;

    beforeAll(async () => {
      // Create tournament
      koTournament = await prisma.tournament.create({
        data: {
          name: `${tag}-knockout`,
          venue: 'Test Venue',
          status: 'open',
          startsOn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          entriesCloseAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
        },
      });

      // Create event
      koEvent = await prisma.event.create({
        data: {
          tournamentId: koTournament.id,
          discipline: 'MD',
          gradeMinIndex: 6,
          gradeMaxIndex: 8,
          minReviewers: 2,
        },
      });

      // Create 4 entries with players
      for (let i = 1; i <= 4; i++) {
        const player = await prisma.user.create({
          data: {
            email: `${tag}-ko-p${i}@test.local`,
            passwordHash: 'x',
            displayName: `${tag} Ko Player ${i}`,
          },
        });

        const entry = await prisma.entry.create({
          data: {
            eventId: koEvent.id,
            status: 'approved',
            name: `${tag} Pair ${i}`,
            players: { create: [{ userId: player.id, eventId: koEvent.id }] },
          },
        });
        koEntryIds.push(entry.id);
      }

      // Create published knockout draw with DrawSlots for 4 entries
      const koDraw = await prisma.draw.create({
        data: {
          eventId: koEvent.id,
          kind: 'knockout',
          version: 1,
          status: 'published',
          seed: 'test-seed-q4',
          seedSource: 'committee',
          inputHash: 'test-hash',
          snapshot: { entries: koEntryIds.map((id, idx) => ({ id, seedScore: idx + 1 })) },
          rulesetVersion: '1.0',
          prngId: 'test-prng',
          size: 4,
          seedsCount: 4,
          createdBy: committeeId,
          slots: {
            create: koEntryIds.map((entryId, idx) => ({
              position: idx + 1,
              entryId,
              seedNo: idx + 1,
            })),
          },
        },
      });

      koDrawId = koDraw.id;

      // Create knockout matches for Q=4 (R1: 2 matches, R2: 1 final)
      // matchNo is running counter across all rounds (not per-round)
      const matches = [
        { matchNo: 1, round: 1, topEntryId: koEntryIds[0], bottomEntryId: koEntryIds[1] },
        { matchNo: 2, round: 1, topEntryId: koEntryIds[2], bottomEntryId: koEntryIds[3] },
        { matchNo: 3, round: 2, topEntryId: null, bottomEntryId: null }, // Final, entries TBD
      ];

      for (const m of matches) {
        await prisma.match.create({
          data: {
            eventId: koEvent.id,
            drawId: koDrawId,
            stage: 'knockout',
            round: m.round,
            matchNo: m.matchNo,
            topEntryId: m.topEntryId,
            bottomEntryId: m.bottomEntryId,
            status: 'scheduled',
          },
        });
      }
    });

    afterAll(async () => {
      // Cleanup in order: matches, draws, entries, event, tournament
      await prisma.match.deleteMany({ where: { eventId: koEvent.id } });
      await prisma.draw.deleteMany({ where: { eventId: koEvent.id } });
      await prisma.entry.deleteMany({ where: { eventId: koEvent.id } });
      await prisma.event.deleteMany({ where: { tournamentId: koTournament.id } });
      await prisma.tournament.delete({ where: { id: koTournament.id } });
      // Users are cleaned up by the main afterAll
    });

    it('Q=4 published knockout -> 200 with bracket structure', async () => {
      const res = await http()
        .get(`/api/v1/events/${koEvent.id}/bracket`)
        .set('Cookie', guestCookie)
        .expect(200);

      expect(res.body.data).toBeDefined();
      const bracket = res.body.data;

      // Verify top-level structure
      expect(bracket.eventId).toBe(koEvent.id);
      expect(bracket.drawId).toBe(koDrawId);
      expect(bracket.provisional).toBe(false);
      expect(bracket.size).toBe(4);

      // Verify rounds exist
      expect(bracket.rounds).toBeDefined();
      expect(Array.isArray(bracket.rounds)).toBe(true);

      // For Q=4: 2 rounds (R1: 2 matches, R2: 1 match)
      expect(bracket.rounds.length).toBe(2);

      // Round 1: 4 entries → 2 matches, should be 'รองชนะเลิศ' (4 left)
      const round1 = bracket.rounds.find((r: any) => r.round === 1);
      expect(round1).toBeDefined();
      expect(round1?.nameTh).toBe('รองชนะเลิศ');
      expect(round1?.matches).toHaveLength(2);

      // Round 2: Final match, should be 'ชิงชนะเลิศ' (2 left)
      const round2 = bracket.rounds.find((r: any) => r.round === 2);
      expect(round2).toBeDefined();
      expect(round2?.nameTh).toBe('ชิงชนะเลิศ');
      expect(round2?.matches).toHaveLength(1);

      // Verify match structure
      const match1 = round1?.matches[0];
      expect(match1?.matchNo).toBe(1);
      expect(match1?.round).toBe(1);
      expect(match1?.top).toBeDefined();
      expect(match1?.bottom).toBeDefined();
      expect(match1?.topEntry).toBeDefined();
      expect(match1?.bottomEntry).toBeDefined();
      expect(match1?.status).toBe('scheduled');

      // nextMatchNo should point to final
      expect(match1?.nextMatchNo).toBe(1);
      expect(match1?.nextSide).toMatch(/^(top|bottom)$/);
    });
  });
});
