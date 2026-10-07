import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

describe('tournaments + events (bl-21 slice)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const committee = cookieFor(randomUUID(), ['Committee']);
  const member = cookieFor(randomUUID(), ['Member']);
  const tag = `zz-${randomUUID().slice(0, 8)}`;
  const created: string[] = [];

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await prisma.event.deleteMany({ where: { tournamentId: { in: created } } });
    await prisma.tournament.deleteMany({ where: { id: { in: created } } });
    await prisma.$disconnect();
    await app.close();
  });

  const newTournament = async () => {
    const res = await http()
      .post('/api/v1/tournaments')
      .set('Cookie', committee)
      .send({ name: `${tag} Open`, venue: 'สนาม 1', startsOn: '2026-12-05', entriesCloseAt: '2026-11-30T17:00:00Z' })
      .expect(201);
    created.push(res.body.data.id);
    return res.body.data as { id: string; status: string };
  };

  it('lets the Committee create a draft tournament with an event; drafts stay hidden from Guests and Members', async () => {
    const t = await newTournament();
    expect(t.status).toBe('draft');

    const ev = await http()
      .post(`/api/v1/tournaments/${t.id}/events`)
      .set('Cookie', committee)
      .send({ discipline: 'MD', gradeMin: 'S-', gradeMax: 'S+' })
      .expect(201);
    expect(ev.body.data).toMatchObject({ tournamentId: t.id, discipline: 'MD', gradeMin: 'S-', gradeMax: 'S+', minReviewers: 2, requiresFreshAssessment: false });

    await http().get(`/api/v1/tournaments/${t.id}`).expect(404);
    await http().get(`/api/v1/tournaments/${t.id}`).set('Cookie', member).expect(404);
    const detail = await http().get(`/api/v1/tournaments/${t.id}`).set('Cookie', committee).expect(200);
    expect(detail.body.data.events).toHaveLength(1);

    const dup = await http()
      .post(`/api/v1/tournaments/${t.id}/events`)
      .set('Cookie', committee)
      .send({ discipline: 'MD', gradeMin: 'S-', gradeMax: 'S+' })
      .expect(409);
    expect(dup.body.error.code).toBe('EVENT_DUPLICATE');
  });

  it('moves draft -> open -> closed and rejects skipping or going back', async () => {
    const t = await newTournament();
    const bad = await http().post(`/api/v1/tournaments/${t.id}/status`).set('Cookie', committee).send({ to: 'running' }).expect(409);
    expect(bad.body.error.code).toBe('TOURNAMENT_INVALID_TRANSITION');

    const open = await http().post(`/api/v1/tournaments/${t.id}/status`).set('Cookie', committee).send({ to: 'open' }).expect(200);
    expect(open.body.data.status).toBe('open');
    // now public
    await http().get(`/api/v1/tournaments/${t.id}`).expect(200);
    const list = await http().get('/api/v1/tournaments?limit=100').expect(200);
    expect(list.body.data.items.map((x: { id: string }) => x.id)).toContain(t.id);

    await http().post(`/api/v1/tournaments/${t.id}/status`).set('Cookie', committee).send({ to: 'closed' }).expect(200);
    await http().post(`/api/v1/tournaments/${t.id}/status`).set('Cookie', committee).send({ to: 'open' }).expect(409);
    expect(await prisma.auditLog.count({ where: { action: 'tournament.status', entityId: t.id } })).toBe(2);
  });

  it('serves event detail with tournament status and entry count, and validates input', async () => {
    const t = await newTournament();
    await http().post(`/api/v1/tournaments/${t.id}/status`).set('Cookie', committee).send({ to: 'open' }).expect(200);
    const ev = await http()
      .post(`/api/v1/tournaments/${t.id}/events`)
      .set('Cookie', committee)
      .send({ discipline: 'XD', gradeMin: 'BG1', gradeMax: 'S', maxEntries: 32, minReviewers: 3 })
      .expect(201);
    const detail = await http().get(`/api/v1/events/${ev.body.data.id}`).expect(200);
    expect(detail.body.data).toMatchObject({ tournamentName: `${tag} Open`, tournamentStatus: 'open', entryCount: 0, maxEntries: 32, minReviewers: 3 });

    const inverted = await http()
      .post(`/api/v1/tournaments/${t.id}/events`)
      .set('Cookie', committee)
      .send({ discipline: 'MS', gradeMin: 'N', gradeMax: 'S' })
      .expect(400);
    expect(inverted.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('allows only the Committee to write', async () => {
    await http().post('/api/v1/tournaments').send({ name: 'x', startsOn: '2026-12-05', entriesCloseAt: '2026-11-30T17:00:00Z' }).expect(401);
    const res = await http()
      .post('/api/v1/tournaments')
      .set('Cookie', cookieFor(randomUUID(), ['Admin']))
      .send({ name: 'x', startsOn: '2026-12-05', entriesCloseAt: '2026-11-30T17:00:00Z' })
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
