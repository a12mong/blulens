import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

/**
 * bl-21 demo slice: Admin creates a doubles entry -> forward -> Committee approves / rejects (architecture §6.10).
 * Graded test users cannot be deleted (assessment results are append-only), so they get NO roles (never in the
 * Member picker) and are disabled in afterAll; everything else is deleted.
 */

const prisma = new PrismaClient();
const tag = `zz-e2e-${randomUUID().slice(0, 6)}`;
const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

const adminCommittee = cookieFor(randomUUID(), ['Admin', 'Committee']);
const committee = cookieFor(randomUUID(), ['Committee']);
const admin = cookieFor(randomUUID(), ['Admin']);

const userIds: string[] = [];
const teamIds: string[] = [];
const tournamentIds: string[] = [];

async function player(name: string, gradeIndex: number | null, teams: string[] = []) {
  const u = await prisma.user.create({ data: { email: `${tag}-${name}@test.local`, passwordHash: 'x', displayName: `${tag} ${name}` } });
  userIds.push(u.id);
  for (const teamId of teams) await prisma.teamMembership.create({ data: { userId: u.id, teamId } });
  if (gradeIndex !== null) {
    const a = await prisma.assessment.create({ data: { subjectUserId: u.id, status: 'overridden' } });
    await prisma.assessmentResult.create({
      data: {
        assessmentId: a.id, version: 1, source: 'override', status: 'overridden', score: gradeIndex + 0.5, margin: 0,
        lowerIndex: gradeIndex, centerIndex: gradeIndex, upperIndex: gradeIndex, kind: 'exact', label: `g${gradeIndex}`,
        nRaters: 0, methodVersion: 'grading-v1', inputs: {}, reason: 'e2e fixture grade for entries test',
      },
    });
  }
  return u.id;
}

async function team(name: string) {
  const t = await prisma.team.create({ data: { name: `${tag} ${name}`, nameKey: `${tag} ${name}`.toLowerCase() } });
  teamIds.push(t.id);
  return t.id;
}

describe('entries (bl-21 demo slice)', () => {
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

    const t = await http().post('/api/v1/tournaments').set('Cookie', committee)
      .send({ name: `${tag} Cup`, startsOn: '2026-12-05', entriesCloseAt: '2026-11-30T17:00:00Z' }).expect(201);
    tournamentId = t.body.data.id;
    tournamentIds.push(tournamentId);
    const ev = await http().post(`/api/v1/tournaments/${tournamentId}/events`).set('Cookie', committee)
      .send({ discipline: 'MD', gradeMin: 'S-', gradeMax: 'N' }).expect(201);
    eventId = ev.body.data.id;
  });

  afterAll(async () => {
    await prisma.entry.deleteMany({ where: { eventId } });
    await prisma.event.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
    await prisma.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
    await prisma.teamMembership.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.team.deleteMany({ where: { id: { in: teamIds } } });
    await prisma.user.updateMany({ where: { id: { in: userIds } }, data: { status: 'disabled' } });
    await prisma.$disconnect();
    await app.close();
  });

  it('runs the slice: Admin creates a doubles entry, forwards it, the Committee approves it, Guests see it', async () => {
    const blue = await team('Blue');
    const p1 = await player('p1', 7); // S
    const p2 = await player('p2', 9); // N-

    // entries open only when the tournament is open
    const closed = await http().post(`/api/v1/events/${eventId}/entries`).set('Cookie', adminCommittee)
      .send({ players: [{ userId: p1 }, { userId: p2 }] }).expect(409);
    expect(closed.body.error.code).toBe('ENTRIES_CLOSED');
    await http().post(`/api/v1/tournaments/${tournamentId}/status`).set('Cookie', committee).send({ to: 'open' }).expect(200);

    const created = await http().post(`/api/v1/events/${eventId}/entries`).set('Cookie', adminCommittee)
      .send({ name: 'คู่ฟ้าใส', players: [{ userId: p1, teamId: blue }, { userId: p2 }] }).expect(201);
    const entry = created.body.data;
    expect(entry).toMatchObject({ status: 'draft', name: 'คู่ฟ้าใส', warnings: [], gradeVisibility: 'hidden', seedScore: 8.5 });
    const first = entry.players.find((p: { userId: string }) => p.userId === p1);
    expect(first).toMatchObject({ teamId: blue, teamIds: [blue], teamCount: 1, grade: { center: 'S', label: 'g7' } });

    const fwd = await http().post(`/api/v1/entries/${entry.id}/forward`).set('Cookie', admin).expect(200);
    expect(fwd.body.data.status).toBe('pending_committee');
    expect((await http().post(`/api/v1/entries/${entry.id}/forward`).set('Cookie', admin).expect(409)).body.error.code).toBe('ENTRY_NOT_DRAFT');

    const queue = await http().get(`/api/v1/entries?status=pending_committee&eventId=${eventId}`).set('Cookie', committee).expect(200);
    expect(queue.body.data.items.map((e: { id: string }) => e.id)).toEqual([entry.id]);

    // Admin alone may not decide; the Committee may
    await http().post(`/api/v1/entries/${entry.id}/approve`).set('Cookie', admin).send({}).expect(403);
    const ok = await http().post(`/api/v1/entries/${entry.id}/approve`).set('Cookie', committee).send({}).expect(200);
    expect(ok.body.data).toMatchObject({ status: 'approved', decisionReason: null });

    const guest = await http().get(`/api/v1/events/${eventId}/entries`).expect(200);
    expect(guest.body.data).toHaveLength(1);
    expect(guest.body.data[0]).toMatchObject({ id: entry.id, seedScore: null, warnings: [] });
    expect(guest.body.data[0].players.every((p: { grade: unknown }) => p.grade === null)).toBe(true);
    expect(await prisma.auditLog.count({ where: { entityId: entry.id, action: { in: ['entry.create', 'entry.forward', 'entry.approve'] } } })).toBe(3);
  });

  it('warns but never blocks creation; approval rules for ungraded and out-of-band players', async () => {
    const red = await team('Red');
    const green = await team('Green');
    const multi = await player('multi', 8, [red, green]);
    const ungraded = await player('ungraded', null);
    const pro = await player('pro', 13); // P, above the S-..N band
    const ok = await player('ok', 8);

    const e1 = (await http().post(`/api/v1/events/${eventId}/entries`).set('Cookie', adminCommittee)
      .send({ players: [{ userId: multi }, { userId: ungraded }] }).expect(201)).body.data;
    expect(e1.warnings).toEqual(['MULTI_TEAM', 'NO_APPROVED_GRADE']);
    await http().post(`/api/v1/entries/${e1.id}/forward`).set('Cookie', adminCommittee).expect(200);
    expect((await http().post(`/api/v1/entries/${e1.id}/approve`).set('Cookie', committee).send({}).expect(409)).body.error.code)
      .toBe('ENTRY_PLAYER_UNGRADED');
    const rej = await http().post(`/api/v1/entries/${e1.id}/reject`).set('Cookie', committee).send({ reason: 'ผู้เล่นยังไม่มีเกรด' }).expect(200);
    expect(rej.body.data).toMatchObject({ status: 'rejected', decisionReason: 'ผู้เล่นยังไม่มีเกรด' });

    const e2 = (await http().post(`/api/v1/events/${eventId}/entries`).set('Cookie', adminCommittee)
      .send({ players: [{ userId: pro }, { userId: ok }] }).expect(201)).body.data;
    expect(e2.warnings).toEqual(['GRADE_OUT_OF_BAND']);
    await http().post(`/api/v1/entries/${e2.id}/forward`).set('Cookie', adminCommittee).expect(200);
    expect((await http().post(`/api/v1/entries/${e2.id}/approve`).set('Cookie', committee).send({}).expect(409)).body.error.code)
      .toBe('ENTRY_OUT_OF_BAND_REASON_REQUIRED');
    await http().post(`/api/v1/entries/${e2.id}/approve`).set('Cookie', committee)
      .send({ reason: 'เคยแข่งในช่วงเกรดนี้มาก่อนและคณะกรรมการรับรองแล้ว' }).expect(200);
  });

  it('blocks approval while an event requiring a fresh assessment has a player without one (A13)', async () => {
    const ev = await http().post(`/api/v1/tournaments/${tournamentId}/events`).set('Cookie', committee)
      .send({ discipline: 'WD', gradeMin: 'S-', gradeMax: 'N', requiresFreshAssessment: true }).expect(201);
    const x = await player('fresh-x', 8);
    const y = await player('fresh-y', 8);
    const e = (await http().post(`/api/v1/events/${ev.body.data.id}/entries`).set('Cookie', adminCommittee)
      .send({ players: [{ userId: x }, { userId: y }] }).expect(201)).body.data;
    expect(e.warnings).toEqual(['FRESH_ASSESSMENT_REQUIRED']);
    await http().post(`/api/v1/entries/${e.id}/forward`).set('Cookie', adminCommittee).expect(200);
    expect((await http().post(`/api/v1/entries/${e.id}/approve`).set('Cookie', committee).send({}).expect(409)).body.error.code)
      .toBe('ENTRY_FRESH_ASSESSMENT_MISSING');
    await prisma.entry.deleteMany({ where: { eventId: ev.body.data.id } });
  });

  it('enforces player count, duplicate players and roles', async () => {
    const a = await player('a', 8);
    const b = await player('b', 8);
    const c = await player('c', 8);
    expect((await http().post(`/api/v1/events/${eventId}/entries`).set('Cookie', adminCommittee)
      .send({ players: [{ userId: a }] }).expect(409)).body.error.code).toBe('ENTRY_PLAYER_COUNT');
    expect((await http().post(`/api/v1/events/${eventId}/entries`).set('Cookie', adminCommittee)
      .send({ players: [{ userId: a }, { userId: a }] }).expect(409)).body.error.code).toBe('ENTRY_DUPLICATE_PLAYER');
    await http().post(`/api/v1/events/${eventId}/entries`).set('Cookie', adminCommittee).send({ players: [{ userId: a }, { userId: b }] }).expect(201);
    expect((await http().post(`/api/v1/events/${eventId}/entries`).set('Cookie', adminCommittee)
      .send({ players: [{ userId: a }, { userId: c }] }).expect(409)).body.error.code).toBe('ENTRY_DUPLICATE_PLAYER');
    await http().post(`/api/v1/events/${eventId}/entries`).set('Cookie', cookieFor(randomUUID(), ['Member']))
      .send({ players: [{ userId: b }, { userId: c }] }).expect(403);
  });
});
