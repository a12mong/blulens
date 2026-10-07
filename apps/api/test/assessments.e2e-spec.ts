import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();

describe('assessments (bl-10 wave 3)', () => {
  let app: INestApplication;
  let userId: string;
  let otherUserId: string;
  let testToken: string;

  const http = () => request(app.getHttpServer());

  const cookieFor = (id: string, roles: string[]) =>
    `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();

    // Create test user (no roles in DB, roles via cookie)
    const email = `assessments-${randomUUID()}@test.local`;
    const password = 'test-password-123';
    const reg = await http()
      .post('/api/v1/auth/register')
      .send({ email, password, displayName: 'Test User' })
      .expect(201);
    userId = reg.body.data.id;

    // Create another user for cross-user tests
    const otherEmail = `assessments-other-${randomUUID()}@test.local`;
    const otherReg = await http()
      .post('/api/v1/auth/register')
      .send({ email: otherEmail, password: 'test-password-123', displayName: 'Other User' })
      .expect(201);
    otherUserId = otherReg.body.data.id;

    testToken = `ta${randomUUID().slice(0, 6)}`;

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
  });

  afterAll(async () => {
    // Disable users to prevent FK constraint issues
    await prisma.user.updateMany({
      where: { id: { in: [userId, otherUserId] } },
      data: { status: 'disabled' },
    });
    await prisma.$disconnect();
    await app.close();
  });

  it('opens a draft request and submits it once a clip is uploaded', async () => {
    const memberCookie = cookieFor(userId, ['Member']);

    // Create a draft assessment (standalone, no event)
    const createRes = await http()
      .post('/api/v1/assessments')
      .set('Cookie', memberCookie)
      .send({ note: 'test note' })
      .expect(201);

    const assessmentId = createRes.body.data.id;
    expect(createRes.body.data.status).toBe('draft');
    expect(createRes.body.data.reviewsRequired).toBe(2); // system default
    expect(createRes.body.data.note).toBe('test note');

    // Try to submit without clip -> 409
    await http()
      .post(`/api/v1/assessments/${assessmentId}/submit`)
      .set('Cookie', memberCookie)
      .expect(409);

    // Add an uploaded clip
    await prisma.clip.create({
      data: {
        assessmentId,
        objectKey: `clip-${randomUUID()}`,
        status: 'uploaded',
      },
    });

    // Submit successfully
    const submitRes = await http()
      .post(`/api/v1/assessments/${assessmentId}/submit`)
      .set('Cookie', memberCookie)
      .expect(200);

    expect(submitRes.body.data.status).toBe('submitted');
    expect(submitRes.body.data.reviewsRequired).toBe(2);
    expect(submitRes.body.data.reviewsSubmitted).toBe(0);
  });

  it('uses event minReviewers when submitting', async () => {
    const memberCookie = cookieFor(userId, ['Member']);

    // Create tournament first
    const tournament = await prisma.tournament.create({
      data: {
        name: 'Test Tournament',
        startsOn: new Date('2026-12-01'),
        entriesCloseAt: new Date('2026-11-15'),
      },
    });

    // Create event with minReviewers 3
    const event = await prisma.event.create({
      data: {
        tournamentId: tournament.id,
        minReviewers: 3,
        discipline: 'MS',
        gradeMinIndex: 0,
        gradeMaxIndex: 14,
      },
    });

    // Create assessment with event
    const createRes = await http()
      .post('/api/v1/assessments')
      .set('Cookie', memberCookie)
      .send({ eventId: event.id })
      .expect(201);

    const assessmentId = createRes.body.data.id;

    // Add clip and submit
    await prisma.clip.create({
      data: {
        assessmentId,
        objectKey: `clip-${randomUUID()}`,
        status: 'uploaded',
      },
    });

    const submitRes = await http()
      .post(`/api/v1/assessments/${assessmentId}/submit`)
      .set('Cookie', memberCookie)
      .expect(200);

    expect(submitRes.body.data.status).toBe('submitted');
    expect(submitRes.body.data.reviewsRequired).toBe(3);
  });

  it('prevents re-submission', async () => {
    const memberCookie = cookieFor(userId, ['Member']);

    // Create and submit
    const createRes = await http()
      .post('/api/v1/assessments')
      .set('Cookie', memberCookie)
      .send({})
      .expect(201);

    const assessmentId = createRes.body.data.id;

    await prisma.clip.create({
      data: {
        assessmentId,
        objectKey: `clip-${randomUUID()}`,
        status: 'uploaded',
      },
    });

    await http()
      .post(`/api/v1/assessments/${assessmentId}/submit`)
      .set('Cookie', memberCookie)
      .expect(200);

    // Try to submit again -> 409
    await http()
      .post(`/api/v1/assessments/${assessmentId}/submit`)
      .set('Cookie', memberCookie)
      .expect(409);
  });

  it('another Member cannot submit someone else\'s draft (ownership check)', async () => {
    const memberCookie = cookieFor(userId, ['Member']);
    const otherMemberCookie = cookieFor(otherUserId, ['Member']);

    // User 1 creates a draft
    const createRes = await http()
      .post('/api/v1/assessments')
      .set('Cookie', memberCookie)
      .send({})
      .expect(201);

    const assessmentId = createRes.body.data.id;

    // Add clip
    await prisma.clip.create({
      data: {
        assessmentId,
        objectKey: `clip-${randomUUID()}`,
        status: 'uploaded',
      },
    });

    // User 2 tries to submit User 1's assessment -> 404
    await http()
      .post(`/api/v1/assessments/${assessmentId}/submit`)
      .set('Cookie', otherMemberCookie)
      .expect(404);
  });

  it('Reviewer-only role cannot create assessments (Member role required)', async () => {
    const reviewerCookie = cookieFor(userId, ['Reviewer']);

    // Try to create with Reviewer role -> 403
    await http()
      .post('/api/v1/assessments')
      .set('Cookie', reviewerCookie)
      .send({})
      .expect(403);
  });

  it('creates assessment_transitions row on successful submit', async () => {
    const memberCookie = cookieFor(userId, ['Member']);

    // Create and submit
    const createRes = await http()
      .post('/api/v1/assessments')
      .set('Cookie', memberCookie)
      .send({})
      .expect(201);

    const assessmentId = createRes.body.data.id;

    // Add clip and submit
    await prisma.clip.create({
      data: {
        assessmentId,
        objectKey: `clip-${randomUUID()}`,
        status: 'uploaded',
      },
    });

    await http()
      .post(`/api/v1/assessments/${assessmentId}/submit`)
      .set('Cookie', memberCookie)
      .expect(200);

    // Verify exactly one transition row exists
    const transitions = await prisma.assessmentTransition.findMany({
      where: { assessmentId },
    });

    expect(transitions.length).toBe(1);
    expect(transitions[0]!.fromStatus).toBe('draft');
    expect(transitions[0]!.toStatus).toBe('submitted');
    expect(transitions[0]!.actorId).toBe(userId);
  });

  it('submit without clip returns 409 ASSESSMENT_NO_CLIP', async () => {
    const memberCookie = cookieFor(userId, ['Member']);

    // Create draft
    const createRes = await http()
      .post('/api/v1/assessments')
      .set('Cookie', memberCookie)
      .send({})
      .expect(201);

    const assessmentId = createRes.body.data.id;

    // Try to submit without any clip -> 409
    const submitRes = await http()
      .post(`/api/v1/assessments/${assessmentId}/submit`)
      .set('Cookie', memberCookie)
      .expect(409);

    expect(submitRes.body.error?.code).toBe('ASSESSMENT_NO_CLIP');
  });
});
