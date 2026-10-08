import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-rubric-draft-${randomUUID().slice(0, 8)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

describe('PUT/DELETE /rubrics/{id} (bl-34-2)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  let committeeId: string;
  let committeeCookie: string;
  let memberId: string;
  let memberCookie: string;
  let activeRubricId: string;
  let draftRubricId: string;

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

    // Get the active rubric (seeded as grading-v1)
    const activeRubric = await prisma.rubric.findFirstOrThrow({
      where: { active: true },
    });
    activeRubricId = activeRubric.id;

    // Free any existing draft (delete old draft if it exists)
    await prisma.rubric.deleteMany({
      where: { active: false, activatedAt: null },
    });

    // Create a draft for testing
    const draftRes = await http().post('/api/v1/rubrics').set('Cookie', committeeCookie).expect(201);
    draftRubricId = draftRes.body.data.id;
  });

  afterAll(async () => {
    await app.close();
    // Cleanup: delete drafts
    await prisma.rubric.deleteMany({ where: { active: false, activatedAt: null } });
    // Disable users
    const users = await prisma.user.findMany({ where: { email: { contains: tag } } });
    await prisma.userRole.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    await prisma.user.updateMany({
      where: { id: { in: users.map((u) => u.id) } },
      data: { status: 'disabled' },
    });
  });

  describe('PUT /rubrics/{id}', () => {
    it('Committee -> 200 updates criteria and GET shows them', async () => {
      const newCriteria = [
        { key: 'footwork', nameTh: 'การเคลื่อนที่ที่ดี', weight: 0.5 },
        { key: 'technique', nameTh: 'เทคนิคที่ถูกต้อง', weight: 0.5 },
      ];

      const res = await http()
        .put(`/api/v1/rubrics/${draftRubricId}`)
        .set('Cookie', committeeCookie)
        .send({ criteria: newCriteria })
        .expect(200);

      expect(res.body.data.criteria).toEqual(newCriteria);
      expect(res.body.data.status).toBe('draft');

      // Verify GET shows the updated criteria
      const getRes = await http().get('/api/v1/rubrics').set('Cookie', committeeCookie).expect(200);
      const updated = getRes.body.data.find((r: any) => r.id === draftRubricId);
      expect(updated.criteria).toEqual(newCriteria);
    });

    it('Weight 0 -> 400 VALIDATION_FAILED', async () => {
      const res = await http()
        .put(`/api/v1/rubrics/${draftRubricId}`)
        .set('Cookie', committeeCookie)
        .send({ criteria: [{ key: 'test', nameTh: 'test', weight: 0 }] })
        .expect(400);

      expect(res.body.error?.code).toBe('VALIDATION_FAILED');
    });

    it('Weight > 10 -> 400 VALIDATION_FAILED', async () => {
      const res = await http()
        .put(`/api/v1/rubrics/${draftRubricId}`)
        .set('Cookie', committeeCookie)
        .send({ criteria: [{ key: 'test', nameTh: 'test', weight: 10.1 }] })
        .expect(400);

      expect(res.body.error?.code).toBe('VALIDATION_FAILED');
    });

    it('Duplicate keys -> 400 VALIDATION_FAILED', async () => {
      const res = await http()
        .put(`/api/v1/rubrics/${draftRubricId}`)
        .set('Cookie', committeeCookie)
        .send({
          criteria: [
            { key: 'test', nameTh: 'test1', weight: 0.5 },
            { key: 'test', nameTh: 'test2', weight: 0.5 },
          ],
        })
        .expect(400);

      expect(res.body.error?.code).toBe('VALIDATION_FAILED');
    });

    it('13 items -> 400 VALIDATION_FAILED', async () => {
      const criteria = Array.from({ length: 13 }, (_, i) => ({
        key: `item${i}`,
        nameTh: `Item ${i}`,
        weight: 1,
      }));

      const res = await http()
        .put(`/api/v1/rubrics/${draftRubricId}`)
        .set('Cookie', committeeCookie)
        .send({ criteria })
        .expect(400);

      expect(res.body.error?.code).toBe('VALIDATION_FAILED');
    });

    it('Unknown anchorsTh tier -> 400 VALIDATION_FAILED', async () => {
      const res = await http()
        .put(`/api/v1/rubrics/${draftRubricId}`)
        .set('Cookie', committeeCookie)
        .send({
          criteria: [
            {
              key: 'test',
              nameTh: 'test',
              weight: 1,
              anchorsTh: { Expert: 'x' },
            },
          ],
        })
        .expect(400);

      expect(res.body.error?.code).toBe('VALIDATION_FAILED');
    });

    it('Active rubric -> 409 RUBRIC_NOT_DRAFT', async () => {
      const res = await http()
        .put(`/api/v1/rubrics/${activeRubricId}`)
        .set('Cookie', committeeCookie)
        .send({ criteria: [{ key: 'test', nameTh: 'test', weight: 1 }] })
        .expect(409);

      expect(res.body.error?.code).toBe('RUBRIC_NOT_DRAFT');
    });

    it('Unknown id -> 404 RUBRIC_NOT_FOUND', async () => {
      const res = await http()
        .put(`/api/v1/rubrics/${randomUUID()}`)
        .set('Cookie', committeeCookie)
        .send({ criteria: [{ key: 'test', nameTh: 'test', weight: 1 }] })
        .expect(404);

      expect(res.body.error?.code).toBe('RUBRIC_NOT_FOUND');
    });

    it('Member -> 403', async () => {
      await http()
        .put(`/api/v1/rubrics/${draftRubricId}`)
        .set('Cookie', memberCookie)
        .send({ criteria: [{ key: 'test', nameTh: 'test', weight: 1 }] })
        .expect(403);
    });
  });

  describe('DELETE /rubrics/{id}', () => {
    it('Committee -> 204 deletes draft', async () => {
      await http().delete(`/api/v1/rubrics/${draftRubricId}`).set('Cookie', committeeCookie).expect(204);

      // Verify draft is gone
      const getRes = await http().get('/api/v1/rubrics').set('Cookie', committeeCookie).expect(200);
      const deleted = getRes.body.data.find((r: any) => r.id === draftRubricId);
      expect(deleted).toBeUndefined();
    });

    it('After DELETE, POST /rubrics succeeds (201)', async () => {
      // Create a new draft to test that we can create one after deleting
      const res = await http().post('/api/v1/rubrics').set('Cookie', committeeCookie).expect(201);
      expect(res.body.data.status).toBe('draft');
      draftRubricId = res.body.data.id; // Update for cleanup
    });

    it('Active rubric -> 409 RUBRIC_NOT_DRAFT', async () => {
      const res = await http()
        .delete(`/api/v1/rubrics/${activeRubricId}`)
        .set('Cookie', committeeCookie)
        .expect(409);

      expect(res.body.error?.code).toBe('RUBRIC_NOT_DRAFT');
    });

    it('Unknown id -> 404 RUBRIC_NOT_FOUND', async () => {
      const res = await http()
        .delete(`/api/v1/rubrics/${randomUUID()}`)
        .set('Cookie', committeeCookie)
        .expect(404);

      expect(res.body.error?.code).toBe('RUBRIC_NOT_FOUND');
    });

    it('Member -> 403', async () => {
      await http().delete(`/api/v1/rubrics/${draftRubricId}`).set('Cookie', memberCookie).expect(403);
    });
  });
});
