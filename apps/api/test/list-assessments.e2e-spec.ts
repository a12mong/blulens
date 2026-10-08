import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-list-ass-${randomUUID().slice(0, 8)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

describe('GET /api/v1/assessments (bl-26-1 list assessments)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const userIds: string[] = [];
  const assessmentIds: string[] = [];
  const assignmentIds: string[] = [];

  let memberAId: string;
  let memberBId: string;
  let committeeId: string;
  let reviewerId: string;

  let memberACookie: string;
  let memberBCookie: string;
  let committeeCookie: string;
  let reviewerCookie: string;

  let a1Id: string; // member A, draft
  let a2Id: string; // member A, in_review (with 1 submitted review)
  let b1Id: string; // member B, in_review
  let b2Id: string; // member B, submitted

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();

    // Create Member A
    const memberA = await prisma.user.create({
      data: {
        email: `${tag}-memberA@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Member A`,
      },
    });
    userIds.push(memberA.id);
    memberAId = memberA.id;
    memberACookie = cookieFor(memberAId, ['Member']);

    // Create Member B
    const memberB = await prisma.user.create({
      data: {
        email: `${tag}-memberB@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Member B`,
      },
    });
    userIds.push(memberB.id);
    memberBId = memberB.id;
    memberBCookie = cookieFor(memberBId, ['Member']);

    // Create Committee
    const committee = await prisma.user.create({
      data: {
        email: `${tag}-committee@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Committee`,
      },
    });
    userIds.push(committee.id);
    committeeId = committee.id;
    committeeCookie = cookieFor(committeeId, ['Committee']);

    // Create Reviewer
    const reviewer = await prisma.user.create({
      data: {
        email: `${tag}-reviewer@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Reviewer`,
      },
    });
    userIds.push(reviewer.id);
    reviewerId = reviewer.id;
    reviewerCookie = cookieFor(reviewerId, ['Reviewer']);

    // Create Assessment A1 (Member A, draft)
    const a1 = await prisma.assessment.create({
      data: {
        subjectUserId: memberAId,
        status: 'draft',
        note: `${tag} A1 draft`,
        createdAt: new Date(Date.now() - 4000),
      },
    });
    assessmentIds.push(a1.id);
    a1Id = a1.id;

    // Create Assessment A2 (Member A, in_review)
    const a2 = await prisma.assessment.create({
      data: {
        subjectUserId: memberAId,
        status: 'in_review',
        note: `${tag} A2 in_review`,
        createdAt: new Date(Date.now() - 3000),
      },
    });
    assessmentIds.push(a2.id);
    a2Id = a2.id;

    // Create ReviewAssignment for A2 (submitted)
    const assignmentA2 = await prisma.reviewAssignment.create({
      data: {
        kind: 'assessment',
        assessmentId: a2Id,
        reviewerId,
        state: 'submitted',
        dueAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });
    assignmentIds.push(assignmentA2.id);

    // Create Assessment B1 (Member B, in_review)
    const b1 = await prisma.assessment.create({
      data: {
        subjectUserId: memberBId,
        status: 'in_review',
        note: `${tag} B1 in_review`,
        createdAt: new Date(Date.now() - 2000),
      },
    });
    assessmentIds.push(b1.id);
    b1Id = b1.id;

    // Create Assessment B2 (Member B, submitted)
    const b2 = await prisma.assessment.create({
      data: {
        subjectUserId: memberBId,
        status: 'submitted',
        note: `${tag} B2 submitted`,
        createdAt: new Date(Date.now() - 1000),
      },
    });
    assessmentIds.push(b2.id);
    b2Id = b2.id;
  });

  afterAll(async () => {
    if (assignmentIds.length > 0) {
      await prisma.reviewAssignment.deleteMany({ where: { id: { in: assignmentIds } } });
    }
    if (assessmentIds.length > 0) {
      await prisma.assessment.deleteMany({ where: { id: { in: assessmentIds } } });
    }
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
    await app.close();
  });

  it('Committee sees assessments of 2 members with reviewsSubmitted batched', async () => {
    const res = await http().get('/api/v1/assessments').set('Cookie', committeeCookie).expect(200);

    expect(res.body.success).toBe(true);
    const items = res.body.data.items as Array<any>;
    const ids = items.map((i) => i.id);
    expect(ids).toContain(a1Id);
    expect(ids).toContain(a2Id);
    expect(ids).toContain(b1Id);
    expect(ids).toContain(b2Id);

    // Check reviewsSubmitted count
    const itemA2 = items.find((i: any) => i.id === a2Id);
    expect(itemA2.reviewsSubmitted).toBe(1);
    const itemA1 = items.find((i: any) => i.id === a1Id);
    expect(itemA1.reviewsSubmitted).toBe(0);
  });

  it('?status=in_review filters correctly', async () => {
    const res = await http()
      .get('/api/v1/assessments?status=in_review')
      .set('Cookie', committeeCookie)
      .expect(200);

    const items = res.body.data.items as Array<any>;
    const ids = items.map((i) => i.id);
    expect(ids).toContain(a2Id);
    expect(ids).toContain(b1Id);
    expect(ids).not.toContain(a1Id);
    expect(ids).not.toContain(b2Id);
    for (const item of items) {
      expect(item.status).toBe('in_review');
    }
  });

  it('limit=1 gives nextCursor and page 2 differs', async () => {
    const page1 = await http()
      .get('/api/v1/assessments?limit=1')
      .set('Cookie', committeeCookie)
      .expect(200);

    expect(page1.body.data.items).toHaveLength(1);
    const nextCursor = page1.body.data.nextCursor;
    expect(typeof nextCursor).toBe('string');
    expect(nextCursor).toBe(page1.body.data.items[0].id);

    const page2 = await http()
      .get(`/api/v1/assessments?limit=1&cursor=${nextCursor}`)
      .set('Cookie', committeeCookie)
      .expect(200);

    expect(page2.body.data.items).toHaveLength(1);
    expect(page2.body.data.items[0].id).not.toBe(page1.body.data.items[0].id);
  });

  it('a Member sees only own assessments (even with ?subjectUserId=<other>)', async () => {
    // Member A regular list
    const resA = await http().get('/api/v1/assessments').set('Cookie', memberACookie).expect(200);

    const itemsA = resA.body.data.items as Array<any>;
    expect(itemsA.length).toBeGreaterThanOrEqual(2);
    for (const item of itemsA) {
      expect(item.subjectUserId).toBe(memberAId);
    }
    const idsA = itemsA.map((i) => i.id);
    expect(idsA).toContain(a1Id);
    expect(idsA).toContain(a2Id);
    expect(idsA).not.toContain(b1Id);
    expect(idsA).not.toContain(b2Id);

    // Member A attempts to query ?subjectUserId=memberBId
    const resHacked = await http()
      .get(`/api/v1/assessments?subjectUserId=${memberBId}`)
      .set('Cookie', memberACookie)
      .expect(200);

    const itemsHacked = resHacked.body.data.items as Array<any>;
    for (const item of itemsHacked) {
      expect(item.subjectUserId).toBe(memberAId);
    }
    const idsHacked = itemsHacked.map((i) => i.id);
    expect(idsHacked).toContain(a1Id);
    expect(idsHacked).toContain(a2Id);
    expect(idsHacked).not.toContain(b1Id);
    expect(idsHacked).not.toContain(b2Id);
  });

  it('Committee can filter by ?subjectUserId=<memberId>', async () => {
    const res = await http()
      .get(`/api/v1/assessments?subjectUserId=${memberBId}`)
      .set('Cookie', committeeCookie)
      .expect(200);

    const items = res.body.data.items as Array<any>;
    expect(items.length).toBeGreaterThanOrEqual(2);
    for (const item of items) {
      expect(item.subjectUserId).toBe(memberBId);
    }
  });

  it('Guest -> 401 UNAUTHENTICATED', async () => {
    const res = await http().get('/api/v1/assessments').expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('Reviewer role -> 403 FORBIDDEN', async () => {
    const res = await http().get('/api/v1/assessments').set('Cookie', reviewerCookie).expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('?limit=0 -> 400 VALIDATION_FAILED', async () => {
    const res = await http()
      .get('/api/v1/assessments?limit=0')
      .set('Cookie', committeeCookie)
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('?sort=invalid -> 400 VALIDATION_FAILED', async () => {
    const res = await http()
      .get('/api/v1/assessments?sort=invalid')
      .set('Cookie', committeeCookie)
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});
