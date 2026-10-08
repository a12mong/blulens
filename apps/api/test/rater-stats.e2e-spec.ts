import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-rst-${randomUUID().slice(0, 6)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

describe('rater-stats (bl-26-5 API)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const userIds: string[] = [];
  let committeeId: string;
  let rev1Id: string;
  let rev2Id: string;
  let rev3Id: string;
  let memberId: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();

    // 1. Create test users
    const committee = await prisma.user.create({
      data: {
        email: `${tag}-comm@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Committee`,
      },
    });
    committeeId = committee.id;
    userIds.push(committeeId);

    const rev1 = await prisma.user.create({
      data: {
        email: `${tag}-rev1@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Reviewer 1`,
      },
    });
    rev1Id = rev1.id;
    userIds.push(rev1Id);

    const rev2 = await prisma.user.create({
      data: {
        email: `${tag}-rev2@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Reviewer 2`,
      },
    });
    rev2Id = rev2.id;
    userIds.push(rev2Id);

    const rev3 = await prisma.user.create({
      data: {
        email: `${tag}-rev3@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Reviewer 3`,
      },
    });
    rev3Id = rev3.id;
    userIds.push(rev3Id);

    const member = await prisma.user.create({
      data: {
        email: `${tag}-member@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Member`,
      },
    });
    memberId = member.id;
    userIds.push(memberId);

    const subject = await prisma.user.create({
      data: {
        email: `${tag}-subject@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Subject Player`,
      },
    });
    userIds.push(subject.id);

    // 2. Seed 16 cases cheaply through Prisma (15 recent within 30d, 1 older at 45d ago)
    const now = new Date();
    const olderDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);

    for (let i = 0; i < 16; i++) {
      const isOlder = i === 15;
      const caseSubmittedAt = isOlder ? olderDate : now;
      const isHighTier = i >= 8;

      const assessment = await prisma.assessment.create({
        data: {
          subjectUserId: subject.id,
          status: 'pending_approval',
          reviewsRequired: 3,
          submittedAt: caseSubmittedAt,
          version: 1,
        },
      });

      // 3 review assignments (rev1, rev2, rev3)
      const a1 = await prisma.reviewAssignment.create({
        data: {
          assessmentId: assessment.id,
          reviewerId: rev1Id,
          kind: 'assessment',
          state: 'submitted',
          dueAt: new Date(caseSubmittedAt.getTime() + 72 * 3600 * 1000),
        },
      });
      const a2 = await prisma.reviewAssignment.create({
        data: {
          assessmentId: assessment.id,
          reviewerId: rev2Id,
          kind: 'assessment',
          state: 'submitted',
          dueAt: new Date(caseSubmittedAt.getTime() + 72 * 3600 * 1000),
        },
      });
      const a3 = await prisma.reviewAssignment.create({
        data: {
          assessmentId: assessment.id,
          reviewerId: rev3Id,
          kind: 'assessment',
          state: 'submitted',
          dueAt: new Date(caseSubmittedAt.getTime() + 72 * 3600 * 1000),
        },
      });

      // 3 reviews (varied between ladder 7.5 and 10.5 so kappa is defined)
      const r1 = await prisma.review.create({
        data: {
          assignmentId: a1.id,
          overall: isHighTier ? 10.2 : 7.2,
          abstained: false,
          submittedAt: caseSubmittedAt,
        },
      });
      const r2 = await prisma.review.create({
        data: {
          assignmentId: a2.id,
          overall: isHighTier ? 10.5 : 7.5,
          abstained: false,
          submittedAt: caseSubmittedAt,
        },
      });
      const r3 = await prisma.review.create({
        data: {
          assignmentId: a3.id,
          overall: isHighTier ? 10.8 : 7.8,
          abstained: false,
          submittedAt: caseSubmittedAt,
        },
      });

      // 1 assessment result row with inputs
      await prisma.assessmentResult.create({
        data: {
          assessmentId: assessment.id,
          version: 1,
          source: 'computed',
          status: 'pending_approval',
          score: isHighTier ? 10.5 : 7.5,
          margin: 0.35,
          lowerIndex: isHighTier ? 10 : 7,
          centerIndex: isHighTier ? 10 : 7,
          upperIndex: isHighTier ? 10 : 7,
          kind: 'exact',
          label: isHighTier ? 'S+' : 'S',
          nRaters: 3,
          nExcluded: 0,
          methodVersion: 'grading-v1',
          inputs: {
            reviewIds: [r1.id, r2.id, r3.id],
            scores: [isHighTier ? 10.2 : 7.2, isHighTier ? 10.5 : 7.5, isHighTier ? 10.8 : 7.8],
            excludedIndexes: [],
          },
        },
      });
    }
  });

  afterAll(async () => {
    // Disable test users to avoid touching append-only tables with database triggers
    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { status: 'disabled' },
    });
    await prisma.$disconnect();
    await app.close();
  });

  it('Committee sees 3 raters + 3 pairs + panel with default window (90d)', async () => {
    const cookie = cookieFor(committeeId, ['Committee']);
    const res = await http().get('/api/v1/rater-stats').set('Cookie', cookie).expect(200);

    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.window).toBe('90d');
    expect(data.methodVersion).toBe('grading-v2');

    // Panel
    expect(data.panel).toBeDefined();
    expect(data.panel.fleissKappaTier).toBeDefined();
    expect(data.panel.fleissKappaTier.n).toBeGreaterThanOrEqual(16);

    // Committee sees our 3 test raters
    const testRaters = data.raters.filter((r: { reviewerId: string }) =>
      [rev1Id, rev2Id, rev3Id].includes(r.reviewerId),
    );
    expect(testRaters).toHaveLength(3);

    // Each test rater has 16 reviews in 90d window
    for (const rater of testRaters) {
      expect(rater.reviews).toBe(16);
      expect(rater.bias).not.toBeNull();
      expect(rater.outlierRate).toBe(0);
      expect(rater.flagged).toBe(false);
      expect(rater.kappaVsConsensus.band).not.toBe('insufficient');
    }

    // Committee sees all 3 pairs for our test reviewers (a < b)
    const testPairs = data.pairs.filter(
      (p: { a: string; b: string }) =>
        [rev1Id, rev2Id, rev3Id].includes(p.a) && [rev1Id, rev2Id, rev3Id].includes(p.b),
    );
    expect(testPairs).toHaveLength(3);
    for (const pair of testPairs) {
      expect(pair.a < pair.b).toBe(true);
      expect(pair.cohenKappaQuadratic.n).toBe(16);
      expect(pair.cohenKappaQuadratic.band).not.toBe('insufficient');
    }
  });

  it('Reviewer caller sees only their own row in raters and pairs is empty', async () => {
    const cookie = cookieFor(rev1Id, ['Reviewer']);
    const res = await http().get('/api/v1/rater-stats').set('Cookie', cookie).expect(200);

    expect(res.body.success).toBe(true);
    const data = res.body.data;

    // Panel is kept
    expect(data.panel).toBeDefined();
    expect(data.panel.fleissKappaTier).toBeDefined();

    // Raters contains only rev1
    expect(data.raters).toHaveLength(1);
    expect(data.raters[0].reviewerId).toBe(rev1Id);

    // Pairs is empty array
    expect(data.pairs).toEqual([]);
  });

  it('Member role returns 403 Forbidden', async () => {
    const cookie = cookieFor(memberId, ['Member']);
    const res = await http().get('/api/v1/rater-stats').set('Cookie', cookie).expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('window=30d excludes the older review (45d ago)', async () => {
    const cookie = cookieFor(committeeId, ['Committee']);
    const res = await http()
      .get('/api/v1/rater-stats?window=30d')
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.window).toBe('30d');

    // Panel has at least 15 cases (the 45-day-old case is excluded from our 16)
    expect(data.panel.fleissKappaTier.n).toBeGreaterThanOrEqual(15);

    // Each test rater has 15 reviews instead of 16
    const testRaters30 = data.raters.filter((r: { reviewerId: string }) =>
      [rev1Id, rev2Id, rev3Id].includes(r.reviewerId),
    );
    expect(testRaters30).toHaveLength(3);
    for (const rater of testRaters30) {
      expect(rater.reviews).toBe(15);
    }

    // Each test pair shares 15 cases instead of 16
    const testPairs30 = data.pairs.filter(
      (p: { a: string; b: string }) =>
        [rev1Id, rev2Id, rev3Id].includes(p.a) && [rev1Id, rev2Id, rev3Id].includes(p.b),
    );
    expect(testPairs30).toHaveLength(3);
    for (const pair of testPairs30) {
      expect(pair.cohenKappaQuadratic.n).toBe(15);
    }
  });

  it('Unauthenticated guest returns 401', async () => {
    const res = await http().get('/api/v1/rater-stats').expect(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('Invalid window parameter returns 400', async () => {
    const cookie = cookieFor(committeeId, ['Committee']);
    const res = await http()
      .get('/api/v1/rater-stats?window=bad')
      .set('Cookie', cookie)
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});
