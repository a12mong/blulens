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

describe('GET /api/v1/users (bl-21-2)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const PREFIX = `zz-${randomUUID().slice(0, 8)}-`;
  let teamAId: string;
  let teamBId: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();

    // Create 2 test teams
    const teamA = await prisma.team.create({
      data: {
        name: `${PREFIX}Team Alpha`,
        nameKey: `${PREFIX}team-alpha`,
      },
    });
    const teamB = await prisma.team.create({
      data: {
        name: `${PREFIX}Team Beta`,
        nameKey: `${PREFIX}team-beta`,
      },
    });
    teamAId = teamA.id;
    teamBId = teamB.id;

    // 1. User with 2 active teams
    await prisma.user.create({
      data: {
        email: `${PREFIX}alice@test.local`,
        passwordHash: 'dummy',
        displayName: `${PREFIX}Alice`,
        roles: { create: [{ role: 'Member' }] },
        memberships: {
          create: [{ teamId: teamAId }, { teamId: teamBId }],
        },
      },
    });

    // 2. User with 1 active team and 1 expired team
    await prisma.user.create({
      data: {
        email: `${PREFIX}bob@test.local`,
        passwordHash: 'dummy',
        displayName: `${PREFIX}Bob`,
        roles: { create: [{ role: 'Member' }] },
        memberships: {
          create: [
            { teamId: teamAId },
            {
              teamId: teamBId,
              validFrom: new Date(Date.now() - 120_000),
              validTo: new Date(Date.now() - 60_000),
            },
          ],
        },
      },
    });

    // 3. User with no teams
    await prisma.user.create({
      data: {
        email: `${PREFIX}charlie@test.local`,
        passwordHash: 'dummy',
        displayName: `${PREFIX}Charlie`,
        roles: { create: [{ role: 'Member' }] },
      },
    });

    // 4. User with same prefix but role Admin (should not match role=Member)
    await prisma.user.create({
      data: {
        email: `${PREFIX}david@test.local`,
        passwordHash: 'dummy',
        displayName: `${PREFIX}David`,
        roles: { create: [{ role: 'Admin' }] },
      },
    });

    // 5. User with different prefix (should not match q=PREFIX)
    await prisma.user.create({
      data: {
        email: `other-${PREFIX}eve@test.local`,
        passwordHash: 'dummy',
        displayName: `other-${PREFIX}Eve`,
        roles: { create: [{ role: 'Member' }] },
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        OR: [
          { displayName: { startsWith: PREFIX } },
          { displayName: { startsWith: `other-${PREFIX}` } },
        ],
      },
    });
    if (teamAId && teamBId) {
      await prisma.team.deleteMany({
        where: { id: { in: [teamAId, teamBId] } },
      });
    }
    await prisma.$disconnect();
    await app.close();
  });

  it('lets the Committee page through Members by name prefix with current team ids', async () => {
    const committeeCookie = cookieFor(randomUUID(), ['Committee']);

    // Page 1: limit 2
    const res1 = await http()
      .get(`/api/v1/users?role=Member&q=${PREFIX}&limit=2`)
      .set('Cookie', committeeCookie)
      .expect(200);

    expect(res1.body.success).toBe(true);
    expect(res1.body.data.items).toHaveLength(2);

    const [alice, bob] = res1.body.data.items;
    // Sorted by displayName ascending
    expect(alice.displayName).toBe(`${PREFIX}Alice`);
    expect(alice.roles).toEqual(['Member']);
    // Alice has two current teams
    expect(alice.teamIds).toHaveLength(2);
    expect(alice.teamIds).toContain(teamAId);
    expect(alice.teamIds).toContain(teamBId);

    expect(bob.displayName).toBe(`${PREFIX}Bob`);
    expect(bob.roles).toEqual(['Member']);
    // Bob has only one active team (the other is expired)
    expect(bob.teamIds).toEqual([teamAId]);

    // nextCursor is the id of the last returned item (bob)
    expect(res1.body.data.nextCursor).toBe(bob.id);

    // Page 2: with cursor
    const res2 = await http()
      .get(`/api/v1/users?role=Member&q=${PREFIX}&limit=2&cursor=${res1.body.data.nextCursor}`)
      .set('Cookie', committeeCookie)
      .expect(200);

    expect(res2.body.success).toBe(true);
    expect(res2.body.data.items).toHaveLength(1);

    const [charlie] = res2.body.data.items;
    expect(charlie.displayName).toBe(`${PREFIX}Charlie`);
    expect(charlie.teamIds).toEqual([]);
    expect(res2.body.data.nextCursor).toBeNull();
  });

  it('allows Admin to search users as well', async () => {
    const adminCookie = cookieFor(randomUUID(), ['Admin']);
    const res = await http()
      .get(`/api/v1/users?role=Member&q=${PREFIX}&limit=10`)
      .set('Cookie', adminCookie)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toHaveLength(3);
  });

  it('supports case-insensitive prefix search on displayName and email prefix search', async () => {
    const committeeCookie = cookieFor(randomUUID(), ['Committee']);

    // Case-insensitive display name match
    const resName = await http()
      .get(`/api/v1/users?role=Member&q=${PREFIX.toUpperCase()}ALICE`)
      .set('Cookie', committeeCookie)
      .expect(200);
    expect(resName.body.data.items).toHaveLength(1);
    expect(resName.body.data.items[0].displayName).toBe(`${PREFIX}Alice`);

    // Email prefix match (case-insensitive via toLowerCase)
    const resEmail = await http()
      .get(`/api/v1/users?role=Member&q=${PREFIX.toUpperCase()}BOB@`)
      .set('Cookie', committeeCookie)
      .expect(200);
    expect(resEmail.body.data.items).toHaveLength(1);
    expect(resEmail.body.data.items[0].displayName).toBe(`${PREFIX}Bob`);
  });

  it('matches the start of any word of the display name: surname and Thai names (Pam N3)', async () => {
    const committeeCookie = cookieFor(randomUUID(), ['Committee']);
    const tag = randomUUID().slice(0, 6);
    const thai = await prisma.user.create({
      data: { email: `${PREFIX}thai@test.local`, passwordHash: 'dummy', displayName: `${PREFIX}สมศักดิ์ ใจดี${tag}`, roles: { create: [{ role: 'Member' }] } },
    });
    const latin = await prisma.user.create({
      data: { email: `${PREFIX}latin@test.local`, passwordHash: 'dummy', displayName: `${PREFIX}Somsak Jaidee${tag}`, roles: { create: [{ role: 'Member' }] } },
    });
    const search = async (q: string) =>
      (await http().get(`/api/v1/users?role=Member&q=${encodeURIComponent(q)}`).set('Cookie', committeeCookie).expect(200)).body.data.items
        .map((u: { id: string }) => u.id);
    try {
      expect(await search(`ใจดี${tag}`)).toEqual([thai.id]);
      expect(await search(`  JAIDEE${tag} `)).toEqual([latin.id]);
      // mid-word text is not a word start
      expect(await search(`aidee${tag}`)).toEqual([]);
    } finally {
      await prisma.user.deleteMany({ where: { id: { in: [thai.id, latin.id] } } });
    }
  });

  it('rejects unauthenticated requests with 401 UNAUTHENTICATED', async () => {
    const res = await http().get('/api/v1/users').expect(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects Member callers with 403 FORBIDDEN', async () => {
    const memberCookie = cookieFor(randomUUID(), ['Member']);
    const res = await http().get('/api/v1/users').set('Cookie', memberCookie).expect(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects invalid query parameters with 400 VALIDATION_FAILED', async () => {
    const committeeCookie = cookieFor(randomUUID(), ['Committee']);

    // limit=0 violates min(1)
    const resLimit = await http()
      .get('/api/v1/users?limit=0')
      .set('Cookie', committeeCookie)
      .expect(400);
    expect(resLimit.body.success).toBe(false);
    expect(resLimit.body.error.code).toBe('VALIDATION_FAILED');

    // cursor not a uuid
    const resCursor = await http()
      .get('/api/v1/users?cursor=not-a-uuid')
      .set('Cookie', committeeCookie)
      .expect(400);
    expect(resCursor.body.success).toBe(false);
    expect(resCursor.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('includes teamNames, gradeLabel and gradeProvisional (bl-21-11 picker)', async () => {
    const committeeCookie = cookieFor(randomUUID(), ['Committee']);
    const gradePrefixes = `grad-${randomUUID().slice(0, 8)}-`;

    // Create rubric for assessments
    const rubric = await prisma.rubric.findFirst({ where: { active: true } });
    if (!rubric) throw new Error('No active rubric found');

    // Create 3 teams for the test
    const teamA = await prisma.team.create({
      data: {
        name: `${gradePrefixes}Zeta`,
        nameKey: `${gradePrefixes}zeta`,
      },
    });
    const teamB = await prisma.team.create({
      data: {
        name: `${gradePrefixes}Alpha`,
        nameKey: `${gradePrefixes}alpha`,
      },
    });
    const teamC = await prisma.team.create({
      data: {
        name: `${gradePrefixes}Gamma`,
        nameKey: `${gradePrefixes}gamma`,
      },
    });

    // 1. Member with approved grade, 2 teams (check sorting by name)
    const u1 = await prisma.user.create({
      data: {
        email: `${gradePrefixes}member1@test.local`,
        passwordHash: 'dummy',
        displayName: `${gradePrefixes}MemberWithGrade`,
        roles: { create: [{ role: 'Member' }] },
        memberships: {
          create: [{ teamId: teamA.id }, { teamId: teamB.id }],
        },
      },
    });

    // Create assessment and approved result for u1
    const a1 = await prisma.assessment.create({
      data: {
        subjectUserId: u1.id,
        rubricId: rubric.id,
        status: 'submitted',
      },
    });
    await prisma.assessmentResult.create({
      data: {
        assessmentId: a1.id,
        version: 1,
        source: 'computed',
        status: 'approved',
        score: 9.0,
        margin: 0.5,
        lowerIndex: 12,
        upperIndex: 13,
        centerIndex: 12,
        kind: 'exact',
        label: 'S+',
        nRaters: 1,
        methodVersion: '1.0',
        inputs: {},
      },
    });

    // 2. Member with only provisional grade
    const u2 = await prisma.user.create({
      data: {
        email: `${gradePrefixes}member2@test.local`,
        passwordHash: 'dummy',
        displayName: `${gradePrefixes}MemberProvisional`,
        roles: { create: [{ role: 'Member' }] },
        memberships: { create: [{ teamId: teamC.id }] },
      },
    });

    const a2 = await prisma.assessment.create({
      data: {
        subjectUserId: u2.id,
        rubricId: rubric.id,
        status: 'submitted',
      },
    });
    await prisma.assessmentResult.create({
      data: {
        assessmentId: a2.id,
        version: 1,
        source: 'computed',
        status: 'provisional',
        score: 8.0,
        margin: 0.5,
        lowerIndex: 10,
        upperIndex: 11,
        centerIndex: 10,
        kind: 'exact',
        label: 'A',
        nRaters: 1,
        methodVersion: '1.0',
        inputs: {},
      },
    });

    // 3. Member with no grade
    const u3 = await prisma.user.create({
      data: {
        email: `${gradePrefixes}member3@test.local`,
        passwordHash: 'dummy',
        displayName: `${gradePrefixes}MemberNoGrade`,
        roles: { create: [{ role: 'Member' }] },
        memberships: { create: [{ teamId: teamB.id }] },
      },
    });

    // Query for all three members
    const res = await http()
      .get(`/api/v1/users?role=Member&q=${gradePrefixes}Member`)
      .set('Cookie', committeeCookie)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toHaveLength(3);

    // Find each member in results
    const m1 = res.body.data.items.find((u: any) => u.id === u1.id);
    const m2 = res.body.data.items.find((u: any) => u.id === u2.id);
    const m3 = res.body.data.items.find((u: any) => u.id === u3.id);

    // m1: approved grade, 2 teams sorted by name
    expect(m1).toBeDefined();
    expect(m1.teamNames).toEqual([`${gradePrefixes}Alpha`, `${gradePrefixes}Zeta`]);
    expect(m1.gradeLabel).toBe('S+');
    expect(m1.gradeProvisional).toBe(false);

    // m2: provisional grade
    expect(m2).toBeDefined();
    expect(m2.teamNames).toEqual([`${gradePrefixes}Gamma`]);
    expect(m2.gradeLabel).toBeNull();
    expect(m2.gradeProvisional).toBe(true);

    // m3: no grade
    expect(m3).toBeDefined();
    expect(m3.teamNames).toEqual([`${gradePrefixes}Alpha`]);
    expect(m3.gradeLabel).toBeNull();
    expect(m3.gradeProvisional).toBe(false);

    // Cleanup: disable users (teams remain; assessments/results are append-only)
    await prisma.user.updateMany({
      where: { displayName: { startsWith: gradePrefixes } },
      data: { status: 'disabled' },
    });
  });
});
