import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();

describe('teams (bl-21 demo slice)', () => {
  let app: INestApplication;
  let userId: string;
  let teamToken: string;

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
    const email = `teams-${randomUUID()}@test.local`;
    const password = 'test-password-123';
    const reg = await http()
      .post('/api/v1/auth/register')
      .send({ email, password, displayName: 'Test User' })
      .expect(201);
    userId = reg.body.data.id;

    // Generate a unique token for test teams
    teamToken = `zq${randomUUID().slice(0, 6)}`;

    // Create test teams with unique names
    const team1 = await prisma.team.create({
      data: {
        name: `${teamToken} Falcon`,
        nameKey: `${teamToken} falcon`,
        status: 'active',
      },
    });

    const team2 = await prisma.team.create({
      data: {
        name: `${teamToken} Fortress`,
        nameKey: `${teamToken} fortress`,
        status: 'active',
      },
    });

    // Add an alias to team 1
    await prisma.teamAlias.create({
      data: {
        teamId: team1.id,
        alias: `${teamToken}ฟัลคอน`,
        aliasKey: `${teamToken}ฟัลคอน`,
      },
    });

    // Create an archived team (should not appear in suggestions)
    await prisma.team.create({
      data: {
        name: `${teamToken} Archived`,
        nameKey: `${teamToken} archived`,
        status: 'archived',
      },
    });
  });

  afterAll(async () => {
    // Delete in correct order: aliases first (FK constraint), then teams, then user
    await prisma.teamAlias.deleteMany({ where: { team: { nameKey: { startsWith: teamToken } } } });
    await prisma.team.deleteMany({ where: { nameKey: { startsWith: teamToken } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'teams-' } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('suggests active teams and their aliases for the type-ahead', async () => {
    const memberCookie = cookieFor(userId, ['Member']);

    // Test 1: Both teams, Falcon before Fortress (name order)
    const res1 = await http()
      .get(`/api/v1/teams/suggest?q=${teamToken}`)
      .set('Cookie', memberCookie)
      .expect(200);
    expect(res1.body.data).toHaveLength(2);
    expect(res1.body.data[0]).toMatchObject({
      teamId: res1.body.data[0].teamId,
      name: `${teamToken} Falcon`,
      matchedAlias: null,
      distance: 0,
    });
    expect(res1.body.data[1]).toMatchObject({
      teamId: res1.body.data[1].teamId,
      name: `${teamToken} Fortress`,
      matchedAlias: null,
      distance: 0,
    });

    // Test 2: Match by alias
    const res2 = await http()
      .get(`/api/v1/teams/suggest?q=${teamToken}ฟั`)
      .set('Cookie', memberCookie)
      .expect(200);
    // typo tolerance may also return '<token> Fortress' at distance 2 (shared 8-char prefix); the alias match is first
    expect(res2.body.data.slice(1).every((s: { distance: number }) => s.distance > 0)).toBe(true);
    expect(res2.body.data[0]).toMatchObject({
      name: `${teamToken} Falcon`,
      matchedAlias: `${teamToken}ฟัลคอน`,
      distance: 0,
    });

    // Test 3: Limit parameter
    const res3 = await http()
      .get(`/api/v1/teams/suggest?q=${teamToken}%20f&limit=1`)
      .set('Cookie', memberCookie)
      .expect(200);
    expect(res3.body.data).toHaveLength(1);
  });

  it('rejects unauthenticated requests', async () => {
    await http().get(`/api/v1/teams/suggest?q=${teamToken}`).expect(401);
  });

  it('validates the query parameter', async () => {
    const memberCookie = cookieFor(userId, ['Member']);
    await http().get('/api/v1/teams/suggest?q=').set('Cookie', memberCookie).expect(400);
  });

  it('never returns archived teams', async () => {
    const memberCookie = cookieFor(userId, ['Member']);
    const res = await http()
      .get(`/api/v1/teams/suggest?q=${teamToken}%20a`)
      .set('Cookie', memberCookie)
      .expect(200);
    // the archived team never appears (the active test teams may still match by typo distance)
    expect(res.body.data.map((t: { name: string }) => t.name)).not.toContain(`${teamToken} Archived`);
    expect(res.body.data.every((t: { name: string }) => !t.name.toLowerCase().endsWith('archived'))).toBe(true);
  });
});
