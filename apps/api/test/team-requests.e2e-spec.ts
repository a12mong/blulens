import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();

describe('team-requests (bl-21 demo slice)', () => {
  let app: INestApplication;
  let userId: string;
  let reqToken: string;

  const http = () => request(app.getHttpServer());

  const cookieFor = (id: string, roles: string[]) =>
    `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();

    // Register a test user via auth endpoint
    const email = `team-requests-${randomUUID()}@test.local`;
    const password = 'test-password-123';
    const reg = await http()
      .post('/api/v1/auth/register')
      .send({ email, password, displayName: 'Test User' })
      .expect(201);
    userId = reg.body.data.id;

    // Generate a unique token for test requests
    reqToken = `zr${randomUUID().slice(0, 6)}`;
  });

  afterAll(async () => {
    // Delete in correct order: team_requests first (FK), then aliases, then teams, then user
    await prisma.teamRequest.deleteMany({ where: { text: { startsWith: reqToken } } });
    await prisma.teamAlias.deleteMany({ where: { alias: { startsWith: reqToken } } });
    await prisma.team.deleteMany({ where: { name: { startsWith: reqToken } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'team-requests-' } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('creates a team request unless the team or a pending request already exists', async () => {
    const memberCookie = cookieFor(userId, ['Member']);

    // Test 1: Create a valid request with trimmed name
    const name1 = `  ${reqToken} Eagles `;
    const res1 = await http()
      .post('/api/v1/team-requests')
      .set('Cookie', memberCookie)
      .send({ name: name1 })
      .expect(201);
    expect(res1.body.data).toMatchObject({
      name: `${reqToken} Eagles`,
      status: 'pending',
      teamId: null,
    });
    const requestId1 = res1.body.data.id;

    // Test 2: Same name with different spacing/case → 409 TEAM_REQUEST_PENDING
    const name2 = `${reqToken}  EAGLES`;
    const res2 = await http()
      .post('/api/v1/team-requests')
      .set('Cookie', memberCookie)
      .send({ name: name2 })
      .expect(409);
    expect(res2.body.error.code).toBe('TEAM_REQUEST_PENDING');
    expect(res2.body.error.details.requestId).toBe(requestId1);

    // Test 3: Create a team, then POST the same name → 409 TEAM_EXISTS
    const team = await prisma.team.create({
      data: {
        name: `${reqToken} Hawks`,
        nameKey: `${reqToken} hawks`,
        status: 'active',
      },
    });
    const res3 = await http()
      .post('/api/v1/team-requests')
      .set('Cookie', memberCookie)
      .send({ name: `${reqToken} hawks` })
      .expect(409);
    expect(res3.body.error.code).toBe('TEAM_EXISTS');
    expect(res3.body.error.details.teamId).toBe(team.id);
    expect(res3.body.error.details.name).toBe(`${reqToken} Hawks`);

    // Test 4: Create an alias, then POST the alias → 409 TEAM_EXISTS
    await prisma.teamAlias.create({
      data: {
        teamId: team.id,
        alias: `${reqToken}ฮอว์ก`,
        aliasKey: `${reqToken}ฮอว์ก`,
      },
    });
    const res4 = await http()
      .post('/api/v1/team-requests')
      .set('Cookie', memberCookie)
      .send({ name: `${reqToken}ฮอว์ก` })
      .expect(409);
    expect(res4.body.error.code).toBe('TEAM_EXISTS');
    expect(res4.body.error.details.teamId).toBe(team.id);
  });

  it('GET /team-requests requires Committee or Admin role', async () => {
    const memberCookie = cookieFor(userId, ['Member']);
    const committeeCookie = cookieFor(userId, ['Committee']);

    // Member GET → 403
    await http().get('/api/v1/team-requests').set('Cookie', memberCookie).expect(403);

    // Committee GET → 200
    const res = await http()
      .get('/api/v1/team-requests')
      .set('Cookie', committeeCookie)
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('rejects unauthenticated requests', async () => {
    await http().post('/api/v1/team-requests').send({ name: 'test' }).expect(401);
    await http().get('/api/v1/team-requests').expect(401);
  });
});
