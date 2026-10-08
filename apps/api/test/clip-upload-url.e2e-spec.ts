import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-clip-${randomUUID().slice(0, 6)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

describe('clip-upload-url (bl-36-2)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  let memberId: string;
  let otherMemberId: string;
  let reviewerId: string;
  let assessmentId: string;
  let draftAssessmentId: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();

    // Create users
    const member = await prisma.user.create({
      data: { email: `${tag}-member@test.local`, passwordHash: 'x', displayName: `${tag} Member` },
    });
    memberId = member.id;

    const otherMember = await prisma.user.create({
      data: { email: `${tag}-other@test.local`, passwordHash: 'x', displayName: `${tag} Other` },
    });
    otherMemberId = otherMember.id;

    const reviewer = await prisma.user.create({
      data: { email: `${tag}-reviewer@test.local`, passwordHash: 'x', displayName: `${tag} Reviewer` },
    });
    reviewerId = reviewer.id;

    // Create draft assessment
    const draft = await prisma.assessment.create({
      data: {
        subjectUserId: memberId,
        status: 'draft',
      },
    });
    draftAssessmentId = draft.id;

    // Create submitted assessment (for ASSESSMENT_NOT_DRAFT test)
    const submitted = await prisma.assessment.create({
      data: {
        subjectUserId: memberId,
        status: 'submitted',
      },
    });
    assessmentId = submitted.id;
  });

  afterAll(async () => {
    // Cleanup
    const userIds = [memberId, otherMemberId, reviewerId].filter((id): id is string => !!id);
    await prisma.clip.deleteMany({ where: { assessment: { subjectUserId: { in: userIds } } } });
    await prisma.assessment.deleteMany({ where: { subjectUserId: { in: userIds } } });
    // Note: not deleting users per Kevin feedback - audit rows reference them
    await app.close();
  });

  it('POST upload-url with valid body -> 200 with clipId, uploadUrl, expiresAt', async () => {
    const res = await http()
      .post(`/api/v1/assessments/${draftAssessmentId}/clips/upload-url`)
      .set('Cookie', cookieFor(memberId, ['Member']))
      .send({
        fileName: 'test.mp4',
        contentType: 'video/mp4',
        sizeBytes: 1000,
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('clipId');
    expect(res.body.data).toHaveProperty('uploadUrl');
    expect(res.body.data).toHaveProperty('expiresAt');
    expect(res.body.data.uploadUrl).toContain('http');
  });

  it('POST upload-url contentType video/avi -> 400 VALIDATION_FAILED', async () => {
    const res = await http()
      .post(`/api/v1/assessments/${draftAssessmentId}/clips/upload-url`)
      .set('Cookie', cookieFor(memberId, ['Member']))
      .send({
        fileName: 'test.avi',
        contentType: 'video/avi',
        sizeBytes: 1000,
      });

    expect(res.status).toBe(400);
  });

  it('POST upload-url sizeBytes over limit -> 400', async () => {
    const res = await http()
      .post(`/api/v1/assessments/${draftAssessmentId}/clips/upload-url`)
      .set('Cookie', cookieFor(memberId, ['Member']))
      .send({
        fileName: 'test.mp4',
        contentType: 'video/mp4',
        sizeBytes: 524288001, // Over 500MB limit
      });

    expect(res.status).toBe(400);
  });

  it('POST upload-url 4th clip -> 409 CLIP_LIMIT_REACHED', async () => {
    // Create 3 clips
    for (let i = 0; i < 3; i++) {
      const res = await http()
        .post(`/api/v1/assessments/${draftAssessmentId}/clips/upload-url`)
        .set('Cookie', cookieFor(memberId, ['Member']))
        .send({
          fileName: `test${i}.mp4`,
          contentType: 'video/mp4',
          sizeBytes: 1000,
        });
      expect(res.status).toBe(200);
    }

    // 4th should fail
    const res = await http()
      .post(`/api/v1/assessments/${draftAssessmentId}/clips/upload-url`)
      .set('Cookie', cookieFor(memberId, ['Member']))
      .send({
        fileName: 'test4.mp4',
        contentType: 'video/mp4',
        sizeBytes: 1000,
      });

    expect(res.status).toBe(409);
    expect(res.body.error?.code || res.body.code).toBe('CLIP_LIMIT_REACHED');
  });

  it('POST upload-url on submitted assessment -> 409 ASSESSMENT_NOT_DRAFT', async () => {
    const res = await http()
      .post(`/api/v1/assessments/${assessmentId}/clips/upload-url`)
      .set('Cookie', cookieFor(memberId, ['Member']))
      .send({
        fileName: 'test.mp4',
        contentType: 'video/mp4',
        sizeBytes: 1000,
      });

    expect(res.status).toBe(409);
    expect(res.body.error?.code || res.body.code).toBe('ASSESSMENT_NOT_DRAFT');
  });

  it('POST upload-url by other member -> 404 ASSESSMENT_NOT_FOUND', async () => {
    const res = await http()
      .post(`/api/v1/assessments/${draftAssessmentId}/clips/upload-url`)
      .set('Cookie', cookieFor(otherMemberId, ['Member']))
      .send({
        fileName: 'test.mp4',
        contentType: 'video/mp4',
        sizeBytes: 1000,
      });

    expect(res.status).toBe(404);
    expect(res.body.error?.code || res.body.code).toBe('ASSESSMENT_NOT_FOUND');
  });

  it('POST upload-url as Reviewer -> 403', async () => {
    const res = await http()
      .post(`/api/v1/assessments/${draftAssessmentId}/clips/upload-url`)
      .set('Cookie', cookieFor(reviewerId, ['Reviewer']))
      .send({
        fileName: 'test.mp4',
        contentType: 'video/mp4',
        sizeBytes: 1000,
      });

    expect(res.status).toBe(403);
  });

  it('Clip row is created with pending_upload status and correct objectKey', async () => {
    const res = await http()
      .post(`/api/v1/assessments/${draftAssessmentId}/clips/upload-url`)
      .set('Cookie', cookieFor(memberId, ['Member']))
      .send({
        fileName: 'verify.mp4',
        contentType: 'video/mp4',
        sizeBytes: 1000,
      });

    expect(res.status).toBe(200);
    const clipId = res.body.data.clipId;

    const clip = await prisma.clip.findUnique({ where: { id: clipId } });
    expect(clip).toBeDefined();
    expect(clip?.status).toBe('pending_upload');
    expect(clip?.objectKey).toMatch(/^clips\//);
    expect(clip?.assessmentId).toBe(draftAssessmentId);
    expect(clip?.contentType).toBe('video/mp4');
  });
});
