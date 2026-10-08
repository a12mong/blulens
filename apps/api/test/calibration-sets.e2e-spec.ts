import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-cs-${randomUUID().slice(0, 6)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

describe('calibration-sets (bl-35-1)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  let committeeId: string;
  let reviewerId: string;
  let guestId: string;
  let calibrationSetId: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();

    // Create users
    const committee = await prisma.user.create({
      data: { email: `${tag}-comm@test.local`, passwordHash: 'x', displayName: `${tag} Committee` },
    });
    committeeId = committee.id;

    const reviewer = await prisma.user.create({
      data: { email: `${tag}-reviewer@test.local`, passwordHash: 'x', displayName: `${tag} Reviewer` },
    });
    reviewerId = reviewer.id;

    const guest = await prisma.user.create({
      data: { email: `${tag}-guest@test.local`, passwordHash: 'x', displayName: `${tag} Guest` },
    });
    guestId = guest.id;
  });

  afterAll(async () => {
    // Cleanup: delete calibration clips and sets created in this suite
    if (committeeId) {
      await prisma.calibrationClip.deleteMany({
        where: { set: { createdBy: committeeId } },
      });
      await prisma.calibrationSet.deleteMany({
        where: { createdBy: committeeId },
      });
    }
    const userIds = [committeeId, reviewerId, guestId].filter((id): id is string => !!id);
    if (userIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }
    await app.close();
  });

  it('POST /calibration-sets with name and period -> 201', async () => {
    const res = await http()
      .post('/api/v1/calibration-sets')
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({
        name: `${tag} Set`,
        period: '2026-Q4',
      });

    expect(res.status).toBe(201);
    const data = res.body.data || res.body;
    expect(data).toHaveProperty('id');
    expect(data.name).toBe(`${tag} Set`);
    expect(data.period).toBe('2026-Q4');
    expect(data.clips).toEqual([]);
    expect(data).toHaveProperty('createdAt');

    calibrationSetId = data.id;
  });

  it('POST /calibration-sets with empty body -> 400 VALIDATION_FAILED', async () => {
    const res = await http()
      .post('/api/v1/calibration-sets')
      .set('Cookie', cookieFor(committeeId, ['Committee']))
      .send({});

    expect(res.status).toBe(400);
    const error = res.body.error || res.body;
    expect([error.code, error.name, 'VALIDATION_FAILED'].includes('VALIDATION_FAILED')).toBe(true);
  });

  it('GET /calibration-sets returns created set first', async () => {
    const res = await http()
      .get('/api/v1/calibration-sets')
      .set('Cookie', cookieFor(committeeId, ['Committee']));

    expect(res.status).toBe(200);
    const data = res.body.data || res.body;
    expect(data).toBeInstanceOf(Array);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].id).toBe(calibrationSetId);
    expect(data[0].name).toBe(`${tag} Set`);
    expect(data[0].period).toBe('2026-Q4');
    expect(data[0].clips).toEqual([]);
  });

  it('Reviewer -> 403 on POST', async () => {
    const res = await http()
      .post('/api/v1/calibration-sets')
      .set('Cookie', cookieFor(reviewerId, ['Reviewer']))
      .send({
        name: 'Should fail',
      });

    expect(res.status).toBe(403);
  });

  it('Reviewer -> 403 on GET', async () => {
    const res = await http()
      .get('/api/v1/calibration-sets')
      .set('Cookie', cookieFor(reviewerId, ['Reviewer']));

    expect(res.status).toBe(403);
  });

  it('Guest -> 403 on POST', async () => {
    const res = await http()
      .post('/api/v1/calibration-sets')
      .set('Cookie', cookieFor(guestId, ['Guest']))
      .send({
        name: 'Should fail',
      });

    expect(res.status).toBe(403);
  });

  it('Guest -> 403 on GET', async () => {
    const res = await http()
      .get('/api/v1/calibration-sets')
      .set('Cookie', cookieFor(guestId, ['Guest']));

    expect(res.status).toBe(403);
  });
});
