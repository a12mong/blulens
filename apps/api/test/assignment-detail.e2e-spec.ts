import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-asg-${randomUUID().slice(0, 8)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

function findKeysDeep(obj: unknown, forbiddenKeys: string[]): string[] {
  const found: string[] = [];
  if (!obj || typeof obj !== 'object') {
    return found;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      found.push(...findKeysDeep(item, forbiddenKeys));
    }
    return found;
  }
  for (const [k, v] of Object.entries(obj)) {
    if (forbiddenKeys.includes(k)) {
      found.push(k);
    }
    found.push(...findKeysDeep(v, forbiddenKeys));
  }
  return found;
}

describe('GET /reviews/assignments/:assignmentId (bl-10-3h assignment detail)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const userIds: string[] = [];
  const assessmentIds: string[] = [];
  const clipIds: string[] = [];
  const calSetIds: string[] = [];
  const calClipIds: string[] = [];
  const assignmentIds: string[] = [];

  let r1Id: string;
  let r2Id: string;
  let r1Cookie: string;
  let r2Cookie: string;
  const memberCookie = cookieFor(randomUUID(), ['Member']);

  let a1Id: string;
  let a2MinioId: string;
  let a3CalId: string;
  let clip1Id: string;
  let clip2Id: string;
  let clip3Id: string;
  let calClipId: string;
  let a1DueAt: Date;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();

    // 1. Users
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
    r1Id = r1.id;
    r1Cookie = cookieFor(r1Id, ['Reviewer']);

    const r2 = await prisma.user.create({
      data: { email: `${tag}-r2@test.local`, passwordHash: 'x', displayName: `${tag} R2` },
    });
    userIds.push(r2.id);
    r2Id = r2.id;
    r2Cookie = cookieFor(r2Id, ['Reviewer']);

    // 2. Active rubric
    const rubric = await prisma.rubric.findFirst({ where: { active: true } });
    if (!rubric) throw new Error('Active rubric not found');

    // 3. Assessment 1 with 2 clips: one uploaded with web query key, one pending_upload
    const assess1 = await prisma.assessment.create({
      data: { subjectUserId: subject.id, rubricId: rubric.id, status: 'in_review' },
    });
    assessmentIds.push(assess1.id);

    clip1Id = randomUUID();
    const clip1 = await prisma.clip.create({
      data: {
        id: clip1Id,
        assessmentId: assess1.id,
        objectKey: `/e2e/sample.mp4?c=${clip1Id}`,
        status: 'uploaded',
        durationSec: 4,
      },
    });
    clipIds.push(clip1.id);

    clip2Id = randomUUID();
    const clip2 = await prisma.clip.create({
      data: {
        id: clip2Id,
        assessmentId: assess1.id,
        objectKey: `clips/${assess1.id}/${clip2Id}`,
        status: 'pending_upload',
        durationSec: null,
      },
    });
    clipIds.push(clip2.id);

    a1DueAt = new Date(Date.now() + 24 * 3600 * 1000);
    const a1 = await prisma.reviewAssignment.create({
      data: {
        kind: 'assessment',
        assessmentId: assess1.id,
        reviewerId: r1Id,
        state: 'open',
        dueAt: a1DueAt,
      },
    });
    a1Id = a1.id;
    assignmentIds.push(a1.id);

    // 4. Assessment 2 with MinIO-style objectKey and uploaded status
    const assess2 = await prisma.assessment.create({
      data: { subjectUserId: subject.id, rubricId: rubric.id, status: 'in_review' },
    });
    assessmentIds.push(assess2.id);

    clip3Id = randomUUID();
    const clip3 = await prisma.clip.create({
      data: {
        id: clip3Id,
        assessmentId: assess2.id,
        objectKey: `clips/${assess2.id}/${clip3Id}`,
        status: 'uploaded',
        durationSec: 10,
      },
    });
    clipIds.push(clip3.id);

    const a2 = await prisma.reviewAssignment.create({
      data: {
        kind: 'assessment',
        assessmentId: assess2.id,
        reviewerId: r1Id,
        state: 'open',
        dueAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });
    a2MinioId = a2.id;
    assignmentIds.push(a2.id);

    // 5. Calibration set & clip
    const calSet = await prisma.calibrationSet.create({
      data: { name: `${tag} CalSet`, createdBy: subject.id },
    });
    calSetIds.push(calSet.id);

    calClipId = randomUUID();
    const calClip = await prisma.calibrationClip.create({
      data: {
        id: calClipId,
        setId: calSet.id,
        objectKey: `/e2e/sample.mp4?c=${calClipId}`,
        status: 'uploaded',
        referenceIndex: 7,
        durationSec: 5,
      },
    });
    calClipIds.push(calClip.id);

    const a3 = await prisma.reviewAssignment.create({
      data: {
        kind: 'calibration',
        calibrationClipId: calClip.id,
        reviewerId: r1Id,
        state: 'open',
        dueAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });
    a3CalId = a3.id;
    assignmentIds.push(a3.id);
  });

  afterAll(async () => {
    await prisma.reviewScore.deleteMany({
      where: { review: { assignmentId: { in: assignmentIds } } },
    });
    await prisma.review.deleteMany({ where: { assignmentId: { in: assignmentIds } } });
    await prisma.reviewAssignment.deleteMany({ where: { id: { in: assignmentIds } } });
    await prisma.clip.deleteMany({ where: { id: { in: clipIds } } });
    await prisma.calibrationClip.deleteMany({ where: { id: { in: calClipIds } } });
    await prisma.calibrationSet.deleteMany({ where: { id: { in: calSetIds } } });
    await prisma.user.updateMany({ where: { id: { in: userIds } }, data: { status: 'disabled' } });
    await prisma.$disconnect();
    await app.close();
  });

  describe('GET /reviews/assignments/:assignmentId', () => {
    it('returns assignment detail for the assigned reviewer with blind fields and correct clips/viewUrls', async () => {
      const res = await http()
        .get(`/api/v1/reviews/assignments/${a1Id}`)
        .set('Cookie', r1Cookie)
        .expect(200);

      expect(res.body.success).toBe(true);
      const data = res.body.data;

      // 1. Blind check: exact allowed root keys
      expect(Object.keys(data).sort()).toEqual(
        ['clips', 'dueAt', 'id', 'myScores', 'rubric', 'state', 'submittedAt'].sort(),
      );

      // 2. Strict forbidden key scan across whole response payload
      const forbidden = [
        'assessmentId',
        'subjectUserId',
        'eventId',
        'subject',
        'reviewerId',
        'calibrationClipId',
        'kind',
        'result',
        'results',
        'secondOpinion',
      ];
      expect(findKeysDeep(data, forbidden)).toEqual([]);

      // 3. Task state & dates
      expect(data.id).toBe(a1Id);
      expect(data.state).toBe('open');
      expect(data.dueAt).toBe(a1DueAt.toISOString());
      expect(data.submittedAt).toBeNull();
      expect(data.myScores).toEqual([]);

      // 4. Rubric
      expect(data.rubric.methodVersion).toBe('grading-v1');
      expect(Array.isArray(data.rubric.criteria)).toBe(true);
      expect(data.rubric.criteria).toHaveLength(6);
      expect(data.rubric.params).toBeUndefined();
      expect(data.rubric.id).toBeUndefined();

      // 5. Clips with viewUrl rule v1
      expect(Array.isArray(data.clips)).toBe(true);
      expect(data.clips).toHaveLength(2);

      const firstClip = data.clips[0];
      expect(firstClip.id).toBe(clip1Id);
      expect(firstClip.status).toBe('uploaded');
      expect(firstClip.viewUrl).toBe(`/e2e/sample.mp4?c=${clip1Id}`);
      expect(firstClip.durationSec).toBe(4);
      expect(firstClip.objectKey).toBeUndefined();
      expect(firstClip.assessmentId).toBeUndefined();

      const secondClip = data.clips[1];
      expect(secondClip.id).toBe(clip2Id);
      expect(secondClip.status).toBe('pending_upload');
      expect(secondClip.viewUrl).toBeNull();
      expect(secondClip.durationSec).toBeNull();
      expect(secondClip.objectKey).toBeUndefined();
      expect(secondClip.assessmentId).toBeUndefined();
    });

    it('returns 404 ASSIGNMENT_NOT_FOUND when requested by another reviewer', async () => {
      const res = await http()
        .get(`/api/v1/reviews/assignments/${a1Id}`)
        .set('Cookie', r2Cookie)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ASSIGNMENT_NOT_FOUND');
    });

    it('returns 404 ASSIGNMENT_NOT_FOUND for non-existent assignment id', async () => {
      const res = await http()
        .get(`/api/v1/reviews/assignments/${randomUUID()}`)
        .set('Cookie', r1Cookie)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ASSIGNMENT_NOT_FOUND');
    });

    it('returns 403 FORBIDDEN when requested with Member role', async () => {
      await http()
        .get(`/api/v1/reviews/assignments/${a1Id}`)
        .set('Cookie', memberCookie)
        .expect(403);
    });

    it('returns 401 UNAUTHENTICATED when requested without authentication', async () => {
      await http().get(`/api/v1/reviews/assignments/${a1Id}`).expect(401);
    });

    it('returns 400 VALIDATION_FAILED when assignmentId is not a valid UUID', async () => {
      await http()
        .get('/api/v1/reviews/assignments/not-a-uuid')
        .set('Cookie', r1Cookie)
        .expect(400);
    });

    it('returns a 15-min presigned GET viewUrl for a bucket objectKey when uploaded (bl-36-4)', async () => {
      const res = await http()
        .get(`/api/v1/reviews/assignments/${a2MinioId}`)
        .set('Cookie', r1Cookie)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.clips).toHaveLength(1);
      expect(res.body.data.clips[0].id).toBe(clip3Id);
      expect(res.body.data.clips[0].status).toBe('uploaded');
      expect(res.body.data.clips[0].viewUrl).toMatch(/^http.*X-Amz-Expires=900/);
      expect(res.body.data.clips[0].durationSec).toBe(10);
      expect(res.body.data.clips[0].objectKey).toBeUndefined();
    });

    it('returns assignment detail for a calibration task without leaking calibration metadata', async () => {
      const res = await http()
        .get(`/api/v1/reviews/assignments/${a3CalId}`)
        .set('Cookie', r1Cookie)
        .expect(200);

      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.id).toBe(a3CalId);
      expect(data.state).toBe('open');
      expect(data.clips).toHaveLength(1);
      expect(data.clips[0].id).toBe(calClipId);
      expect(data.clips[0].viewUrl).toBe(`/e2e/sample.mp4?c=${calClipId}`);
      expect(data.clips[0].durationSec).toBe(5);

      // Leaks check
      expect(findKeysDeep(data, ['setId', 'referenceIndex', 'calibrationClipId', 'kind'])).toEqual(
        [],
      );
    });

    it('shows submitted scores in myScores after reviewer submits', async () => {
      const submittedScores = [
        { criterion: 'footwork', gradeKey: 'RK1' as const },
        { criterion: 'overhead', gradeKey: 'BG1' as const },
        { criterion: 'net', gradeKey: 'S' as const },
        { criterion: 'defense', gradeKey: 'P+' as const },
        { criterion: 'tactics', gradeKey: null },
        { criterion: 'consistency', gradeKey: 'N' as const },
      ];

      // Submit review
      const putRes = await http()
        .put(`/api/v1/reviews/assignments/${a1Id}`)
        .set('Cookie', r1Cookie)
        .send({ scores: submittedScores, comment: 'Good footwork' })
        .expect(200);

      expect(putRes.body.data.state).toBe('submitted');

      // Now GET assignment detail
      const res = await http()
        .get(`/api/v1/reviews/assignments/${a1Id}`)
        .set('Cookie', r1Cookie)
        .expect(200);

      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.state).toBe('submitted');
      expect(typeof data.submittedAt).toBe('string');
      expect(Array.isArray(data.myScores)).toBe(true);
      expect(data.myScores).toHaveLength(6);

      const scoreMap = new Map(data.myScores.map((s: any) => [s.criterion, s.gradeKey]));
      expect(scoreMap.get('footwork')).toBe('RK1');
      expect(scoreMap.get('overhead')).toBe('BG1');
      expect(scoreMap.get('net')).toBe('S');
      expect(scoreMap.get('defense')).toBe('P+');
      expect(scoreMap.get('tactics')).toBeNull();
      expect(scoreMap.get('consistency')).toBe('N');

      // Still blind
      const forbidden = ['assessmentId', 'subjectUserId', 'eventId', 'subject', 'reviewerId'];
      expect(findKeysDeep(data, forbidden)).toEqual([]);
    });
  });
});
