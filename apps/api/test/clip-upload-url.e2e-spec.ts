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

const mp4 = { fileName: 'serve.mp4', contentType: 'video/mp4', sizeBytes: 1000 };

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

  const requestUrl = (id: string, cookie: string, body: Record<string, unknown> = mp4) =>
    http().post(`/api/v1/assessments/${id}/clips/upload-url`).set('Cookie', cookie).send(body);
  const member = () => cookieFor(memberId, ['Member']);

  it('valid body -> 200; PUT to uploadUrl stores the bytes; clip row pending_upload with the key convention', async () => {
    const res = await requestUrl(draftAssessmentId, member()).expect(200);
    const { clipId, uploadUrl, expiresAt } = res.body.data;
    expect(clipId).toEqual(expect.any(String));
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now() + 14 * 60 * 1000);

    const put = await fetch(uploadUrl, { method: 'PUT', body: Buffer.alloc(1000, 1), headers: { 'Content-Type': 'video/mp4' } });
    expect(put.status).toBe(200);

    const clip = await prisma.clip.findUniqueOrThrow({ where: { id: clipId } });
    expect(clip).toMatchObject({
      assessmentId: draftAssessmentId,
      status: 'pending_upload',
      objectKey: `clips/${draftAssessmentId}/${clipId}.mp4`,
      contentType: 'video/mp4',
      sizeBytes: BigInt(1000),
    });
    expect(clip.uploadExpiresAt?.toISOString()).toBe(expiresAt);
  });

  it('contentType video/avi -> 400; sizeBytes over 500 MB -> 400 VALIDATION_FAILED', async () => {
    const avi = await requestUrl(draftAssessmentId, member(), { ...mp4, contentType: 'video/avi' }).expect(400);
    expect(avi.body.error.code).toBe('VALIDATION_FAILED');
    const big = await requestUrl(draftAssessmentId, member(), { ...mp4, sizeBytes: 524288001 }).expect(400);
    expect(big.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('4th clip on one draft -> 409 CLIP_LIMIT_REACHED; a rejected clip frees a slot', async () => {
    const draft = await prisma.assessment.create({ data: { subjectUserId: memberId, status: 'draft' } });
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) ids.push((await requestUrl(draft.id, member()).expect(200)).body.data.clipId);

    const res = await requestUrl(draft.id, member()).expect(409);
    expect(res.body.error.code).toBe('CLIP_LIMIT_REACHED');

    await prisma.clip.update({ where: { id: ids[0] }, data: { status: 'rejected' } });
    await requestUrl(draft.id, member()).expect(200);
  });

  it('submitted assessment -> 409 ASSESSMENT_NOT_DRAFT', async () => {
    const res = await requestUrl(assessmentId, member()).expect(409);
    expect(res.body.error.code).toBe('ASSESSMENT_NOT_DRAFT');
  });

  it('another member -> 404 ASSESSMENT_NOT_FOUND; Reviewer -> 403; unauthenticated -> 401', async () => {
    const res = await requestUrl(draftAssessmentId, cookieFor(otherMemberId, ['Member'])).expect(404);
    expect(res.body.error.code).toBe('ASSESSMENT_NOT_FOUND');
    await requestUrl(draftAssessmentId, cookieFor(reviewerId, ['Reviewer'])).expect(403);
    await http().post(`/api/v1/assessments/${draftAssessmentId}/clips/upload-url`).send(mp4).expect(401);
  });
});
