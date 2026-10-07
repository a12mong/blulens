import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();

describe('assessment assign (bl-10 wave 3)', () => {
  let app: INestApplication;
  let subjectUserId: string;
  let reviewerId1: string;
  let reviewerId2: string;
  let conflictReviewerId: string;
  let nonReviewerId: string;
  let assessmentId: string;

  const http = () => request(app.getHttpServer());

  const cookieFor = (id: string, roles: string[]) =>
    `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();

    // Create test users
    const subjectEmail = `assess-subject-${randomUUID()}@test.local`;
    const subjectReg = await http()
      .post('/api/v1/auth/register')
      .send({ email: subjectEmail, password: 'test-password-123', displayName: 'Subject' })
      .expect(201);
    subjectUserId = subjectReg.body.data.id;

    const reviewer1Email = `assess-reviewer1-${randomUUID()}@test.local`;
    const reviewer1Reg = await http()
      .post('/api/v1/auth/register')
      .send({ email: reviewer1Email, password: 'test-password-123', displayName: 'Reviewer 1' })
      .expect(201);
    reviewerId1 = reviewer1Reg.body.data.id;
    // Add Reviewer role
    await prisma.userRole.create({
      data: { userId: reviewerId1, role: 'Reviewer' },
    });

    const reviewer2Email = `assess-reviewer2-${randomUUID()}@test.local`;
    const reviewer2Reg = await http()
      .post('/api/v1/auth/register')
      .send({ email: reviewer2Email, password: 'test-password-123', displayName: 'Reviewer 2' })
      .expect(201);
    reviewerId2 = reviewer2Reg.body.data.id;
    // Add Reviewer role
    await prisma.userRole.create({
      data: { userId: reviewerId2, role: 'Reviewer' },
    });

    const conflictEmail = `assess-conflict-${randomUUID()}@test.local`;
    const conflictReg = await http()
      .post('/api/v1/auth/register')
      .send({ email: conflictEmail, password: 'test-password-123', displayName: 'Conflict' })
      .expect(201);
    conflictReviewerId = conflictReg.body.data.id;
    // Add Reviewer role
    await prisma.userRole.create({
      data: { userId: conflictReviewerId, role: 'Reviewer' },
    });

    const nonReviewerEmail = `assess-nonreviewer-${randomUUID()}@test.local`;
    const nonReviewerReg = await http()
      .post('/api/v1/auth/register')
      .send({ email: nonReviewerEmail, password: 'test-password-123', displayName: 'Non Reviewer' })
      .expect(201);
    nonReviewerId = nonReviewerReg.body.data.id;
    // No Reviewer role

    // Ensure active rubric exists
    const existingRubric = await prisma.rubric.findFirst({
      where: { active: true },
    });
    if (!existingRubric) {
      await prisma.rubric.create({
        data: {
          active: true,
          methodVersion: 'v1',
          criteria: {},
          params: {},
        },
      });
    }

    // Create a shared team for conflict test
    const team = await prisma.team.create({
      data: {
        name: `Conflict Team ${randomUUID()}`,
        nameKey: `conflict-team-${randomUUID().slice(0, 8)}`,
      },
    });

    // Add subject and conflict reviewer to same team
    await prisma.teamMembership.create({
      data: { userId: subjectUserId, teamId: team.id },
    });
    await prisma.teamMembership.create({
      data: { userId: conflictReviewerId, teamId: team.id },
    });

    // Create submitted assessment
    const subjectCookie = cookieFor(subjectUserId, ['Member']);
    const createRes = await http()
      .post('/api/v1/assessments')
      .set('Cookie', subjectCookie)
      .send({})
      .expect(201);
    assessmentId = createRes.body.data.id;

    // Add clip
    await prisma.clip.create({
      data: {
        assessmentId,
        objectKey: `clip-${randomUUID()}`,
        status: 'uploaded',
      },
    });

    // Submit assessment
    await http()
      .post(`/api/v1/assessments/${assessmentId}/submit`)
      .set('Cookie', subjectCookie)
      .expect(200);
  });

  afterAll(async () => {
    // Disable users
    await prisma.user.updateMany({
      where: { id: { in: [subjectUserId, reviewerId1, reviewerId2, conflictReviewerId, nonReviewerId] } },
      data: { status: 'disabled' },
    });
    await prisma.$disconnect();
    await app.close();
  });

  it('assigns eligible reviewers and refuses conflicts of interest', async () => {
    const committeeCookie = cookieFor(randomUUID(), ['Committee']);

    // Assign 2 eligible reviewers
    const assignRes = await http()
      .post(`/api/v1/assessments/${assessmentId}/assign`)
      .set('Cookie', committeeCookie)
      .send({ reviewerIds: [reviewerId1, reviewerId2] })
      .expect(200);

    expect(assignRes.body.data.status).toBe('in_review');

    // Verify 2 assignments created
    const assignments = await prisma.reviewAssignment.findMany({
      where: { assessmentId },
    });
    expect(assignments.length).toBe(2);
    expect(assignments.map((a) => a.reviewerId).sort()).toEqual([reviewerId1, reviewerId2].sort());

    // Verify transition created
    const transitions = await prisma.assessmentTransition.findMany({
      where: { assessmentId },
    });
    expect(transitions.some((t) => t.toStatus === 'in_review')).toBe(true);
  });

  it('rejects reviewer with shared team (conflict of interest)', async () => {
    // Create another assessment to test conflict
    const subjectCookie = cookieFor(subjectUserId, ['Member']);
    const createRes = await http()
      .post('/api/v1/assessments')
      .set('Cookie', subjectCookie)
      .send({})
      .expect(201);
    const conflictAssessmentId = createRes.body.data.id;

    // Add clip
    await prisma.clip.create({
      data: {
        assessmentId: conflictAssessmentId,
        objectKey: `clip-${randomUUID()}`,
        status: 'uploaded',
      },
    });

    // Submit
    await http()
      .post(`/api/v1/assessments/${conflictAssessmentId}/submit`)
      .set('Cookie', subjectCookie)
      .expect(200);

    const committeeCookie = cookieFor(randomUUID(), ['Committee']);

    // Try to assign conflict reviewer -> 409
    const conflictRes = await http()
      .post(`/api/v1/assessments/${conflictAssessmentId}/assign`)
      .set('Cookie', committeeCookie)
      .send({ reviewerIds: [conflictReviewerId] })
      .expect(409);

    expect(conflictRes.body.error?.code).toBe('REVIEWER_CONFLICT_OF_INTEREST');

    // Verify no assignments created (transaction rolled back)
    const assignments = await prisma.reviewAssignment.findMany({
      where: { assessmentId: conflictAssessmentId },
    });
    expect(assignments.length).toBe(0);
  });

  it('rejects subject as reviewer', async () => {
    const subjectCookie = cookieFor(subjectUserId, ['Member']);
    // First add Reviewer role to subject
    await prisma.userRole.create({
      data: { userId: subjectUserId, role: 'Reviewer' },
    });

    const committeeCookie = cookieFor(randomUUID(), ['Committee']);

    const selfRes = await http()
      .post(`/api/v1/assessments/${assessmentId}/assign`)
      .set('Cookie', committeeCookie)
      .send({ reviewerIds: [subjectUserId] })
      .expect(409);

    expect(selfRes.body.error?.code).toBe('REVIEWER_CONFLICT_OF_INTEREST');
  });

  it('rejects non-reviewer user', async () => {
    const committeeCookie = cookieFor(randomUUID(), ['Committee']);

    const nonRes = await http()
      .post(`/api/v1/assessments/${assessmentId}/assign`)
      .set('Cookie', committeeCookie)
      .send({ reviewerIds: [nonReviewerId] })
      .expect(409);

    expect(nonRes.body.error?.code).toBe('REVIEWER_NOT_ELIGIBLE');
  });

  it('rejects duplicate reviewer IDs', async () => {
    const committeeCookie = cookieFor(randomUUID(), ['Committee']);

    const dupRes = await http()
      .post(`/api/v1/assessments/${assessmentId}/assign`)
      .set('Cookie', committeeCookie)
      .send({ reviewerIds: [reviewerId1, reviewerId1] })
      .expect(400);

    expect(dupRes.body.error?.code).toBe('VALIDATION_FAILED');
  });

  it('requires Committee role', async () => {
    const memberCookie = cookieFor(randomUUID(), ['Member']);

    await http()
      .post(`/api/v1/assessments/${assessmentId}/assign`)
      .set('Cookie', memberCookie)
      .send({ reviewerIds: [reviewerId1] })
      .expect(403);
  });
});
