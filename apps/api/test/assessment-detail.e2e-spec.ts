import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-det-${randomUUID().slice(0, 8)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

describe('GET /api/v1/assessments/:assessmentId (bl-26-2 detail)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const userIds: string[] = [];
  const tournamentIds: string[] = [];
  const eventIds: string[] = [];

  let subjectId: string;
  let otherMemberId: string;
  let reviewer1Id: string;
  let reviewer2Id: string;
  let committeeId: string;

  let subjectCookie: string;
  let otherMemberCookie: string;
  let reviewerCookie: string;
  let committeeCookie: string;

  let assessmentId: string;
  let clip1Id: string;
  let clip2Id: string;

  const payloadAllS = {
    scores: [
      { criterion: 'footwork', gradeKey: 'S' },
      { criterion: 'overhead', gradeKey: 'S' },
      { criterion: 'net', gradeKey: 'S' },
      { criterion: 'defense', gradeKey: 'S' },
      { criterion: 'tactics', gradeKey: 'S' },
      { criterion: 'consistency', gradeKey: 'S' },
    ],
    comment: 'ฟอร์มการเล่นระดับ S',
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();

    // 1. Subject Member
    const subject = await prisma.user.create({
      data: {
        email: `${tag}-subject@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Subject Player`,
      },
    });
    userIds.push(subject.id);
    subjectId = subject.id;
    subjectCookie = cookieFor(subjectId, ['Member']);

    // 2. Other Member
    const otherMember = await prisma.user.create({
      data: {
        email: `${tag}-other@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Other Member`,
      },
    });
    userIds.push(otherMember.id);
    otherMemberId = otherMember.id;
    otherMemberCookie = cookieFor(otherMemberId, ['Member']);

    // 3. Reviewer 1
    const r1 = await prisma.user.create({
      data: {
        email: `${tag}-r1@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Reviewer One`,
      },
    });
    userIds.push(r1.id);
    reviewer1Id = r1.id;
    const r1Cookie = cookieFor(reviewer1Id, ['Reviewer']);

    // 4. Reviewer 2
    const r2 = await prisma.user.create({
      data: {
        email: `${tag}-r2@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Reviewer Two`,
      },
    });
    userIds.push(r2.id);
    reviewer2Id = r2.id;
    const r2Cookie = cookieFor(reviewer2Id, ['Reviewer']);

    reviewerCookie = r1Cookie;

    // 5. Committee
    const committee = await prisma.user.create({
      data: {
        email: `${tag}-comm@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Committee Officer`,
      },
    });
    userIds.push(committee.id);
    committeeId = committee.id;
    committeeCookie = cookieFor(committeeId, ['Committee']);

    // 6. Active rubric
    let rubric = await prisma.rubric.findFirst({ where: { active: true } });
    if (!rubric) {
      rubric = await prisma.rubric.create({
        data: {
          active: true,
          methodVersion: 'grading-v1',
          criteria: [
            { key: 'footwork', nameTh: 'ฟุตเวิร์ก', weight: 1 },
            { key: 'overhead', nameTh: 'ลูกเหนือศีรษะ', weight: 1 },
            { key: 'net', nameTh: 'ลูกหน้าเน็ต', weight: 1 },
            { key: 'defense', nameTh: 'เกมรับ', weight: 1 },
            { key: 'tactics', nameTh: 'แท็กติก', weight: 1 },
            { key: 'consistency', nameTh: 'ความแน่นอน', weight: 1 },
          ],
          params: {},
        },
      });
    }

    // 7. Tournament & Event with minReviewers = 2
    const tournament = await prisma.tournament.create({
      data: {
        name: `${tag} Tournament`,
        startsOn: new Date('2026-12-01'),
        entriesCloseAt: new Date('2026-11-25T17:00:00Z'),
        status: 'open',
      },
    });
    tournamentIds.push(tournament.id);

    const event = await prisma.event.create({
      data: {
        tournamentId: tournament.id,
        discipline: 'MS',
        gradeMinIndex: 6,
        gradeMaxIndex: 11,
        minReviewers: 2,
      },
    });
    eventIds.push(event.id);

    // 8. Assessment with 2 clips
    const assessment = await prisma.assessment.create({
      data: {
        subjectUserId: subjectId,
        eventId: event.id,
        rubricId: rubric.id,
        status: 'in_review',
        reviewsRequired: 2,
        note: 'test assessment for detail',
      },
    });
    assessmentId = assessment.id;

    // Clean up any residual clips from previous runs
    await prisma.clip.deleteMany({
      where: { objectKey: { in: ['/e2e/sample1.mp4', `/e2e/sample1-${tag}.mp4`] } },
    });

    // Clip 1: uploaded with relative viewUrl
    const clip1 = await prisma.clip.create({
      data: {
        assessmentId,
        objectKey: `/e2e/sample1-${tag}.mp4`,
        status: 'uploaded',
        durationSec: 5,
        createdAt: new Date(Date.now() - 2000),
      },
    });
    clip1Id = clip1.id;

    // Clip 2: pending_upload with S3-like objectKey
    const clip2 = await prisma.clip.create({
      data: {
        assessmentId,
        objectKey: `clips/raw/test2-${tag}.mp4`,
        status: 'pending_upload',
        durationSec: 10,
        createdAt: new Date(Date.now() - 1000),
      },
    });
    clip2Id = clip2.id;

    // 9. Two review assignments
    const dueAt = new Date(Date.now() + 24 * 3600 * 1000);
    const a1 = await prisma.reviewAssignment.create({
      data: {
        kind: 'assessment',
        assessmentId,
        reviewerId: reviewer1Id,
        state: 'open',
        dueAt,
      },
    });

    const a2 = await prisma.reviewAssignment.create({
      data: {
        kind: 'assessment',
        assessmentId,
        reviewerId: reviewer2Id,
        state: 'open',
        dueAt,
      },
    });

    // 10. Submit reviews to aggregate
    await http()
      .put(`/api/v1/reviews/assignments/${a1.id}`)
      .set('Cookie', r1Cookie)
      .send(payloadAllS)
      .expect(200);

    await http()
      .put(`/api/v1/reviews/assignments/${a2.id}`)
      .set('Cookie', r2Cookie)
      .send(payloadAllS)
      .expect(200);
  });

  afterAll(async () => {
    // Assessment results and transitions are append-only; disable users instead of deleting
    if (userIds.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: { status: 'disabled' },
      });
    }
    await prisma.$disconnect();
    await app.close();
  });

  it('Committee gets clips, latestResult.version 1 with grade, 2 reviewerRows with criteria', async () => {
    const res = await http()
      .get(`/api/v1/assessments/${assessmentId}`)
      .set('Cookie', committeeCookie)
      .expect(200);

    expect(res.body.success).toBe(true);
    const data = res.body.data;

    // Assessment fields
    expect(data.id).toBe(assessmentId);
    expect(data.subjectUserId).toBe(subjectId);
    expect(data.note).toBe('test assessment for detail');
    expect(data.reviewsSubmitted).toBe(2);
    expect(data.reviewsRequired).toBe(2);

    // Clips ordered by createdAt: clip1 then clip2
    expect(data.clips).toHaveLength(2);
    expect(data.clips[0].id).toBe(clip1Id);
    expect(data.clips[0].status).toBe('uploaded');
    expect(data.clips[0].viewUrl).toBe(`/e2e/sample1-${tag}.mp4`);
    expect(data.clips[0].durationSec).toBe(5);

    expect(data.clips[1].id).toBe(clip2Id);
    expect(data.clips[1].status).toBe('pending_upload');
    expect(data.clips[1].viewUrl).toBeNull();
    expect(data.clips[1].durationSec).toBe(10);

    // Latest Result
    expect(data.latestResult).not.toBeNull();
    expect(data.latestResult.version).toBe(1);
    expect(data.latestResult.nRaters).toBe(2);
    expect(data.latestResult.nExcluded).toBe(0);
    expect(data.latestResult.spread).toBe(0);
    expect(data.latestResult.grade).toMatchObject({
      score: 7.5,
      margin: 0.5,
      lower: 'S',
      upper: 'S',
      center: 'S',
      kind: 'exact',
      label: 'S',
    });

    // Reviewer Rows (Committee only)
    expect(data.reviewerRows).toHaveLength(2);
    const [row1, row2] = data.reviewerRows;

    expect(row1.reviewerId).toBe(reviewer1Id);
    expect(row1.reviewerName).toBe(`${tag} Reviewer One`);
    expect(row1.overall).toBe(7.5);
    expect(row1.excluded).toBe(false);
    expect(row1.robustZ).toBeNull();
    expect(row1.reviewerBias).toBeNull();
    expect(row1.pairKappa).toBeNull();
    expect(row1.criteria).toHaveLength(6);
    expect(row1.criteria[0]).toEqual({ criterion: 'footwork', gradeKey: 'S' });

    expect(row2.reviewerId).toBe(reviewer2Id);
    expect(row2.reviewerName).toBe(`${tag} Reviewer Two`);
    expect(row2.overall).toBe(7.5);
    expect(row2.excluded).toBe(false);
    expect(row2.criteria).toHaveLength(6);
  });

  it('subject Member gets 200 with reviewerRows []', async () => {
    const res = await http()
      .get(`/api/v1/assessments/${assessmentId}`)
      .set('Cookie', subjectCookie)
      .expect(200);

    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.id).toBe(assessmentId);
    expect(data.clips).toHaveLength(2);
    expect(data.latestResult).not.toBeNull();
    expect(data.latestResult.version).toBe(1);
    expect(data.reviewerRows).toEqual([]);
  });

  it('another Member gets 404 ASSESSMENT_NOT_FOUND (not 403, no leak of ids)', async () => {
    const res = await http()
      .get(`/api/v1/assessments/${assessmentId}`)
      .set('Cookie', otherMemberCookie)
      .expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ASSESSMENT_NOT_FOUND');
  });

  it('Reviewer role gets 403 FORBIDDEN', async () => {
    const res = await http()
      .get(`/api/v1/assessments/${assessmentId}`)
      .set('Cookie', reviewerCookie)
      .expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('unknown UUID gets 404 ASSESSMENT_NOT_FOUND', async () => {
    const unknownId = randomUUID();
    const res = await http()
      .get(`/api/v1/assessments/${unknownId}`)
      .set('Cookie', committeeCookie)
      .expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ASSESSMENT_NOT_FOUND');
  });

  it('invalid non-UUID param gets 400 VALIDATION_FAILED', async () => {
    await http().get('/api/v1/assessments/not-a-uuid').set('Cookie', committeeCookie).expect(400);
  });

  it('unauthenticated guest gets 401 UNAUTHENTICATED', async () => {
    const res = await http().get(`/api/v1/assessments/${assessmentId}`).expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});
