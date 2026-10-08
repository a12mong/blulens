import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-cal-assign-${randomUUID().slice(0, 8)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

describe('POST /calibration-sets/{id}/assign (bl-35-5)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  let committeeId: string;
  let committeeCookie: string;
  let reviewerId1: string;
  let reviewerId2: string;
  let reviewerCookie: string;
  let memberId: string;
  let memberCookie: string;
  let setId: string;

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

    // Create reviewer users
    const reviewer1 = await prisma.user.create({
      data: {
        email: `${tag}-reviewer1@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Reviewer A`,
      },
    });
    reviewerId1 = reviewer1.id;
    await prisma.userRole.create({ data: { userId: reviewerId1, role: 'Reviewer' } });

    const reviewer2 = await prisma.user.create({
      data: {
        email: `${tag}-reviewer2@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Reviewer B`,
      },
    });
    reviewerId2 = reviewer2.id;
    await prisma.userRole.create({ data: { userId: reviewerId2, role: 'Reviewer' } });
    reviewerCookie = cookieFor(reviewerId1, ['Reviewer']);

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

    // Create calibration set
    const createRes = await http()
      .post('/api/v1/calibration-sets')
      .set('Cookie', committeeCookie)
      .send({ name: `${tag} Test Set`, period: '2026-Q4' })
      .expect(201);
    setId = createRes.body.data.id;

    // Create 2 uploaded clips
    await prisma.calibrationClip.create({
      data: {
        setId,
        objectKey: '/e2e/sample.mp4',
        referenceIndex: 0,
        status: 'uploaded',
      },
    });

    await prisma.calibrationClip.create({
      data: {
        setId,
        objectKey: 'another-key',
        referenceIndex: 1,
        status: 'uploaded',
      },
    });
  });

  afterAll(async () => {
    await app.close();
    // Cleanup
    await prisma.reviewAssignment.deleteMany({ where: { calibrationClip: { setId } } });
    await prisma.calibrationClip.deleteMany({ where: { setId } });
    await prisma.calibrationSet.deleteMany({ where: { id: setId } });
    const users = await prisma.user.findMany({ where: { email: { contains: tag } } });
    await prisma.userRole.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    await prisma.user.updateMany({
      where: { id: { in: users.map((u) => u.id) } },
      data: { status: 'disabled' },
    });
  });

  it('Committee -> 204 assigns 2 reviewers to 2 clips (4 assignments)', async () => {
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + 7);

    await http()
      .post(`/api/v1/calibration-sets/${setId}/assign`)
      .set('Cookie', committeeCookie)
      .send({ reviewerIds: [reviewerId1, reviewerId2], dueAt: dueAt.toISOString() })
      .expect(204);

    // Verify assignments created (4 total: 2 reviewers × 2 clips)
    const assignments = await prisma.reviewAssignment.findMany({
      where: {
        kind: 'calibration',
        calibrationClip: { setId },
      },
    });
    expect(assignments).toHaveLength(4);

    // Verify set.assignedAt is set
    const set = await prisma.calibrationSet.findUniqueOrThrow({ where: { id: setId } });
    expect(set.assignedAt).not.toBeNull();
  });

  it('Re-assigning with one old + one new reviewer -> 204 and 6 assignments total', async () => {
    const newReviewerId = (
      await prisma.user.create({
        data: {
          email: `${tag}-reviewer3@test.local`,
          passwordHash: 'x',
          displayName: `${tag} Reviewer C`,
        },
      })
    ).id;

    await prisma.userRole.create({ data: { userId: newReviewerId, role: 'Reviewer' } });

    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + 7);

    // Re-assign with reviewer1 (existing) and newReviewer
    await http()
      .post(`/api/v1/calibration-sets/${setId}/assign`)
      .set('Cookie', committeeCookie)
      .send({ reviewerIds: [reviewerId1, newReviewerId], dueAt: dueAt.toISOString() })
      .expect(204);

    // Verify total is 6 (4 original + 2 new: newReviewer × 2 clips)
    // skipDuplicates prevents reviewer1 assignments from being added again
    const assignments = await prisma.reviewAssignment.findMany({
      where: {
        kind: 'calibration',
        calibrationClip: { setId },
      },
    });
    expect(assignments).toHaveLength(6);

    // Cleanup new reviewer
    await prisma.userRole.deleteMany({ where: { userId: newReviewerId } });
    await prisma.user.update({ where: { id: newReviewerId }, data: { status: 'disabled' } });
  });

  it('Pending_upload clip -> 409 CALIBRATION_CLIPS_NOT_READY', async () => {
    // Create new set with pending clip
    const setRes = await http()
      .post('/api/v1/calibration-sets')
      .set('Cookie', committeeCookie)
      .send({ name: `${tag} Pending Set` })
      .expect(201);
    const pendingSetId = setRes.body.data.id;

    await prisma.calibrationClip.create({
      data: {
        setId: pendingSetId,
        objectKey: 'pending-key',
        referenceIndex: 0,
        status: 'pending_upload',
      },
    });

    const res = await http()
      .post(`/api/v1/calibration-sets/${pendingSetId}/assign`)
      .set('Cookie', committeeCookie)
      .send({ reviewerIds: [reviewerId1] })
      .expect(409);

    expect(res.body.error?.code).toBe('CALIBRATION_CLIPS_NOT_READY');

    // Cleanup
    await prisma.calibrationClip.deleteMany({ where: { setId: pendingSetId } });
    await prisma.calibrationSet.delete({ where: { id: pendingSetId } });
  });

  it('Member userId -> 409 REVIEWER_NOT_ELIGIBLE with details', async () => {
    // Create new set for this test
    const testSetRes = await http()
      .post('/api/v1/calibration-sets')
      .set('Cookie', committeeCookie)
      .send({ name: `${tag} Test Set 2` })
      .expect(201);
    const testSetId = testSetRes.body.data.id;

    await prisma.calibrationClip.create({
      data: {
        setId: testSetId,
        objectKey: 'test-key',
        referenceIndex: 0,
        status: 'uploaded',
      },
    });

    const res = await http()
      .post(`/api/v1/calibration-sets/${testSetId}/assign`)
      .set('Cookie', committeeCookie)
      .send({ reviewerIds: [memberId] })
      .expect(409);

    expect(res.body.error?.code).toBe('REVIEWER_NOT_ELIGIBLE');
    expect(res.body.error?.details?.userId).toBe(memberId);

    // Cleanup
    await prisma.calibrationClip.deleteMany({ where: { setId: testSetId } });
    await prisma.calibrationSet.delete({ where: { id: testSetId } });
  });

  it('Empty reviewerIds -> 400 VALIDATION_FAILED', async () => {
    const res = await http()
      .post(`/api/v1/calibration-sets/${setId}/assign`)
      .set('Cookie', committeeCookie)
      .send({ reviewerIds: [] })
      .expect(400);

    expect(res.body.error?.code).toBe('VALIDATION_FAILED');
  });

  it('Duplicate reviewerIds -> 400 VALIDATION_FAILED', async () => {
    const res = await http()
      .post(`/api/v1/calibration-sets/${setId}/assign`)
      .set('Cookie', committeeCookie)
      .send({ reviewerIds: [reviewerId1, reviewerId1] })
      .expect(400);

    expect(res.body.error?.code).toBe('VALIDATION_FAILED');
  });

  it('Reviewer role -> 403', async () => {
    await http()
      .post(`/api/v1/calibration-sets/${setId}/assign`)
      .set('Cookie', reviewerCookie)
      .send({ reviewerIds: [reviewerId2] })
      .expect(403);
  });
});
