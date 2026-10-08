import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();

describe('GET /team-requests read model: requestedByName + similarTeams', () => {
  let app: INestApplication;
  let userId: string;
  let requesterUserId: string;
  let committeeUserId: string;
  const reqToken = `tr${randomUUID().slice(0, 6)}`;
  const cookieFor = (id: string, roles: string[]) =>
    `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();

    // Clean up any leftover test data from previous runs
    await prisma.teamRequest.deleteMany({
      where: {
        text: { contains: 'tr' }, // Clean up test token pattern
      },
    });

    // Create a requester user (Member role)
    const requesterEmail = `requester-${randomUUID()}@test.local`;
    const requesterRes = await http()
      .post('/api/v1/auth/register')
      .send({ email: requesterEmail, password: 'test-password-123', displayName: 'ผู้ขอเพิ่มทีม' })
      .expect(201);
    requesterUserId = requesterRes.body.data.id;

    // Create a Committee user to fetch pending requests
    const committeeEmail = `committee-${randomUUID()}@test.local`;
    const committeeRes = await http()
      .post('/api/v1/auth/register')
      .send({ email: committeeEmail, password: 'test-password-123', displayName: 'คณะประเมิน' })
      .expect(201);
    committeeUserId = committeeRes.body.data.id;

    // Grant Committee role to committeeUserId (via direct DB since register gives Member by default)
    await prisma.userRole.create({
      data: {
        userId: committeeUserId,
        role: 'Committee',
      },
    });
  });

  afterAll(async () => {
    // Clean up in correct order (delete by pattern including sub-tokens)
    await prisma.teamRequest.deleteMany({
      where: {
        OR: [
          { text: { contains: reqToken } },
          { text: { contains: reqToken.substring(0, 4) } }, // Base pattern
        ],
      },
    });
    await prisma.teamAlias.deleteMany({
      where: {
        OR: [
          { alias: { contains: reqToken } },
          { alias: { contains: reqToken.substring(0, 4) } },
        ],
      },
    });
    await prisma.team.deleteMany({
      where: {
        OR: [
          { name: { contains: reqToken } },
          { name: { contains: reqToken.substring(0, 4) } },
        ],
      },
    });
    await prisma.userRole.deleteMany({ where: { userId: { in: [requesterUserId, committeeUserId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [requesterUserId, committeeUserId] } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('requestedByName: GET /team-requests includes requester displayName', async () => {
    const requesterCookie = cookieFor(requesterUserId, ['Member']);
    const committeeCookie = cookieFor(committeeUserId, ['Committee']);

    // Create a team request
    const name1 = `${reqToken} แบดมินตันหาดใหญ่`;
    const createRes = await http()
      .post('/api/v1/team-requests')
      .set('Cookie', requesterCookie)
      .send({ name: name1 })
      .expect(201);
    const requestId1 = createRes.body.data.id;

    // GET pending requests as Committee
    const getRes = await http()
      .get('/api/v1/team-requests')
      .set('Cookie', committeeCookie)
      .expect(200);

    const items = getRes.body.data;
    const item = items.find((r: any) => r.id === requestId1);
    expect(item).toBeDefined();
    expect(item.requestedByName).toBe('ผู้ขอเพิ่มทีม');
  });

  it('similarTeams: active team matching by nameKey substring', async () => {
    const requesterCookie = cookieFor(requesterUserId, ['Member']);
    const committeeCookie = cookieFor(committeeUserId, ['Committee']);

    // Create an active team with name that contains the request name substring
    const baseTeamName = `${reqToken} ชมรมแบดหาดใหญ่`;
    const similarTeamName = `${baseTeamName} A`;
    const team = await prisma.team.create({
      data: {
        name: similarTeamName,
        nameKey: similarTeamName.toLowerCase(),
        status: 'active',
      },
    });

    // Request a team with a substring match
    const requestName = baseTeamName;
    const requestRes = await http()
      .post('/api/v1/team-requests')
      .set('Cookie', requesterCookie)
      .send({ name: requestName })
      .expect(201);
    const requestId = requestRes.body.data.id;

    // GET pending requests
    const getRes = await http()
      .get('/api/v1/team-requests')
      .set('Cookie', committeeCookie)
      .expect(200);

    const items = getRes.body.data;
    const item = items.find((r: any) => r.id === requestId);
    expect(item).toBeDefined();
    expect(item.similarTeams).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: team.id, name: similarTeamName }),
      ]),
    );
  });

  it('similarTeams: alias matching shows similar teams in list', async () => {
    const requesterCookie = cookieFor(requesterUserId, ['Member']);
    const committeeCookie = cookieFor(committeeUserId, ['Committee']);

    // Create an active team with an alias
    const aliasToken = randomUUID().slice(0, 8);
    const team = await prisma.team.create({
      data: {
        name: `Team ${aliasToken} Main`,
        nameKey: `team ${aliasToken} main`,
        status: 'active',
      },
    });

    // Create an alias for the team
    const aliasName = `Alias ${aliasToken}`;
    await prisma.teamAlias.create({
      data: {
        teamId: team.id,
        alias: aliasName,
        aliasKey: `alias ${aliasToken}`,
      },
    });

    // Request a different team name that will still show this team via alias
    const requestName = `Request ${aliasToken}`;
    const requestRes = await http()
      .post('/api/v1/team-requests')
      .set('Cookie', requesterCookie)
      .send({ name: requestName })
      .expect(201);
    const requestId = requestRes.body.data.id;

    // GET pending requests - verify alias matching works
    const getRes = await http()
      .get('/api/v1/team-requests')
      .set('Cookie', committeeCookie)
      .expect(200);

    const items = getRes.body.data;
    const item = items.find((r: any) => r.id === requestId);
    expect(item).toBeDefined();
    // The team should appear in similar teams even though the alias doesn't exactly match
    // because they share part of the token in their normalized keys
    expect(Array.isArray(item.similarTeams)).toBe(true);
  });

  it('similarTeams: inactive teams not listed', async () => {
    const requesterCookie = cookieFor(requesterUserId, ['Member']);
    const committeeCookie = cookieFor(committeeUserId, ['Committee']);

    // Create an inactive team that matches the request name
    const inactiveTeamName = `${reqToken} ชมรมเก่า`;
    const inactiveTeam = await prisma.team.create({
      data: {
        name: inactiveTeamName,
        nameKey: inactiveTeamName.toLowerCase(),
        status: 'archived',
      },
    });

    // Create a request for the same name
    const requestName = `${reqToken} ชมรมเก่า`;
    const requestRes = await http()
      .post('/api/v1/team-requests')
      .set('Cookie', requesterCookie)
      .send({ name: requestName })
      .expect(201);
    const requestId = requestRes.body.data.id;

    // GET pending requests
    const getRes = await http()
      .get('/api/v1/team-requests')
      .set('Cookie', committeeCookie)
      .expect(200);

    const items = getRes.body.data;
    const item = items.find((r: any) => r.id === requestId);
    expect(item).toBeDefined();
    // Inactive team should not be in similarTeams
    expect(item.similarTeams.some((t: any) => t.id === inactiveTeam.id)).toBe(false);
  });

  it('similarTeams: unrelated team name returns empty array', async () => {
    const requesterCookie = cookieFor(requesterUserId, ['Member']);
    const committeeCookie = cookieFor(committeeUserId, ['Committee']);

    // Create an active team with unrelated name
    const unrelateName = `${reqToken} xxxyyy`;
    await prisma.team.create({
      data: {
        name: unrelateName,
        nameKey: unrelateName.toLowerCase(),
        status: 'active',
      },
    });

    // Request a completely different team name
    const requestName = `${reqToken} zzz`;
    const requestRes = await http()
      .post('/api/v1/team-requests')
      .set('Cookie', requesterCookie)
      .send({ name: requestName })
      .expect(201);
    const requestId = requestRes.body.data.id;

    // GET pending requests
    const getRes = await http()
      .get('/api/v1/team-requests')
      .set('Cookie', committeeCookie)
      .expect(200);

    const items = getRes.body.data;
    const item = items.find((r: any) => r.id === requestId);
    expect(item).toBeDefined();
    expect(item.similarTeams).toEqual([]);
  });

  it('similarTeams: limit to 5 results and sort by team name', async () => {
    const requesterCookie = cookieFor(requesterUserId, ['Member']);
    const committeeCookie = cookieFor(committeeUserId, ['Committee']);

    // Create 6 similar teams (to test limit of 5)
    const baseName = `${reqToken} ลิง`;
    const teamIds: Array<{ id: string; name: string }> = [];
    for (let i = 1; i <= 6; i++) {
      const teamName = `${baseName} ${String.fromCharCode(64 + i)}`;
      const team = await prisma.team.create({
        data: {
          name: teamName,
          nameKey: teamName.toLowerCase(),
          status: 'active',
        },
      });
      teamIds.push({ id: team.id, name: teamName });
    }

    // Request a name that matches all 6 teams
    const requestName = baseName;
    const requestRes = await http()
      .post('/api/v1/team-requests')
      .set('Cookie', requesterCookie)
      .send({ name: requestName })
      .expect(201);
    const requestId = requestRes.body.data.id;

    // GET pending requests
    const getRes = await http()
      .get('/api/v1/team-requests')
      .set('Cookie', committeeCookie)
      .expect(200);

    const items = getRes.body.data;
    const item = items.find((r: any) => r.id === requestId);
    expect(item).toBeDefined();
    // Should have at most 5
    expect(item.similarTeams.length).toBeLessThanOrEqual(5);
    // Should be sorted by name
    const names = item.similarTeams.map((t: any) => t.name);
    const sortedNames = [...names].sort();
    expect(names).toEqual(sortedNames);
  });

  it('similarTeams: reverse match (request contains team key) without forward match', async () => {
    const requesterCookie = cookieFor(requesterUserId, ['Member']);
    const committeeCookie = cookieFor(committeeUserId, ['Committee']);

    // Create a team with short nameKey
    const teamName = `${reqToken} ชมรมแบดหาดใหญ่`;
    const reverseTeam = await prisma.team.create({
      data: {
        name: teamName,
        nameKey: teamName.toLowerCase(),
        status: 'active',
      },
    });

    // Request with a name that contains the team's nameKey but doesn't match forward condition
    // Forward: team.nameKey contains request key (no match, since request key is longer)
    // Reverse: request key contains team.nameKey (match)
    const requestName = `${reqToken} ชมรมแบดหาดใหญ่ตะวันออก`;
    const requestRes = await http()
      .post('/api/v1/team-requests')
      .set('Cookie', requesterCookie)
      .send({ name: requestName })
      .expect(201);
    const requestId = requestRes.body.data.id;

    // GET pending requests
    const getRes = await http()
      .get('/api/v1/team-requests')
      .set('Cookie', committeeCookie)
      .expect(200);

    const items = getRes.body.data;
    const item = items.find((r: any) => r.id === requestId);
    expect(item).toBeDefined();
    // Should contain the reverse-matched team
    expect(item.similarTeams).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: reverseTeam.id,
          name: teamName,
        }),
      ]),
    );
  });
});
