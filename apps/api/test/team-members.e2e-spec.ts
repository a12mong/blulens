import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient, type Team, type User } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

describe('POST /api/v1/teams/:teamId/members (bl-21-5)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const PREFIX = `tm-${randomUUID().slice(0, 8)}-`;
  const today = new Date().toISOString().slice(0, 10);

  let user: User;
  let team1: Team;
  let team2: Team;
  let archivedTeam: Team;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();

    user = await prisma.user.create({
      data: {
        email: `${PREFIX}user@test.local`,
        passwordHash: 'dummy',
        displayName: `${PREFIX}Player`,
        status: 'active',
      },
    });

    team1 = await prisma.team.create({
      data: {
        name: `${PREFIX}Club One`,
        nameKey: `${PREFIX}club-one`,
        status: 'active',
      },
    });

    team2 = await prisma.team.create({
      data: {
        name: `${PREFIX}Club Two`,
        nameKey: `${PREFIX}club-two`,
        status: 'active',
      },
    });

    archivedTeam = await prisma.team.create({
      data: {
        name: `${PREFIX}Archived Club`,
        nameKey: `${PREFIX}archived-club`,
        status: 'archived',
      },
    });
  });

  afterAll(async () => {
    await prisma.teamMembership.deleteMany({
      where: { userId: user.id },
    });
    await prisma.team.deleteMany({
      where: { id: { in: [team1.id, team2.id, archivedTeam.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: user.id },
    });
    await prisma.$disconnect();
    await app.close();
  });

  it('adds dated memberships, allows several clubs, rejects a duplicate', async () => {
    const committeeCookie = cookieFor(randomUUID(), ['Committee']);

    // 1. Add user to team1 (validFrom today) -> 201, teamCount 1
    const res1 = await http()
      .post(`/api/v1/teams/${team1.id}/members`)
      .set('Cookie', committeeCookie)
      .send({ userId: user.id, validFrom: today })
      .expect(201);

    expect(res1.body.success).toBe(true);
    expect(res1.body.data).toMatchObject({
      userId: user.id,
      teamId: team1.id,
      validFrom: today,
      teamCount: 1,
    });
    expect(res1.body.data.id).toBeDefined();

    // 2. Add user to team2 -> 201, teamCount 2
    const res2 = await http()
      .post(`/api/v1/teams/${team2.id}/members`)
      .set('Cookie', committeeCookie)
      .send({ userId: user.id, validFrom: today })
      .expect(201);

    expect(res2.body.success).toBe(true);
    expect(res2.body.data).toMatchObject({
      userId: user.id,
      teamId: team2.id,
      validFrom: today,
      teamCount: 2,
    });

    // 3. Add user to team1 again -> 409 MEMBERSHIP_EXISTS
    const resDup = await http()
      .post(`/api/v1/teams/${team1.id}/members`)
      .set('Cookie', committeeCookie)
      .send({ userId: user.id, validFrom: today })
      .expect(409);

    expect(resDup.body.success).toBe(false);
    expect(resDup.body.error.code).toBe('MEMBERSHIP_EXISTS');
    expect(resDup.body.error.message).toBe('ผู้เล่นอยู่ในทีมนี้แล้ว');

    // Verify audit log entries were recorded
    const audits = await prisma.auditLog.findMany({
      where: { action: 'team.member_add', entityId: { in: [team1.id, team2.id] } },
    });
    expect(audits.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects adding to an archived team with 404 TEAM_NOT_FOUND', async () => {
    const committeeCookie = cookieFor(randomUUID(), ['Committee']);
    const res = await http()
      .post(`/api/v1/teams/${archivedTeam.id}/members`)
      .set('Cookie', committeeCookie)
      .send({ userId: user.id, validFrom: today })
      .expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('TEAM_NOT_FOUND');
    expect(res.body.error.message).toBe('ไม่พบทีมที่ต้องการ');
  });

  it('rejects adding an unknown user with 404 USER_NOT_FOUND', async () => {
    const committeeCookie = cookieFor(randomUUID(), ['Committee']);
    const unknownUserId = randomUUID();
    const res = await http()
      .post(`/api/v1/teams/${team1.id}/members`)
      .set('Cookie', committeeCookie)
      .send({ userId: unknownUserId, validFrom: today })
      .expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
    expect(res.body.error.message).toBe('ไม่พบผู้ใช้ที่ต้องการ');
  });

  it('rejects Member cookie with 403 FORBIDDEN', async () => {
    const memberCookie = cookieFor(randomUUID(), ['Member']);
    const res = await http()
      .post(`/api/v1/teams/${team1.id}/members`)
      .set('Cookie', memberCookie)
      .send({ userId: user.id, validFrom: today })
      .expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects unauthenticated caller with 401 UNAUTHENTICATED', async () => {
    const res = await http()
      .post(`/api/v1/teams/${team1.id}/members`)
      .send({ userId: user.id, validFrom: today })
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects invalid date format with 400 VALIDATION_FAILED', async () => {
    const committeeCookie = cookieFor(randomUUID(), ['Committee']);
    const res = await http()
      .post(`/api/v1/teams/${team1.id}/members`)
      .set('Cookie', committeeCookie)
      .send({ userId: user.id, validFrom: '2026-13-01' })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});
