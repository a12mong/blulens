import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-cal-detail-${randomUUID().slice(0, 8)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

describe('GET /calibration-sets/{id} (bl-35-3)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  let committeeId: string;
  let committeeCookie: string;
  let reviewerId1: string;
  let reviewerId2: string;
  let reviewerCookie: string;
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

    // Create calibration set
    const createRes = await http()
      .post('/api/v1/calibration-sets')
      .set('Cookie', committeeCookie)
      .send({ name: `${tag} Test Set`, period: '2026-Q4' })
      .expect(201);
    setId = createRes.body.data.id;

    // Create 2 clips
    const clip1 = await prisma.calibrationClip.create({
      data: {
        setId,
        objectKey: '/e2e/sample.mp4',
        referenceIndex: 0,
        status: 'uploaded',
        durationSec: 4,
      },
    });

    const clip2 = await prisma.calibrationClip.create({
      data: {
        setId,
        objectKey: `${tag}-pending`,
        referenceIndex: 1,
        status: 'pending_upload',
      },
    });

    // Create review assignments for both clips, both reviewers
    // Reviewer 1: both clips assigned, one submitted
    await prisma.reviewAssignment.create({
      data: {
        kind: 'calibration',
        calibrationClipId: clip1.id,
        reviewerId: reviewerId1,
        state: 'open',
        dueAt: new Date(),
      },
    });

    await prisma.reviewAssignment.create({
      data: {
        kind: 'calibration',
        calibrationClipId: clip2.id,
        reviewerId: reviewerId1,
        state: 'submitted',
        dueAt: new Date(),
      },
    });

    // Reviewer 2: both clips assigned, none submitted
    await prisma.reviewAssignment.create({
      data: {
        kind: 'calibration',
        calibrationClipId: clip1.id,
        reviewerId: reviewerId2,
        state: 'open',
        dueAt: new Date(),
      },
    });

    await prisma.reviewAssignment.create({
      data: {
        kind: 'calibration',
        calibrationClipId: clip2.id,
        reviewerId: reviewerId2,
        state: 'open',
        dueAt: new Date(),
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

  it('Committee -> 200 with clipDetails and reviewers summary', async () => {
    const res = await http()
      .get(`/api/v1/calibration-sets/${setId}`)
      .set('Cookie', committeeCookie)
      .expect(200);

    expect(res.body.data).toBeDefined();
    const detail = res.body.data;

    // Check basic fields
    expect(detail.id).toBe(setId);
    expect(detail.period).toBe('2026-Q4');
    expect(detail.assignedAt).toBeNull();
    expect(typeof detail.createdAt).toBe('string');

    // Check clipDetails
    expect(Array.isArray(detail.clipDetails)).toBe(true);
    expect(detail.clipDetails).toHaveLength(2);

    // Clip 1: uploaded with viewUrl
    const clip1 = detail.clipDetails[0];
    expect(clip1.clipId).toBeDefined();
    expect(clip1.status).toBe('uploaded');
    expect(clip1.viewUrl).toBe('/e2e/sample.mp4');
    expect(clip1.durationSec).toBe(4);

    // Clip 2: pending_upload without viewUrl
    const clip2 = detail.clipDetails[1];
    expect(clip2.status).toBe('pending_upload');
    expect(clip2.viewUrl).toBeNull();
    expect(clip2.durationSec).toBeNull();

    // Check reviewers (sorted by name)
    expect(Array.isArray(detail.reviewers)).toBe(true);
    expect(detail.reviewers).toHaveLength(2);

    // Both reviewers should have assigned=2
    expect(detail.reviewers.every((r: { assigned: number }) => r.assigned === 2)).toBe(true);

    // Reviewer A: assigned=2, submitted=1
    const reviewerA = detail.reviewers.find(
      (r: { reviewerName: string }) => r.reviewerName === `${tag} Reviewer A`,
    );
    expect(reviewerA).toBeDefined();
    expect(reviewerA.submitted).toBe(1);

    // Reviewer B: assigned=2, submitted=0
    const reviewerB = detail.reviewers.find(
      (r: { reviewerName: string }) => r.reviewerName === `${tag} Reviewer B`,
    );
    expect(reviewerB).toBeDefined();
    expect(reviewerB.submitted).toBe(0);
  });

  it('an uploaded bucket clip gets a presigned viewUrl; clips[] carries the reference keys', async () => {
    const bucketClip = await prisma.calibrationClip.create({
      data: {
        setId,
        objectKey: `calibration/${setId}/bucket.mp4`,
        referenceIndex: 10,
        status: 'uploaded',
        durationSec: 9,
      },
    });
    const res = await http()
      .get(`/api/v1/calibration-sets/${setId}`)
      .set('Cookie', committeeCookie)
      .expect(200);
    const detail = res.body.data;
    const clip = detail.clipDetails.find((c: { clipId: string }) => c.clipId === bucketClip.id);
    expect(clip.viewUrl).toMatch(
      new RegExp(`/calibration/${setId}/bucket\.mp4\?.*X-Amz-Expires=900`),
    );
    expect(detail.clips).toContainEqual({ clipId: bucketClip.id, referenceKey: 'N' });
  });

  it('Unknown id -> 404 CALIBRATION_SET_NOT_FOUND', async () => {
    const res = await http()
      .get(`/api/v1/calibration-sets/${randomUUID()}`)
      .set('Cookie', committeeCookie)
      .expect(404);

    expect(res.body.error?.code).toBe('CALIBRATION_SET_NOT_FOUND');
  });

  it('Reviewer -> 403', async () => {
    await http().get(`/api/v1/calibration-sets/${setId}`).set('Cookie', reviewerCookie).expect(403);
  });
});
