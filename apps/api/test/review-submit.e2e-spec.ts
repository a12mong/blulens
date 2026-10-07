import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-sub-${randomUUID().slice(0, 8)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

describe('PUT /reviews/assignments/:assignmentId (bl-10-3d submit review)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const userIds: string[] = [];
  const assessmentIds: string[] = [];
  const assignmentIds: string[] = [];

  let r1Id: string;
  let r2Id: string;
  let r1Cookie: string;
  let r2Cookie: string;
  const memberCookie = cookieFor(randomUUID(), ['Member']);

  let rubricId: string;
  let assessmentId: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();

    // Subject user
    const subject = await prisma.user.create({
      data: {
        email: `${tag}-subject@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Subject`,
      },
    });
    userIds.push(subject.id);

    // Reviewer 1
    const r1 = await prisma.user.create({
      data: { email: `${tag}-r1@test.local`, passwordHash: 'x', displayName: `${tag} R1` },
    });
    userIds.push(r1.id);
    r1Id = r1.id;
    r1Cookie = cookieFor(r1Id, ['Reviewer']);

    // Reviewer 2
    const r2 = await prisma.user.create({
      data: { email: `${tag}-r2@test.local`, passwordHash: 'x', displayName: `${tag} R2` },
    });
    userIds.push(r2.id);
    r2Id = r2.id;
    r2Cookie = cookieFor(r2Id, ['Reviewer']);

    // Active rubric
    const rubric = await prisma.rubric.findFirst({ where: { active: true } });
    if (!rubric) throw new Error('Active rubric not found in database');
    rubricId = rubric.id;

    // Assessment
    const assessment = await prisma.assessment.create({
      data: { subjectUserId: subject.id, rubricId, status: 'in_review' },
    });
    assessmentIds.push(assessment.id);
    assessmentId = assessment.id;
  });

  afterAll(async () => {
    await prisma.reviewScore.deleteMany({
      where: { review: { assignmentId: { in: assignmentIds } } },
    });
    await prisma.review.deleteMany({ where: { assignmentId: { in: assignmentIds } } });
    await prisma.reviewAssignment.deleteMany({ where: { id: { in: assignmentIds } } });
    await prisma.assessment.deleteMany({ where: { id: { in: assessmentIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  async function createAssignment(
    reviewerId: string,
    dueAt: Date = new Date(Date.now() + 24 * 3600 * 1000),
  ) {
    // Each assessment can only have one open/submitted assignment per reviewer
    const assess = await prisma.assessment.create({
      data: { subjectUserId: userIds[0]!, rubricId, status: 'in_review' },
    });
    assessmentIds.push(assess.id);

    const a = await prisma.reviewAssignment.create({
      data: {
        kind: 'assessment',
        assessmentId: assess.id,
        reviewerId,
        state: 'open',
        dueAt,
      },
    });
    assignmentIds.push(a.id);
    return a;
  }

  it("stores a reviewer's rubric scores once and computes their overall score", async () => {
    // Edge case 1: 6 criteria all 'S' -> 200 state 'submitted'; Review.overall 7.5, abstained false, 6 ReviewScore rows
    const a1 = await createAssignment(r1Id);

    const payloadAllS = {
      scores: [
        { criterion: 'footwork', gradeKey: 'S' },
        { criterion: 'overhead', gradeKey: 'S' },
        { criterion: 'net', gradeKey: 'S' },
        { criterion: 'defense', gradeKey: 'S' },
        { criterion: 'tactics', gradeKey: 'S' },
        { criterion: 'consistency', gradeKey: 'S' },
      ],
      comment: 'ฟอร์มการเล่นยอดเยี่ยมมาก',
    };

    const res1 = await http()
      .put(`/api/v1/reviews/assignments/${a1.id}`)
      .set('Cookie', r1Cookie)
      .send(payloadAllS)
      .expect(200);

    expect(res1.body.success).toBe(true);
    expect(res1.body.data).toMatchObject({
      id: a1.id,
      state: 'submitted',
      dueAt: a1.dueAt.toISOString(),
    });
    expect(typeof res1.body.data.submittedAt).toBe('string');
    expect(Object.keys(res1.body.data).sort()).toEqual(
      ['dueAt', 'id', 'state', 'submittedAt'].sort(),
    );

    // Verify DB Review row
    const reviewInDb = await prisma.review.findUnique({
      where: { assignmentId: a1.id },
      include: { scores: true },
    });
    expect(reviewInDb).toBeTruthy();
    expect(Number(reviewInDb?.overall)).toBe(7.5);
    expect(reviewInDb?.abstained).toBe(false);
    expect(reviewInDb?.comment).toBe('ฟอร์มการเล่นยอดเยี่ยมมาก');
    expect(reviewInDb?.scores).toHaveLength(6);
    expect(reviewInDb?.scores.every((s) => s.gradeIndex === 7)).toBe(true);

    // Verify assignment state in DB
    const assignmentInDb = await prisma.reviewAssignment.findUnique({ where: { id: a1.id } });
    expect(assignmentInDb?.state).toBe('submitted');

    // Verify audit log
    const auditInDb = await prisma.auditLog.findFirst({
      where: { entityId: a1.id, action: 'review.submit' },
    });
    expect(auditInDb).toBeTruthy();
    expect(auditInDb?.after).toEqual({ abstained: false });

    // Edge case 3: second PUT -> 409 REVIEW_ALREADY_SUBMITTED
    const resDup = await http()
      .put(`/api/v1/reviews/assignments/${a1.id}`)
      .set('Cookie', r1Cookie)
      .send(payloadAllS)
      .expect(409);
    expect(resDup.body.error.code).toBe('REVIEW_ALREADY_SUBMITTED');

    // Edge case 2: 4 of 6 null -> 200, abstained true, overall null
    const a2 = await createAssignment(r1Id);

    const payloadAbstained = {
      scores: [
        { criterion: 'footwork', gradeKey: 'S' },
        { criterion: 'overhead', gradeKey: 'S' },
        { criterion: 'net', gradeKey: null },
        { criterion: 'defense', gradeKey: null },
        { criterion: 'tactics', gradeKey: null },
        { criterion: 'consistency', gradeKey: null },
      ],
    };

    const res2 = await http()
      .put(`/api/v1/reviews/assignments/${a2.id}`)
      .set('Cookie', r1Cookie)
      .send(payloadAbstained)
      .expect(200);

    expect(res2.body.data.state).toBe('submitted');

    const review2InDb = await prisma.review.findUnique({ where: { assignmentId: a2.id } });
    expect(review2InDb?.abstained).toBe(true);
    expect(review2InDb?.overall).toBeNull();
  });

  it("rejects submitting another reviewer's task with 404 (ASSIGNMENT_NOT_FOUND)", async () => {
    const aR2 = await createAssignment(r2Id);

    const res = await http()
      .put(`/api/v1/reviews/assignments/${aR2.id}`)
      .set('Cookie', r1Cookie)
      .send({
        scores: [
          { criterion: 'footwork', gradeKey: 'S' },
          { criterion: 'overhead', gradeKey: 'S' },
          { criterion: 'net', gradeKey: 'S' },
          { criterion: 'defense', gradeKey: 'S' },
          { criterion: 'tactics', gradeKey: 'S' },
          { criterion: 'consistency', gradeKey: 'S' },
        ],
      })
      .expect(404);

    expect(res.body.error.code).toBe('ASSIGNMENT_NOT_FOUND');
  });

  it('rejects submitting an assignment with dueAt in the past (409 ASSIGNMENT_EXPIRED)', async () => {
    const pastDue = new Date(Date.now() - 3600 * 1000);
    const expiredAssign = await createAssignment(r1Id, pastDue);

    const res = await http()
      .put(`/api/v1/reviews/assignments/${expiredAssign.id}`)
      .set('Cookie', r1Cookie)
      .send({
        scores: [
          { criterion: 'footwork', gradeKey: 'S' },
          { criterion: 'overhead', gradeKey: 'S' },
          { criterion: 'net', gradeKey: 'S' },
          { criterion: 'defense', gradeKey: 'S' },
          { criterion: 'tactics', gradeKey: 'S' },
          { criterion: 'consistency', gradeKey: 'S' },
        ],
      })
      .expect(409);

    expect(res.body.error.code).toBe('ASSIGNMENT_EXPIRED');
  });

  it('rejects missing one criterion with 400 VALIDATION_FAILED (REVIEW_MISSING_CRITERION)', async () => {
    const a = await createAssignment(r1Id);

    const res = await http()
      .put(`/api/v1/reviews/assignments/${a.id}`)
      .set('Cookie', r1Cookie)
      .send({
        scores: [
          { criterion: 'footwork', gradeKey: 'S' },
          { criterion: 'overhead', gradeKey: 'S' },
          { criterion: 'net', gradeKey: 'S' },
          { criterion: 'defense', gradeKey: 'S' },
          { criterion: 'tactics', gradeKey: 'S' },
          // missing 'consistency'
        ],
      })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.message).toBe('REVIEW_MISSING_CRITERION');
  });

  it("rejects unknown gradeKey 'Z' with 400 VALIDATION_FAILED", async () => {
    const a = await createAssignment(r1Id);

    const res = await http()
      .put(`/api/v1/reviews/assignments/${a.id}`)
      .set('Cookie', r1Cookie)
      .send({
        scores: [
          { criterion: 'footwork', gradeKey: 'Z' },
          { criterion: 'overhead', gradeKey: 'S' },
          { criterion: 'net', gradeKey: 'S' },
          { criterion: 'defense', gradeKey: 'S' },
          { criterion: 'tactics', gradeKey: 'S' },
          { criterion: 'consistency', gradeKey: 'S' },
        ],
      })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('enforces RBAC: Member gets 403, unauthenticated gets 401', async () => {
    const a = await createAssignment(r1Id);

    await http()
      .put(`/api/v1/reviews/assignments/${a.id}`)
      .set('Cookie', memberCookie)
      .send({
        scores: [{ criterion: 'footwork', gradeKey: 'S' }],
      })
      .expect(403);

    await http()
      .put(`/api/v1/reviews/assignments/${a.id}`)
      .send({
        scores: [{ criterion: 'footwork', gradeKey: 'S' }],
      })
      .expect(401);
  });
});
