import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-agg-${randomUUID().slice(0, 8)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

describe('Aggregation on Submit (bl-10-3e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const userIds: string[] = [];
  const tournamentIds: string[] = [];
  const eventIds: string[] = [];
  const calSetIds: string[] = [];

  let reviewer1Id: string;
  let reviewer2Id: string;
  let r1Cookie: string;
  let r2Cookie: string;

  let rubricId: string;
  let eventId: string;
  let subjectId: string;

  const payloadAllS = {
    scores: [
      { criterion: 'footwork', gradeKey: 'S' },
      { criterion: 'overhead', gradeKey: 'S' },
      { criterion: 'net', gradeKey: 'S' },
      { criterion: 'defense', gradeKey: 'S' },
      { criterion: 'tactics', gradeKey: 'S' },
      { criterion: 'consistency', gradeKey: 'S' },
    ],
    comment: 'ฟอร์มการเล่นมาตรฐานระดับ S',
  };

  const payloadAbstained = {
    scores: [
      { criterion: 'footwork', gradeKey: null },
      { criterion: 'overhead', gradeKey: null },
      { criterion: 'net', gradeKey: null },
      { criterion: 'defense', gradeKey: null },
      { criterion: 'tactics', gradeKey: null },
      { criterion: 'consistency', gradeKey: null },
    ],
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();

    // 1. Subject user
    const subject = await prisma.user.create({
      data: {
        email: `${tag}-subject@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Subject`,
      },
    });
    userIds.push(subject.id);
    subjectId = subject.id;

    // 2. Reviewer 1
    const r1 = await prisma.user.create({
      data: { email: `${tag}-r1@test.local`, passwordHash: 'x', displayName: `${tag} Reviewer 1` },
    });
    userIds.push(r1.id);
    reviewer1Id = r1.id;
    r1Cookie = cookieFor(reviewer1Id, ['Reviewer']);

    // 3. Reviewer 2
    const r2 = await prisma.user.create({
      data: { email: `${tag}-r2@test.local`, passwordHash: 'x', displayName: `${tag} Reviewer 2` },
    });
    userIds.push(r2.id);
    reviewer2Id = r2.id;
    r2Cookie = cookieFor(reviewer2Id, ['Reviewer']);

    // 4. Active rubric
    const rubric = await prisma.rubric.findFirst({ where: { active: true } });
    if (!rubric) throw new Error('Active rubric not found in database');
    rubricId = rubric.id;

    // 5. Tournament and Event with minReviewers = 2
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
    eventId = event.id;
  });

  afterAll(async () => {
    // Assessment results and transitions are append-only; disable users instead of deleting
    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { status: 'disabled' },
    });
    await prisma.$disconnect();
    await app.close();
  });

  it('aggregates assessment result when the last open review is submitted', async () => {
    // Create an assessment bound to the event with 2 open assignments
    const assessment = await prisma.assessment.create({
      data: {
        subjectUserId: subjectId,
        eventId,
        rubricId,
        status: 'in_review',
      },
    });

    const dueAt = new Date(Date.now() + 24 * 3600 * 1000);
    const a1 = await prisma.reviewAssignment.create({
      data: {
        kind: 'assessment',
        assessmentId: assessment.id,
        reviewerId: reviewer1Id,
        state: 'open',
        dueAt,
      },
    });

    const a2 = await prisma.reviewAssignment.create({
      data: {
        kind: 'assessment',
        assessmentId: assessment.id,
        reviewerId: reviewer2Id,
        state: 'open',
        dueAt,
      },
    });

    // --- First reviewer submits ---
    const res1 = await http()
      .put(`/api/v1/reviews/assignments/${a1.id}`)
      .set('Cookie', r1Cookie)
      .send(payloadAllS)
      .expect(200);

    expect(res1.body.success).toBe(true);
    expect(res1.body.data).toMatchObject({
      id: a1.id,
      state: 'submitted',
    });
    // Response shape must only contain id, state, dueAt, submittedAt (no grade leak)
    expect(Object.keys(res1.body.data).sort()).toEqual(
      ['dueAt', 'id', 'state', 'submittedAt'].sort(),
    );

    // No AssessmentResult yet
    const resultsAfterR1 = await prisma.assessmentResult.findMany({
      where: { assessmentId: assessment.id },
    });
    expect(resultsAfterR1).toHaveLength(0);

    // Assessment status unchanged
    const assessAfterR1 = await prisma.assessment.findUnique({
      where: { id: assessment.id },
    });
    expect(assessAfterR1?.status).toBe('in_review');

    // No transition row with reason 'aggregate'
    const transAfterR1 = await prisma.assessmentTransition.findMany({
      where: { assessmentId: assessment.id, reason: 'aggregate' },
    });
    expect(transAfterR1).toHaveLength(0);

    // --- Second reviewer submits (LAST open review) ---
    const res2 = await http()
      .put(`/api/v1/reviews/assignments/${a2.id}`)
      .set('Cookie', r2Cookie)
      .send(payloadAllS)
      .expect(200);

    expect(res2.body.success).toBe(true);
    expect(res2.body.data).toMatchObject({
      id: a2.id,
      state: 'submitted',
    });
    // Response shape must only contain id, state, dueAt, submittedAt (no grade leak)
    expect(Object.keys(res2.body.data).sort()).toEqual(
      ['dueAt', 'id', 'state', 'submittedAt'].sort(),
    );

    // Exactly 1 AssessmentResult
    const resultsAfterR2 = await prisma.assessmentResult.findMany({
      where: { assessmentId: assessment.id },
    });
    expect(resultsAfterR2).toHaveLength(1);
    const result = resultsAfterR2[0]!;
    expect(result.version).toBe(1);
    expect(result.source).toBe('computed');
    expect(result.status).toBe('pending_approval');
    expect(Number(result.score)).toBe(7.5);
    expect(result.nRaters).toBe(2);
    expect(result.nExcluded).toBe(0);
    expect(result.methodVersion).toBe('grading-v2');
    expect(result.label).toBe('S');
    expect(result.kind).toBe('exact');
    expect(result.computedBy).toBeNull();

    // Verify inputs JSON structure
    const inputs = result.inputs as Record<string, unknown>;
    expect(inputs.minReviewers).toBe(2);
    expect(inputs.suggestThirdReviewer).toBe(false);
    expect(inputs.excludedIndexes).toEqual([]);
    expect(inputs.scores).toEqual([7.5, 7.5]);
    expect(inputs.reviewIds as string[]).toHaveLength(2);

    // Assessment.status equals the result status
    const assessAfterR2 = await prisma.assessment.findUnique({
      where: { id: assessment.id },
    });
    expect(assessAfterR2?.status).toBe(result.status);

    // Exactly 1 transition row with reason 'aggregate'
    const transAfterR2 = await prisma.assessmentTransition.findMany({
      where: { assessmentId: assessment.id, reason: 'aggregate' },
    });
    expect(transAfterR2).toHaveLength(1);
    expect(transAfterR2[0]!.fromStatus).toBe('in_review');
    expect(transAfterR2[0]!.toStatus).toBe(result.status);
    expect(transAfterR2[0]!.actorId).toBeNull();
    expect(transAfterR2[0]!.reason).toBe('aggregate');

    // Audit log recorded
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: assessment.id, action: 'assessment.result' },
    });
    expect(audit).toBeTruthy();
    expect(audit?.after).toEqual({
      version: 1,
      status: 'pending_approval',
      label: 'S',
    });
  });

  it('aggregates to needs_reviewers with null score when both reviewers abstain', async () => {
    // Create an assessment with 2 open assignments
    const assessment = await prisma.assessment.create({
      data: {
        subjectUserId: subjectId,
        eventId,
        rubricId,
        status: 'in_review',
      },
    });

    const dueAt = new Date(Date.now() + 24 * 3600 * 1000);
    const a1 = await prisma.reviewAssignment.create({
      data: {
        kind: 'assessment',
        assessmentId: assessment.id,
        reviewerId: reviewer1Id,
        state: 'open',
        dueAt,
      },
    });

    const a2 = await prisma.reviewAssignment.create({
      data: {
        kind: 'assessment',
        assessmentId: assessment.id,
        reviewerId: reviewer2Id,
        state: 'open',
        dueAt,
      },
    });

    // Reviewer 1 submits abstained
    await http()
      .put(`/api/v1/reviews/assignments/${a1.id}`)
      .set('Cookie', r1Cookie)
      .send(payloadAbstained)
      .expect(200);

    // Reviewer 2 submits abstained (last review)
    await http()
      .put(`/api/v1/reviews/assignments/${a2.id}`)
      .set('Cookie', r2Cookie)
      .send(payloadAbstained)
      .expect(200);

    // Exactly 1 AssessmentResult with status needs_reviewers and null score
    const results = await prisma.assessmentResult.findMany({
      where: { assessmentId: assessment.id },
    });
    expect(results).toHaveLength(1);
    const result = results[0]!;
    expect(result.version).toBe(1);
    expect(result.source).toBe('computed');
    expect(result.status).toBe('needs_reviewers');
    expect(result.score).toBeNull();
    expect(result.margin).toBeNull();
    expect(result.centerIndex).toBeNull();
    expect(result.lowerIndex).toBeNull();
    expect(result.upperIndex).toBeNull();
    expect(result.label).toBeNull();
    expect(result.kind).toBeNull();
    expect(result.nRaters).toBe(0);
    expect(result.methodVersion).toBe('grading-v2');

    // Assessment moved to needs_reviewers
    const assess = await prisma.assessment.findUnique({
      where: { id: assessment.id },
    });
    expect(assess?.status).toBe('needs_reviewers');

    // Transition row created
    const transitions = await prisma.assessmentTransition.findMany({
      where: { assessmentId: assessment.id, reason: 'aggregate' },
    });
    expect(transitions).toHaveLength(1);
    expect(transitions[0]!.fromStatus).toBe('in_review');
    expect(transitions[0]!.toStatus).toBe('needs_reviewers');
    expect(transitions[0]!.actorId).toBeNull();
  });

  it('never aggregates calibration assignments', async () => {
    // Create calibration set & clip
    const calSet = await prisma.calibrationSet.create({
      data: {
        name: `${tag} Cal Set 2`,
        createdBy: subjectId,
      },
    });
    calSetIds.push(calSet.id);

    const calClip = await prisma.calibrationClip.create({
      data: {
        setId: calSet.id,
        objectKey: `cal-${tag}-clip-2`,
        referenceIndex: 8,
        status: 'uploaded',
      },
    });

    const aCal = await prisma.reviewAssignment.create({
      data: {
        kind: 'calibration',
        calibrationClipId: calClip.id,
        reviewerId: reviewer1Id,
        state: 'open',
        dueAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });

    const res = await http()
      .put(`/api/v1/reviews/assignments/${aCal.id}`)
      .set('Cookie', r1Cookie)
      .send(payloadAllS)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.state).toBe('submitted');

    // No AssessmentResult was created anywhere for calibration
    const calResults = await prisma.assessmentResult.findMany({
      where: { assessmentId: aCal.id },
    });
    expect(calResults).toHaveLength(0);
  });

  it.each([1, 2, 3])(
    'round %i: concurrent submits for the last reviews serialize and aggregate exactly once',
    async (round) => {
      // Create fresh subject and assessment for this round
      const roundTag = `${tag}-conc-${round}-${randomUUID().slice(0, 6)}`;
      const sub = await prisma.user.create({
        data: {
          email: `${roundTag}-subject@test.local`,
          passwordHash: 'x',
          displayName: `${roundTag} Subject`,
        },
      });
      userIds.push(sub.id);

      const assess = await prisma.assessment.create({
        data: {
          subjectUserId: sub.id,
          eventId,
          rubricId,
          status: 'in_review',
        },
      });

      const dueAt = new Date(Date.now() + 24 * 3600 * 1000);
      const asg1 = await prisma.reviewAssignment.create({
        data: {
          kind: 'assessment',
          assessmentId: assess.id,
          reviewerId: reviewer1Id,
          state: 'open',
          dueAt,
        },
      });

      const asg2 = await prisma.reviewAssignment.create({
        data: {
          kind: 'assessment',
          assessmentId: assess.id,
          reviewerId: reviewer2Id,
          state: 'open',
          dueAt,
        },
      });

      // Submit both reviews concurrently with Promise.all
      const [res1, res2] = await Promise.all([
        http()
          .put(`/api/v1/reviews/assignments/${asg1.id}`)
          .set('Cookie', r1Cookie)
          .send(payloadAllS),
        http()
          .put(`/api/v1/reviews/assignments/${asg2.id}`)
          .set('Cookie', r2Cookie)
          .send(payloadAllS),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res1.body.data.state).toBe('submitted');
      expect(res2.body.data.state).toBe('submitted');

      // Exactly 1 AssessmentResult (version 1)
      const results = await prisma.assessmentResult.findMany({
        where: { assessmentId: assess.id },
      });
      expect(results).toHaveLength(1);
      expect(results[0]!.version).toBe(1);
      expect(results[0]!.source).toBe('computed');

      // Assessment is no longer 'in_review'
      const updatedAssess = await prisma.assessment.findUnique({
        where: { id: assess.id },
      });
      expect(updatedAssess?.status).not.toBe('in_review');
    },
  );
});
