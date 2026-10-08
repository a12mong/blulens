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
  let activeMethodVersion: string;
  let activeCriteria: unknown;
  let draftMethodVersion: string;

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
    activeMethodVersion = activeRubric.methodVersion;
    activeCriteria = activeRubric.criteria;
    // another suite may have left a draft open; this suite needs the draft slot free
    await prisma.rubric.deleteMany({ where: { active: false, activatedAt: null } });
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
      const activeRubric = res.body.data.find((r: { id: string }) => r.id === activeRubricId);
      expect(activeRubric).toMatchObject({ status: 'active', methodVersion: activeMethodVersion, criteria: activeCriteria });
      expect(activeRubric).not.toHaveProperty('params');
    });

    it('Member -> 403', async () => {
      await http().get('/api/v1/rubrics').set('Cookie', memberCookie).expect(403);
    });

    it('Guest -> 403', async () => {
      await http().get('/api/v1/rubrics').set('Cookie', guestCookie).expect(403);
    });
  });

  describe('POST /rubrics', () => {
    it('Committee -> 201 creates a draft <base>-r<next N> with the active criteria', async () => {
      const base = activeMethodVersion.replace(/-r\d+$/, '');
      const used = (await prisma.rubric.findMany({ where: { methodVersion: { startsWith: `${base}-r` } } }))
        .map((r) => Number(/-r(\d+)$/.exec(r.methodVersion)?.[1] ?? 0));
      const expectedN = Math.max(1, ...used) + 1;

      const res = await http().post('/api/v1/rubrics').set('Cookie', committeeCookie).expect(201);

      const draft = res.body.data;
      expect(draft).toMatchObject({ status: 'draft', methodVersion: `${base}-r${expectedN}`, criteria: activeCriteria });
      expect(draft).not.toHaveProperty('params');
      draftMethodVersion = draft.methodVersion;
    });

    it('GET now shows draft first', async () => {
      const res = await http().get('/api/v1/rubrics').set('Cookie', committeeCookie).expect(200);

      expect(res.body.data[0].status).toBe('draft');
      expect(res.body.data[0].methodVersion).toBe(draftMethodVersion);
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

    it('unauthenticated -> 401 on GET and POST', async () => {
      await http().get('/api/v1/rubrics').expect(401);
      await http().post('/api/v1/rubrics').expect(401);
    });
  });
});
