import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

/**
 * bl-21-6: PATCH /api/v1/entries/:entryId — edit draft or rejected entry.
 */

const prisma = new PrismaClient();
const tag = `zz-edit-${randomUUID().slice(0, 6)}`;
const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

const adminCommittee = cookieFor(randomUUID(), ['Admin', 'Committee']);
const committee = cookieFor(randomUUID(), ['Committee']);
const admin = cookieFor(randomUUID(), ['Admin']);
const member = cookieFor(randomUUID(), ['Member']);

const userIds: string[] = [];
const teamIds: string[] = [];
const tournamentIds: string[] = [];
const eventIds: string[] = [];

async function player(name: string, gradeIndex: number | null, teams: string[] = []) {
  const u = await prisma.user.create({
    data: { email: `${tag}-${name}@test.local`, passwordHash: 'x', displayName: `${tag} ${name}` },
  });
  userIds.push(u.id);
  for (const teamId of teams) {
    await prisma.teamMembership.create({ data: { userId: u.id, teamId } });
  }
  if (gradeIndex !== null) {
    const a = await prisma.assessment.create({
      data: { subjectUserId: u.id, status: 'overridden' },
    });
    await prisma.assessmentResult.create({
      data: {
        assessmentId: a.id,
        version: 1,
        source: 'override',
        status: 'overridden',
        score: gradeIndex + 0.5,
        margin: 0,
        lowerIndex: gradeIndex,
        centerIndex: gradeIndex,
        upperIndex: gradeIndex,
        kind: 'exact',
        label: `g${gradeIndex}`,
        nRaters: 0,
        methodVersion: 'grading-v1',
        inputs: {},
        reason: 'e2e fixture grade for entry edit test',
      },
    });
  }
  return u.id;
}

async function team(name: string) {
  const t = await prisma.team.create({
    data: { name: `${tag} ${name}`, nameKey: `${tag} ${name}`.toLowerCase() },
  });
  teamIds.push(t.id);
  return t.id;
}

describe('PATCH /entries/:entryId (bl-21-6 edit draft/rejected entry)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  let eventId: string;
  let tournamentId: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();

    const t = await http()
      .post('/api/v1/tournaments')
      .set('Cookie', committee)
      .send({
        name: `${tag} Edit Cup`,
        startsOn: '2026-12-05',
        entriesCloseAt: '2026-11-30T17:00:00Z',
      })
      .expect(201);
    tournamentId = t.body.data.id;
    tournamentIds.push(tournamentId);

    const ev = await http()
      .post(`/api/v1/tournaments/${tournamentId}/events`)
      .set('Cookie', committee)
      .send({ discipline: 'MD', gradeMin: 'S-', gradeMax: 'N' })
      .expect(201);
    eventId = ev.body.data.id;
    eventIds.push(eventId);

    await http()
      .post(`/api/v1/tournaments/${tournamentId}/status`)
      .set('Cookie', committee)
      .send({ to: 'open' })
      .expect(200);
  });

  afterAll(async () => {
    await prisma.entry.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.event.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
    await prisma.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
    await prisma.teamMembership.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.team.deleteMany({ where: { id: { in: teamIds } } });
    await prisma.user.updateMany({ where: { id: { in: userIds } }, data: { status: 'disabled' } });
    await prisma.$disconnect();
    await app.close();
  });

  it('lets the Admin fix a rejected entry and forward it again', async () => {
    const p1 = await player('rej-p1', 7); // S
    const p2 = await player('rej-p2', null); // ungraded
    const p3 = await player('rej-p3', 9); // N-

    // 1. Create a draft entry with an ungraded player
    const created = await http()
      .post(`/api/v1/events/${eventId}/entries`)
      .set('Cookie', adminCommittee)
      .send({ name: 'คู่มีปัญหา', players: [{ userId: p1 }, { userId: p2 }] })
      .expect(201);
    const entryId = created.body.data.id;
    expect(created.body.data).toMatchObject({ status: 'draft', name: 'คู่มีปัญหา' });

    // 2. Forward to Committee
    await http().post(`/api/v1/entries/${entryId}/forward`).set('Cookie', admin).expect(200);

    // 3. Committee rejects it with reason
    const reasonText = 'ผู้เล่นคนที่สองยังไม่มีเกรดที่ได้รับการอนุมัติ กรุณาเปลี่ยนคู่';
    const rejected = await http()
      .post(`/api/v1/entries/${entryId}/reject`)
      .set('Cookie', committee)
      .send({ reason: reasonText })
      .expect(200);
    expect(rejected.body.data).toMatchObject({
      status: 'rejected',
      decisionReason: reasonText,
    });
    expect(rejected.body.data.decidedBy).toBeTruthy();

    // 4. Admin edits the rejected entry (replaces p2 with p3, updates name)
    const patched = await http()
      .patch(`/api/v1/entries/${entryId}`)
      .set('Cookie', admin)
      .send({ name: 'คู่ฟ้าใหม่', players: [{ userId: p1 }, { userId: p3 }] })
      .expect(200);

    expect(patched.body.data).toMatchObject({
      id: entryId,
      status: 'draft',
      name: 'คู่ฟ้าใหม่',
      decidedBy: null,
      decidedAt: null,
      decisionReason: null,
    });
    const playerIds = patched.body.data.players.map((p: { userId: string }) => p.userId);
    expect(playerIds).toEqual([p1, p3].sort());

    // 5. Admin forwards the fixed entry again
    const forwardedAgain = await http()
      .post(`/api/v1/entries/${entryId}/forward`)
      .set('Cookie', admin)
      .expect(200);
    expect(forwardedAgain.body.data.status).toBe('pending_committee');

    // 6. Verify audit log was recorded
    const updateAudit = await prisma.auditLog.findFirst({
      where: { entityId: entryId, action: 'entry.update' },
    });
    expect(updateAudit).toBeTruthy();
    expect(updateAudit?.before).toMatchObject({ status: 'rejected' });
    expect(updateAudit?.after).toMatchObject({ name: 'คู่ฟ้าใหม่' });
  });

  it('edits a draft entry with a different second player and creates dated membership', async () => {
    const p1 = await player('draft-p1', 7);
    const p2 = await player('draft-p2', 8);
    const p3 = await player('draft-p3', 9);
    const club = await team('RedClub');

    const created = await http()
      .post(`/api/v1/events/${eventId}/entries`)
      .set('Cookie', adminCommittee)
      .send({ players: [{ userId: p1 }, { userId: p2 }] })
      .expect(201);
    const entryId = created.body.data.id;

    // PATCH with p3 (with club) replacing p2
    const res = await http()
      .patch(`/api/v1/entries/${entryId}`)
      .set('Cookie', admin)
      .send({ players: [{ userId: p1 }, { userId: p3, teamId: club }] })
      .expect(200);

    expect(res.body.data.status).toBe('draft');
    const p3Data = res.body.data.players.find((p: { userId: string }) => p.userId === p3);
    expect(p3Data).toMatchObject({ teamId: club, teamCount: 1 });

    // Verify p2 is no longer in this entry
    const entryInDb = await prisma.entry.findUnique({
      where: { id: entryId },
      include: { players: true },
    });
    expect(entryInDb?.players.map((p) => p.userId).sort()).toEqual([p1, p3].sort());
  });

  it('rejects editing when status is pending_committee or approved (ENTRY_NOT_EDITABLE)', async () => {
    const p1 = await player('pend-p1', 7);
    const p2 = await player('pend-p2', 8);

    const created = await http()
      .post(`/api/v1/events/${eventId}/entries`)
      .set('Cookie', adminCommittee)
      .send({ players: [{ userId: p1 }, { userId: p2 }] })
      .expect(201);
    const entryId = created.body.data.id;

    await http().post(`/api/v1/entries/${entryId}/forward`).set('Cookie', admin).expect(200);

    // pending_committee cannot be edited
    const errPending = await http()
      .patch(`/api/v1/entries/${entryId}`)
      .set('Cookie', admin)
      .send({ players: [{ userId: p1 }, { userId: p2 }] })
      .expect(409);
    expect(errPending.body.error.code).toBe('ENTRY_NOT_EDITABLE');

    // Committee approves entry
    await http()
      .post(`/api/v1/entries/${entryId}/approve`)
      .set('Cookie', committee)
      .send({})
      .expect(200);

    // approved entry cannot be edited
    const errApproved = await http()
      .patch(`/api/v1/entries/${entryId}`)
      .set('Cookie', admin)
      .send({ players: [{ userId: p1 }, { userId: p2 }] })
      .expect(409);
    expect(errApproved.body.error.code).toBe('ENTRY_NOT_EDITABLE');
  });

  it('rejects editing when a player is already in another entry of the event (ENTRY_DUPLICATE_PLAYER)', async () => {
    const pA = await player('dup-pA', 7);
    const pB = await player('dup-pB', 8);
    const pC = await player('dup-pC', 7);
    const pD = await player('dup-pD', 8);

    const e1 = (
      await http()
        .post(`/api/v1/events/${eventId}/entries`)
        .set('Cookie', adminCommittee)
        .send({ players: [{ userId: pA }, { userId: pB }] })
        .expect(201)
    ).body.data;

    const e2 = (
      await http()
        .post(`/api/v1/events/${eventId}/entries`)
        .set('Cookie', adminCommittee)
        .send({ players: [{ userId: pC }, { userId: pD }] })
        .expect(201)
    ).body.data;

    // Attempt to PATCH e1 to include pC (who is in e2)
    const errDup = await http()
      .patch(`/api/v1/entries/${e1.id}`)
      .set('Cookie', admin)
      .send({ players: [{ userId: pA }, { userId: pC }] })
      .expect(409);
    expect(errDup.body.error.code).toBe('ENTRY_DUPLICATE_PLAYER');

    // Verify e1 is completely unchanged in the DB
    const e1Db = await prisma.entry.findUnique({
      where: { id: e1.id },
      include: { players: true },
    });
    expect(e1Db?.players.map((p) => p.userId).sort()).toEqual([pA, pB].sort());
  });

  it('forbids Member cookie and unauthenticated requests', async () => {
    const p1 = await player('perm-p1', 7);
    const p2 = await player('perm-p2', 8);

    const created = await http()
      .post(`/api/v1/events/${eventId}/entries`)
      .set('Cookie', adminCommittee)
      .send({ players: [{ userId: p1 }, { userId: p2 }] })
      .expect(201);
    const entryId = created.body.data.id;

    await http()
      .patch(`/api/v1/entries/${entryId}`)
      .set('Cookie', member)
      .send({ players: [{ userId: p1 }, { userId: p2 }] })
      .expect(403);

    await http()
      .patch(`/api/v1/entries/${entryId}`)
      .send({ players: [{ userId: p1 }, { userId: p2 }] })
      .expect(401);
  });

  it('validates player count, duplicate players in input, and non-existent entry', async () => {
    const p1 = await player('val-p1', 7);
    const p2 = await player('val-p2', 8);

    const created = await http()
      .post(`/api/v1/events/${eventId}/entries`)
      .set('Cookie', adminCommittee)
      .send({ players: [{ userId: p1 }, { userId: p2 }] })
      .expect(201);
    const entryId = created.body.data.id;

    // Single player for doubles
    const errCount = await http()
      .patch(`/api/v1/entries/${entryId}`)
      .set('Cookie', admin)
      .send({ players: [{ userId: p1 }] })
      .expect(409);
    expect(errCount.body.error.code).toBe('ENTRY_PLAYER_COUNT');

    // Duplicate players in body
    const errDup = await http()
      .patch(`/api/v1/entries/${entryId}`)
      .set('Cookie', admin)
      .send({ players: [{ userId: p1 }, { userId: p1 }] })
      .expect(409);
    expect(errDup.body.error.code).toBe('ENTRY_DUPLICATE_PLAYER');

    // Unknown entry
    const fakeId = randomUUID();
    const errNotFound = await http()
      .patch(`/api/v1/entries/${fakeId}`)
      .set('Cookie', admin)
      .send({ players: [{ userId: p1 }, { userId: p2 }] })
      .expect(404);
    expect(errNotFound.body.error.code).toBe('ENTRY_NOT_FOUND');
  });
});
