import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-rubrics-${randomUUID().slice(0, 8)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

describe('GET/POST /rubrics (bl-34-1)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  let committeeId: string;
  let committeeCookie: string;
  let memberId: string;
  let memberCookie: string;
  let guestCookie: string;
  let activeRubricId: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();

    // Create committee user
    const committee = await prisma.user.create({
      data: {
        email: `${tag}-committee@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Committee`,
      },
    });
    committeeId = committee.id;
    await prisma.userRole.create({ data: { userId: committeeId, role: 'Committee' } });
    committeeCookie = cookieFor(committeeId, ['Committee']);

    // Create member user
    const member = await prisma.user.create({
      data: {
        email: `${tag}-member@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Member`,
      },
    });
    memberId = member.id;
    await prisma.userRole.create({ data: { userId: memberId, role: 'Member' } });
    memberCookie = cookieFor(memberId, ['Member']);

    // Create guest cookie (no roles)
    guestCookie = cookieFor(randomUUID(), []);

    // Get the active rubric (seeded as grading-v1)
    const activeRubric = await prisma.rubric.findFirstOrThrow({
      where: { active: true },
    });
    activeRubricId = activeRubric.id;
  });

  afterAll(async () => {
    await app.close();
    // Cleanup: delete drafts (drafts are deletable)
    await prisma.rubric.deleteMany({ where: { active: false, activatedAt: null } });
    // Don't delete active rubric (never touch it per spec)
    const users = await prisma.user.findMany({ where: { email: { contains: tag } } });
    await prisma.userRole.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    await prisma.user.updateMany({
      where: { id: { in: users.map((u) => u.id) } },
      data: { status: 'disabled' },
    });
  });

  describe('GET /rubrics', () => {
    it('Committee -> 200 lists active rubric with status "active"', async () => {
      const res = await http().get('/api/v1/rubrics').set('Cookie', committeeCookie).expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      const activeRubric = res.body.data.find((r: any) => r.id === activeRubricId);
      expect(activeRubric).toBeDefined();
      expect(activeRubric.status).toBe('active');
      expect(activeRubric.methodVersion).toBe('grading-v1');
      expect(Array.isArray(activeRubric.criteria)).toBe(true);
      expect(activeRubric.criteria.length).toBeGreaterThan(0);
      expect(activeRubric.criteria[0]).toHaveProperty('key');
      expect(activeRubric.criteria[0]).toHaveProperty('nameTh');
      expect(activeRubric.criteria[0]).toHaveProperty('weight');
      expect(activeRubric.params).toBeUndefined();
    });

    it('Member -> 403', async () => {
      await http().get('/api/v1/rubrics').set('Cookie', memberCookie).expect(403);
    });

    it('Guest -> 403', async () => {
      await http().get('/api/v1/rubrics').set('Cookie', guestCookie).expect(403);
    });
  });

  describe('POST /rubrics', () => {
    it('Committee -> 201 creates draft with methodVersion <active>-r2', async () => {
      const res = await http().post('/api/v1/rubrics').set('Cookie', committeeCookie).expect(201);

      expect(res.body.data).toBeDefined();
      const draft = res.body.data;
      expect(draft.status).toBe('draft');
      expect(draft.methodVersion).toBe('grading-v1-r2');
      expect(Array.isArray(draft.criteria)).toBe(true);
      expect(draft.criteria.length).toBeGreaterThan(0);
      expect(draft.criteria).toEqual(expect.arrayContaining([expect.objectContaining({ key: expect.any(String), nameTh: expect.any(String), weight: expect.any(Number) })]));
      expect(draft.params).toBeUndefined();
    });

    it('GET now shows draft first', async () => {
      const res = await http().get('/api/v1/rubrics').set('Cookie', committeeCookie).expect(200);

      expect(res.body.data[0].status).toBe('draft');
      expect(res.body.data[0].methodVersion).toBe('grading-v1-r2');
    });

    it('Second POST -> 409 RUBRIC_DRAFT_EXISTS', async () => {
      const res = await http().post('/api/v1/rubrics').set('Cookie', committeeCookie).expect(409);

      expect(res.body.error?.code).toBe('RUBRIC_DRAFT_EXISTS');
    });

    it('Member -> 403', async () => {
      await http().post('/api/v1/rubrics').set('Cookie', memberCookie).expect(403);
    });

    it('Guest -> 403', async () => {
      await http().post('/api/v1/rubrics').set('Cookie', guestCookie).expect(403);
    });
  });
});
