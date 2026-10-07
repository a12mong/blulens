import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();

describe('team-request-resolve (bl-21 demo slice)', () => {
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

    // Register a test user
    const email = `team-request-resolve-${randomUUID()}@test.local`;
    const password = 'test-password-123';
    const reg = await http()
      .post('/api/v1/auth/register')
      .send({ email, password, displayName: 'Test User' })
      .expect(201);
    userId = reg.body.data.id;

    reqToken = `zs${randomUUID().slice(0, 6)}`;
  });

  afterAll(async () => {
    // Delete in correct order
    await prisma.teamRequest.deleteMany({ where: { text: { startsWith: reqToken } } });
    await prisma.teamAlias.deleteMany({ where: { alias: { startsWith: reqToken } } });
    await prisma.team.deleteMany({ where: { name: { startsWith: reqToken } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'team-request-resolve-' } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('resolves a request into a new team or an alias that the type-ahead then finds', async () => {
    const committeeCookie = cookieFor(userId, ['Committee']);

    // Case 1: Create a team request
    const req1 = await http()
      .post('/api/v1/team-requests')
      .set('Cookie', committeeCookie)
      .send({ name: `${reqToken} Tigers` })
      .expect(201);
    const requestId1 = req1.body.data.id;

    // Resolve it by creating a new team
    const res1 = await http()
      .post(`/api/v1/team-requests/${requestId1}/resolve`)
      .set('Cookie', committeeCookie)
      .send({ action: 'create_team' })
      .expect(200);
    expect(res1.body.data.status).toBe('created');
    expect(res1.body.data.teamId).toBeTruthy();
    const createdTeamId = res1.body.data.teamId;

    // Verify the team appears in type-ahead
    const suggest1 = await http()
      .get(`/api/v1/teams/suggest?q=${reqToken}`)
      .set('Cookie', committeeCookie)
      .expect(200);
    expect(suggest1.body.data).toContainEqual(
      expect.objectContaining({
        teamId: createdTeamId,
        name: `${reqToken} Tigers`,
        matchedAlias: null,
      }),
    );

    // Case 2: Create another request and resolve it as an alias
    const req2 = await http()
      .post('/api/v1/team-requests')
      .set('Cookie', committeeCookie)
      .send({ name: `${reqToken}ไทเกอร์` })
      .expect(201);
    const requestId2 = req2.body.data.id;

    // Resolve it by aliasing to the created team
    const res2 = await http()
      .post(`/api/v1/team-requests/${requestId2}/resolve`)
      .set('Cookie', committeeCookie)
      .send({ action: 'alias_to_team', teamId: createdTeamId })
      .expect(200);
    expect(res2.body.data.status).toBe('aliased');
    expect(res2.body.data.teamId).toBe(createdTeamId);

    // Verify the alias appears in type-ahead
    const suggest2 = await http()
      .get(`/api/v1/teams/suggest?q=${reqToken}ไท`)
      .set('Cookie', committeeCookie)
      .expect(200);
    expect(suggest2.body.data).toContainEqual(
      expect.objectContaining({
        teamId: createdTeamId,
        name: `${reqToken} Tigers`,
        matchedAlias: `${reqToken}ไทเกอร์`,
      }),
    );
  });

  it('validates resolve actions and permissions', async () => {
    const committeeCookie = cookieFor(userId, ['Committee']);
    const memberCookie = cookieFor(userId, ['Member']);

    // Create a request
    const req = await http()
      .post('/api/v1/team-requests')
      .set('Cookie', committeeCookie)
      .send({ name: `${reqToken} Lions` })
      .expect(201);
    const requestId = req.body.data.id;

    // Member cannot resolve
    await http()
      .post(`/api/v1/team-requests/${requestId}/resolve`)
      .set('Cookie', memberCookie)
      .send({ action: 'create_team' })
      .expect(403);

    // alias_to_team without teamId -> 400
    await http()
      .post(`/api/v1/team-requests/${requestId}/resolve`)
      .set('Cookie', committeeCookie)
      .send({ action: 'alias_to_team' })
      .expect(400);

    // reject without reason -> 400
    await http()
      .post(`/api/v1/team-requests/${requestId}/resolve`)
      .set('Cookie', committeeCookie)
      .send({ action: 'reject', reason: 'no' })
      .expect(400);

    // reject with valid reason -> 200
    await http()
      .post(`/api/v1/team-requests/${requestId}/resolve`)
      .set('Cookie', committeeCookie)
      .send({ action: 'reject', reason: 'invalid team name' })
      .expect(200);

    // Try to resolve again -> 409
    await http()
      .post(`/api/v1/team-requests/${requestId}/resolve`)
      .set('Cookie', committeeCookie)
      .send({ action: 'create_team' })
      .expect(409);
  });
});
