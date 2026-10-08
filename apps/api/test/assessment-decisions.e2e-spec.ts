import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-dec-${randomUUID().slice(0, 8)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

describe('Assessment Decisions - approve and return (bl-26-3)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const userIds: string[] = [];
  const tournamentIds: string[] = [];
  const eventIds: string[] = [];

  let reviewer1Id: string;
  let reviewer2Id: string;
  let r1Cookie: string;
  let r2Cookie: string;

  let committeeId: string;
  let committeeCookie: string;

  let memberId: string;
  let memberCookie: string;

  let rubricId: string;
  let eventId: string;
  let subjectId: string;
  let subjectDisplayName: string;

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

  const payloadBG1 = {
    scores: [
      { criterion: 'footwork', gradeKey: 'BG1' },
      { criterion: 'overhead', gradeKey: 'BG1' },
      { criterion: 'net', gradeKey: 'BG1' },
      { criterion: 'defense', gradeKey: 'BG1' },
      { criterion: 'tactics', gradeKey: 'BG1' },
      { criterion: 'consistency', gradeKey: 'BG1' },
    ],
    comment: 'ฟอร์มระดับ BG1',
  };

  const payloadN = {
    scores: [
      { criterion: 'footwork', gradeKey: 'N' },
      { criterion: 'overhead', gradeKey: 'N' },
      { criterion: 'net', gradeKey: 'N' },
      { criterion: 'defense', gradeKey: 'N' },
      { criterion: 'tactics', gradeKey: 'N' },
      { criterion: 'consistency', gradeKey: 'N' },
    ],
    comment: 'ฟอร์มระดับ N',
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();

    // 1. Subject user
    subjectDisplayName = `${tag} Subject`;
    const subject = await prisma.user.create({
      data: {
        email: `${tag}-subject@test.local`,
        passwordHash: 'x',
        displayName: subjectDisplayName,
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

    // 4. Committee
    const comm = await prisma.user.create({
      data: { email: `${tag}-comm@test.local`, passwordHash: 'x', displayName: `${tag} Committee` },
    });
    userIds.push(comm.id);
    committeeId = comm.id;
    committeeCookie = cookieFor(committeeId, ['Committee']);

    // 5. Normal Member
    const mem = await prisma.user.create({
      data: { email: `${tag}-mem@test.local`, passwordHash: 'x', displayName: `${tag} Member` },
    });
    userIds.push(mem.id);
    memberId = mem.id;
    memberCookie = cookieFor(memberId, ['Member']);

    // 6. Active rubric
    let rubric = await prisma.rubric.findFirst({ where: { active: true } });
    if (!rubric) {
      rubric = await prisma.rubric.create({
        data: {
          active: true,
          methodVersion: 'grading-v2',
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
    rubricId = rubric.id;

    // 7. Tournament and Event with minReviewers = 2
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

  async function createPendingApprovalAssessment(subId = subjectId) {
    const assessment = await prisma.assessment.create({
      data: {
        subjectUserId: subId,
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

    return assessment;
  }

  async function createDisputedAssessment(subId = subjectId) {
    const assessment = await prisma.assessment.create({
      data: {
        subjectUserId: subId,
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

    await http()
      .put(`/api/v1/reviews/assignments/${a1.id}`)
      .set('Cookie', r1Cookie)
      .send(payloadBG1)
      .expect(200);

    await http()
      .put(`/api/v1/reviews/assignments/${a2.id}`)
      .set('Cookie', r2Cookie)
      .send(payloadN)
      .expect(200);

    return assessment;
  }

  describe('POST /assessments/:id/approve', () => {
    it('approves a pending_approval assessment -> 200, status approved, version 2, transition & audit recorded, officialResults returns it', async () => {
      const assess = await createPendingApprovalAssessment();

      // Check pre-condition: 1 computed result version 1
      const initialResults = await prisma.assessmentResult.findMany({
        where: { assessmentId: assess.id },
      });
      expect(initialResults).toHaveLength(1);
      expect(initialResults[0]!.version).toBe(1);
      expect(initialResults[0]!.status).toBe('pending_approval');

      const res = await http()
        .post(`/api/v1/assessments/${assess.id}/approve`)
        .set('Cookie', committeeCookie)
        .send({ note: 'อนุมัติเกรดตามผลการประเมิน' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(assess.id);
      expect(res.body.data.status).toBe('approved');
      expect(res.body.data.latestResult).toMatchObject({
        version: 2,
        status: 'approved',
        source: 'computed',
        reason: 'อนุมัติเกรดตามผลการประเมิน',
        computedBy: committeeId,
      });
      expect(res.body.data.latestResult.grade).toMatchObject({
        label: 'S',
      });
      expect(res.body.data.reviewerRows).toHaveLength(2);

      // Verify in DB
      const updatedAssess = await prisma.assessment.findUnique({
        where: { id: assess.id },
      });
      expect(updatedAssess?.status).toBe('approved');
      expect(updatedAssess?.version).toBeGreaterThan(0);

      // AssessmentResult has version 2 with status approved
      const allResults = await prisma.assessmentResult.findMany({
        where: { assessmentId: assess.id },
        orderBy: { version: 'asc' },
      });
      expect(allResults).toHaveLength(2);
      expect(allResults[1]!.version).toBe(2);
      expect(allResults[1]!.status).toBe('approved');
      expect(allResults[1]!.source).toBe('computed');
      expect(allResults[1]!.reason).toBe('อนุมัติเกรดตามผลการประเมิน');
      expect(allResults[1]!.computedBy).toBe(committeeId);

      // Transition recorded
      const transitions = await prisma.assessmentTransition.findMany({
        where: { assessmentId: assess.id, toStatus: 'approved' },
      });
      expect(transitions).toHaveLength(1);
      expect(transitions[0]!.fromStatus).toBe('pending_approval');
      expect(transitions[0]!.toStatus).toBe('approved');
      expect(transitions[0]!.actorId).toBe(committeeId);
      expect(transitions[0]!.reason).toBe('อนุมัติเกรดตามผลการประเมิน');

      // Audit recorded
      const audit = await prisma.auditLog.findFirst({
        where: { entityId: assess.id, action: 'assessment.approve' },
      });
      expect(audit).toBeTruthy();
      expect(audit?.actorId).toBe(committeeId);
      expect(audit?.before).toMatchObject({
        status: 'pending_approval',
        resultVersion: 1,
      });
      expect(audit?.after).toMatchObject({
        status: 'approved',
        resultVersion: 2,
      });
      expect(audit?.reason).toBe('อนุมัติเกรดตามผลการประเมิน');

      // Verify officialResults: GET /users gradeLabel for subject is set
      const usersRes = await http()
        .get(`/api/v1/users?q=${encodeURIComponent(subjectDisplayName)}`)
        .set('Cookie', committeeCookie)
        .expect(200);

      expect(usersRes.body.success).toBe(true);
      const subjectItem = usersRes.body.data.items.find((u: any) => u.id === subjectId);
      expect(subjectItem).toBeTruthy();
      expect(subjectItem.gradeLabel).toBe('S');
    });

    it('rejects approval with a stale resultVersion -> 409 RESULT_VERSION_STALE', async () => {
      const assess = await createPendingApprovalAssessment();

      const res = await http()
        .post(`/api/v1/assessments/${assess.id}/approve`)
        .set('Cookie', committeeCookie)
        .send({ resultVersion: 999 })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('RESULT_VERSION_STALE');
      expect(res.body.error.details).toMatchObject({ latest: 1 });
    });

    it('rejects approving twice -> second call gets 409 ASSESSMENT_INVALID_TRANSITION', async () => {
      const assess = await createPendingApprovalAssessment();

      // First approve succeeds
      await http()
        .post(`/api/v1/assessments/${assess.id}/approve`)
        .set('Cookie', committeeCookie)
        .send({})
        .expect(200);

      // Second approve fails
      const res = await http()
        .post(`/api/v1/assessments/${assess.id}/approve`)
        .set('Cookie', committeeCookie)
        .send({})
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ASSESSMENT_INVALID_TRANSITION');
      expect(res.body.error.details).toMatchObject({ from: 'approved' });
    });

    it('disputed case (gap > 2.0): approve without note -> 422, with note -> 200', async () => {
      const assess = await createDisputedAssessment();

      // Verify assessment is in disputed status
      const disputedAssess = await prisma.assessment.findUnique({
        where: { id: assess.id },
      });
      expect(disputedAssess?.status).toBe('disputed');

      // 1. Approve without note -> 422 ASSESSMENT_APPROVE_NOTE_REQUIRED
      const resWithoutNote = await http()
        .post(`/api/v1/assessments/${assess.id}/approve`)
        .set('Cookie', committeeCookie)
        .send({})
        .expect(422);

      expect(resWithoutNote.body.success).toBe(false);
      expect(resWithoutNote.body.error.code).toBe('ASSESSMENT_APPROVE_NOTE_REQUIRED');

      // 2. Approve with short note (< 5 chars) -> 422 ASSESSMENT_APPROVE_NOTE_REQUIRED
      const resWithShortNote = await http()
        .post(`/api/v1/assessments/${assess.id}/approve`)
        .set('Cookie', committeeCookie)
        .send({ note: 'ok' })
        .expect(422);

      expect(resWithShortNote.body.success).toBe(false);
      expect(resWithShortNote.body.error.code).toBe('ASSESSMENT_APPROVE_NOTE_REQUIRED');

      // 3. Approve with valid note (>= 5 chars) -> 200
      const resWithValidNote = await http()
        .post(`/api/v1/assessments/${assess.id}/approve`)
        .set('Cookie', committeeCookie)
        .send({ note: 'คณะกรรมการพิจารณาภาพรวมแล้วเห็นพ้องกับคะแนน' })
        .expect(200);

      expect(resWithValidNote.body.success).toBe(true);
      expect(resWithValidNote.body.data.status).toBe('approved');
      expect(resWithValidNote.body.data.latestResult.version).toBe(2);
      expect(resWithValidNote.body.data.latestResult.status).toBe('approved');
      expect(resWithValidNote.body.data.latestResult.reason).toBe(
        'คณะกรรมการพิจารณาภาพรวมแล้วเห็นพ้องกับคะแนน',
      );
    });
  });

  describe('POST /assessments/:id/return', () => {
    it('returns an assessment with reason < 5 chars -> 422 REASON_REQUIRED', async () => {
      const assess = await createPendingApprovalAssessment();

      const res = await http()
        .post(`/api/v1/assessments/${assess.id}/return`)
        .set('Cookie', committeeCookie)
        .send({ reason: 'abc' })
        .expect(422);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('REASON_REQUIRED');
    });

    it('returns an assessment -> 200, status in_review, no new result row created', async () => {
      const assess = await createPendingApprovalAssessment();

      const resultsBefore = await prisma.assessmentResult.findMany({
        where: { assessmentId: assess.id },
      });
      expect(resultsBefore).toHaveLength(1);

      const res = await http()
        .post(`/api/v1/assessments/${assess.id}/return`)
        .set('Cookie', committeeCookie)
        .send({ reason: 'ต้องการให้กรรมการผู้เชี่ยวชาญประเภทคู่ประเมินเพิ่มเติม' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(assess.id);
      expect(res.body.data.status).toBe('in_review');

      // Verify in DB
      const updatedAssess = await prisma.assessment.findUnique({
        where: { id: assess.id },
      });
      expect(updatedAssess?.status).toBe('in_review');

      // No new AssessmentResult row (computed row stays as history)
      const resultsAfter = await prisma.assessmentResult.findMany({
        where: { assessmentId: assess.id },
      });
      expect(resultsAfter).toHaveLength(1);
      expect(resultsAfter[0]!.version).toBe(1);

      // Transition recorded
      const transitions = await prisma.assessmentTransition.findMany({
        where: { assessmentId: assess.id, toStatus: 'in_review' },
      });
      expect(transitions).toHaveLength(1);
      expect(transitions[0]!.fromStatus).toBe('pending_approval');
      expect(transitions[0]!.toStatus).toBe('in_review');
      expect(transitions[0]!.actorId).toBe(committeeId);
      expect(transitions[0]!.reason).toBe('ต้องการให้กรรมการผู้เชี่ยวชาญประเภทคู่ประเมินเพิ่มเติม');

      // Audit recorded
      const audit = await prisma.auditLog.findFirst({
        where: { entityId: assess.id, action: 'assessment.return' },
      });
      expect(audit).toBeTruthy();
      expect(audit?.actorId).toBe(committeeId);
      expect(audit?.before).toMatchObject({
        status: 'pending_approval',
        resultVersion: 1,
      });
      expect(audit?.after).toMatchObject({
        status: 'in_review',
        resultVersion: 1,
      });
      expect(audit?.reason).toBe('ต้องการให้กรรมการผู้เชี่ยวชาญประเภทคู่ประเมินเพิ่มเติม');
    });
  });

  describe('RBAC & Error handling', () => {
    it('Member role gets 403 FORBIDDEN on approve and return', async () => {
      const assess = await createPendingApprovalAssessment();

      const approveRes = await http()
        .post(`/api/v1/assessments/${assess.id}/approve`)
        .set('Cookie', memberCookie)
        .send({})
        .expect(403);
      expect(approveRes.body.error.code).toBe('FORBIDDEN');

      const returnRes = await http()
        .post(`/api/v1/assessments/${assess.id}/return`)
        .set('Cookie', memberCookie)
        .send({ reason: 'Member cannot return' })
        .expect(403);
      expect(returnRes.body.error.code).toBe('FORBIDDEN');
    });

    it('Reviewer role gets 403 FORBIDDEN on approve and return', async () => {
      const assess = await createPendingApprovalAssessment();

      const approveRes = await http()
        .post(`/api/v1/assessments/${assess.id}/approve`)
        .set('Cookie', r1Cookie)
        .send({})
        .expect(403);
      expect(approveRes.body.error.code).toBe('FORBIDDEN');

      const returnRes = await http()
        .post(`/api/v1/assessments/${assess.id}/return`)
        .set('Cookie', r1Cookie)
        .send({ reason: 'Reviewer cannot return' })
        .expect(403);
      expect(returnRes.body.error.code).toBe('FORBIDDEN');
    });

    it('unknown UUID gets 404 ASSESSMENT_NOT_FOUND', async () => {
      const unknownId = randomUUID();

      const approveRes = await http()
        .post(`/api/v1/assessments/${unknownId}/approve`)
        .set('Cookie', committeeCookie)
        .send({})
        .expect(404);
      expect(approveRes.body.error.code).toBe('ASSESSMENT_NOT_FOUND');

      const returnRes = await http()
        .post(`/api/v1/assessments/${unknownId}/return`)
        .set('Cookie', committeeCookie)
        .send({ reason: 'Assessment does not exist' })
        .expect(404);
      expect(returnRes.body.error.code).toBe('ASSESSMENT_NOT_FOUND');
    });

    it('unauthenticated guest gets 401 UNAUTHENTICATED', async () => {
      const assess = await createPendingApprovalAssessment();

      const approveRes = await http()
        .post(`/api/v1/assessments/${assess.id}/approve`)
        .send({})
        .expect(401);
      expect(approveRes.body.error.code).toBe('UNAUTHENTICATED');

      const returnRes = await http()
        .post(`/api/v1/assessments/${assess.id}/return`)
        .send({ reason: 'Unauthenticated request' })
        .expect(401);
      expect(returnRes.body.error.code).toBe('UNAUTHENTICATED');
    });
  });
});
