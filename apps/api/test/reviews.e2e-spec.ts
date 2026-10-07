import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-rev-${randomUUID().slice(0, 8)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

describe('ReviewsModule (bl-10-3b wave 3)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const userIds: string[] = [];
  const assessmentIds: string[] = [];
  const assignmentIds: string[] = [];
  const calSetIds: string[] = [];
  const calClipIds: string[] = [];

  let reviewer1Id: string;
  let reviewer2Id: string;
  let r1Cookie: string;
  let r2Cookie: string;
  const memberCookie = cookieFor(randomUUID(), ['Member']);

  let a1OpenId: string;
  let a2SubmittedId: string;
  let a3R2Id: string;
  let a1DueAt: Date;
  let a2DueAt: Date;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();

    // Create users without DB roles (roles are in JWT)
    const subject = await prisma.user.create({
      data: {
        email: `${tag}-subject@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Subject`,
      },
    });
    userIds.push(subject.id);

    const r1 = await prisma.user.create({
      data: { email: `${tag}-r1@test.local`, passwordHash: 'x', displayName: `${tag} R1` },
    });
    userIds.push(r1.id);
    reviewer1Id = r1.id;
    r1Cookie = cookieFor(reviewer1Id, ['Reviewer']);

    const r2 = await prisma.user.create({
      data: { email: `${tag}-r2@test.local`, passwordHash: 'x', displayName: `${tag} R2` },
    });
    userIds.push(r2.id);
    reviewer2Id = r2.id;
    r2Cookie = cookieFor(reviewer2Id, ['Reviewer']);

    // Create assessment
    const assessment = await prisma.assessment.create({
      data: { subjectUserId: subject.id, status: 'in_review' },
    });
    assessmentIds.push(assessment.id);

    // Create calibration set and clip
    const calSet = await prisma.calibrationSet.create({
      data: {
        name: `${tag} Cal Set`,
        createdBy: subject.id,
      },
    });
    calSetIds.push(calSet.id);

    const calClip = await prisma.calibrationClip.create({
      data: {
        setId: calSet.id,
        objectKey: `cal-${tag}-clip`,
        referenceIndex: 7,
        status: 'uploaded',
      },
    });
    calClipIds.push(calClip.id);

    // Reviewer 1: assignment 1 (kind: assessment, open, due in 24 hours)
    a1DueAt = new Date(Date.now() + 24 * 3600 * 1000);
    const a1 = await prisma.reviewAssignment.create({
      data: {
        kind: 'assessment',
        assessmentId: assessment.id,
        reviewerId: reviewer1Id,
        state: 'open',
        dueAt: a1DueAt,
      },
    });
    a1OpenId = a1.id;
    assignmentIds.push(a1.id);

    // Reviewer 1: assignment 2 (kind: calibration, submitted, due in 12 hours - earlier due date, with review row)
    a2DueAt = new Date(Date.now() + 12 * 3600 * 1000);
    const a2 = await prisma.reviewAssignment.create({
      data: {
        kind: 'calibration',
        calibrationClipId: calClip.id,
        reviewerId: reviewer1Id,
        state: 'submitted',
        dueAt: a2DueAt,
      },
    });
    a2SubmittedId = a2.id;
    assignmentIds.push(a2.id);

    await prisma.review.create({
      data: {
        assignmentId: a2.id,
        submittedAt: new Date(Date.now() - 3600 * 1000),
      },
    });

    // Reviewer 2: assignment 3 (kind: assessment, open)
    const a3 = await prisma.reviewAssignment.create({
      data: {
        kind: 'assessment',
        assessmentId: assessment.id,
        reviewerId: reviewer2Id,
        state: 'open',
        dueAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });
    a3R2Id = a3.id;
    assignmentIds.push(a3.id);
  });

  afterAll(async () => {
    await prisma.review.deleteMany({ where: { assignmentId: { in: assignmentIds } } });
    await prisma.reviewAssignment.deleteMany({ where: { id: { in: assignmentIds } } });
    await prisma.calibrationClip.deleteMany({ where: { id: { in: calClipIds } } });
    await prisma.calibrationSet.deleteMany({ where: { id: { in: calSetIds } } });
    await prisma.assessment.deleteMany({ where: { id: { in: assessmentIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  describe('GET /rubric', () => {
    it('returns the active rubric without cookie with 6 criteria (seeded)', async () => {
      const res = await http().get('/api/v1/rubric').expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.methodVersion).toBe('grading-v1');
      expect(Array.isArray(res.body.data.criteria)).toBe(true);
      expect(res.body.data.criteria).toHaveLength(6);

      const keys = res.body.data.criteria.map((c: { key: string }) => c.key);
      expect(keys).toEqual(['footwork', 'overhead', 'net', 'defense', 'tactics', 'consistency']);

      for (const criterion of res.body.data.criteria) {
        expect(criterion).toHaveProperty('key');
        expect(criterion).toHaveProperty('nameTh');
        expect(criterion).toHaveProperty('weight');
      }

      // Must not leak internal parameters or timestamps
      expect(res.body.data.params).toBeUndefined();
      expect(res.body.data.id).toBeUndefined();
      expect(res.body.data.active).toBeUndefined();
    });
  });

  describe('GET /reviews/assignments/me', () => {
    it('shows a reviewer only their own assignments, ordered by due date', async () => {
      const res = await http()
        .get('/api/v1/reviews/assignments/me')
        .set('Cookie', r1Cookie)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);

      // Must be ordered by dueAt ascending: a2 (due in 12h) before a1 (due in 24h)
      expect(res.body.data[0].id).toBe(a2SubmittedId);
      expect(res.body.data[0].state).toBe('submitted');
      expect(res.body.data[0].dueAt).toBe(a2DueAt.toISOString());
      expect(typeof res.body.data[0].submittedAt).toBe('string');
      expect(Object.keys(res.body.data[0]).sort()).toEqual(
        ['dueAt', 'id', 'state', 'submittedAt'].sort(),
      );

      expect(res.body.data[1].id).toBe(a1OpenId);
      expect(res.body.data[1].state).toBe('open');
      expect(res.body.data[1].dueAt).toBe(a1DueAt.toISOString());
      expect(res.body.data[1].submittedAt).toBeNull();
      expect(Object.keys(res.body.data[1]).sort()).toEqual(
        ['dueAt', 'id', 'state', 'submittedAt'].sort(),
      );

      // Fully blind: does not expose assessmentId or kind to the reviewer
      expect(res.body.data[0].assessmentId).toBeUndefined();
      expect(res.body.data[0].kind).toBeUndefined();
      expect(res.body.data[1].assessmentId).toBeUndefined();
      expect(res.body.data[1].kind).toBeUndefined();

      // Blind review: does NOT include reviewer 2's assignment or any reviewer names/scores
      const ids = res.body.data.map((item: { id: string }) => item.id);
      expect(ids).not.toContain(a3R2Id);
    });

    it('filters assignments by ?state=open and ?state=submitted', async () => {
      const openRes = await http()
        .get('/api/v1/reviews/assignments/me?state=open')
        .set('Cookie', r1Cookie)
        .expect(200);

      expect(openRes.body.data).toHaveLength(1);
      expect(openRes.body.data[0].id).toBe(a1OpenId);
      expect(openRes.body.data[0].state).toBe('open');

      const submittedRes = await http()
        .get('/api/v1/reviews/assignments/me?state=submitted')
        .set('Cookie', r1Cookie)
        .expect(200);

      expect(submittedRes.body.data).toHaveLength(1);
      expect(submittedRes.body.data[0].id).toBe(a2SubmittedId);
      expect(submittedRes.body.data[0].state).toBe('submitted');

      const expiredRes = await http()
        .get('/api/v1/reviews/assignments/me?state=expired')
        .set('Cookie', r1Cookie)
        .expect(200);

      expect(expiredRes.body.data).toEqual([]);
    });

    it('shows reviewer 2 only their own single assignment', async () => {
      const res = await http()
        .get('/api/v1/reviews/assignments/me')
        .set('Cookie', r2Cookie)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(a3R2Id);
      expect(res.body.data[0].state).toBe('open');
    });

    it('enforces RBAC: Member cookie gets 403, unauthenticated gets 401', async () => {
      await http().get('/api/v1/reviews/assignments/me').set('Cookie', memberCookie).expect(403);

      await http().get('/api/v1/reviews/assignments/me').expect(401);
    });

    it('rejects invalid state query parameter with 400', async () => {
      const res = await http()
        .get('/api/v1/reviews/assignments/me?state=unknown_state')
        .set('Cookie', r1Cookie)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });
  });
});
