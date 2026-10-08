import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-ovr-${randomUUID().slice(0, 8)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

describe('Assessment Confirm and Override (bl-26-4)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const userIds: string[] = [];
  const tournamentIds: string[] = [];
  const eventIds: string[] = [];
  const teamIds: string[] = [];

  let reviewer1Id: string;
  let reviewer2Id: string;
  let r1Cookie: string;
  let r2Cookie: string;

  let committeeId: string;
  let committeeCookie: string;

  let conflictCommitteeId: string;
  let conflictCommitteeCookie: string;

  let memberId: string;
  let memberCookie: string;

  let rubricId: string;
  let eventMin1Id: string;
  let eventMin2Id: string;
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
    comment: 'ฟอร์มระดับ S',
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

    // 2. Reviewer 1 & 2
    const r1 = await prisma.user.create({
      data: { email: `${tag}-r1@test.local`, passwordHash: 'x', displayName: `${tag} Reviewer 1` },
    });
    userIds.push(r1.id);
    reviewer1Id = r1.id;
    r1Cookie = cookieFor(reviewer1Id, ['Reviewer']);

    const r2 = await prisma.user.create({
      data: { email: `${tag}-r2@test.local`, passwordHash: 'x', displayName: `${tag} Reviewer 2` },
    });
    userIds.push(r2.id);
    reviewer2Id = r2.id;
    r2Cookie = cookieFor(reviewer2Id, ['Reviewer']);

    // 3. Clean Committee
    const comm = await prisma.user.create({
      data: { email: `${tag}-comm@test.local`, passwordHash: 'x', displayName: `${tag} Committee` },
    });
    userIds.push(comm.id);
    committeeId = comm.id;
    committeeCookie = cookieFor(committeeId, ['Committee']);

    // 4. Conflict Committee (shares a current team with subject)
    const confComm = await prisma.user.create({
      data: {
        email: `${tag}-conf-comm@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Conflict Committee`,
      },
    });
    userIds.push(confComm.id);
    conflictCommitteeId = confComm.id;
    conflictCommitteeCookie = cookieFor(conflictCommitteeId, ['Committee']);

    // 5. Member
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

    // 7. Tournament & Events
    const tournament = await prisma.tournament.create({
      data: {
        name: `${tag} Tournament`,
        startsOn: new Date('2026-12-01'),
        entriesCloseAt: new Date('2026-11-25T17:00:00Z'),
        status: 'open',
      },
    });
    tournamentIds.push(tournament.id);

    const evMin1 = await prisma.event.create({
      data: {
        tournamentId: tournament.id,
        discipline: 'MS',
        gradeMinIndex: 6,
        gradeMaxIndex: 11,
        minReviewers: 1,
      },
    });
    eventIds.push(evMin1.id);
    eventMin1Id = evMin1.id;

    const evMin2 = await prisma.event.create({
      data: {
        tournamentId: tournament.id,
        discipline: 'MD',
        gradeMinIndex: 6,
        gradeMaxIndex: 11,
        minReviewers: 2,
      },
    });
    eventIds.push(evMin2.id);
    eventMin2Id = evMin2.id;

    // 8. Shared team for conflict of interest test
    const team = await prisma.team.create({
      data: {
        name: `${tag} Shared Team`,
        nameKey: `${tag}-shared-team`,
      },
    });
    teamIds.push(team.id);

    const now = new Date();
    await prisma.teamMembership.createMany({
      data: [
        { teamId: team.id, userId: subjectId, validFrom: now },
        { teamId: team.id, userId: conflictCommitteeId, validFrom: now },
      ],
    });
  });

  afterAll(async () => {
    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { status: 'disabled' },
    });
    await prisma.$disconnect();
    await app.close();
  });

  async function createProvisionalAssessment(subId = subjectId) {
    const assessment = await prisma.assessment.create({
      data: {
        subjectUserId: subId,
        eventId: eventMin1Id,
        rubricId,
        reviewsRequired: 1,
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

    await http()
      .put(`/api/v1/reviews/assignments/${a1.id}`)
      .set('Cookie', r1Cookie)
      .send(payloadAllS)
      .expect(200);

    return assessment;
  }

  async function createPendingApprovalAssessment(subId = subjectId) {
    const assessment = await prisma.assessment.create({
      data: {
        subjectUserId: subId,
        eventId: eventMin2Id,
        rubricId,
        reviewsRequired: 2,
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

  describe('POST /assessments/:id/confirm', () => {
    it('confirms a provisional (1 review) result -> 200, status approved, new result keeps SINGLE_REVIEWER flag', async () => {
      const assess = await createProvisionalAssessment();

      // Check pre-condition: provisional status with SINGLE_REVIEWER flag
      const assessBefore = await prisma.assessment.findUnique({
        where: { id: assess.id },
      });
      expect(assessBefore?.status).toBe('provisional');

      const resultsBefore = await prisma.assessmentResult.findMany({
        where: { assessmentId: assess.id },
      });
      expect(resultsBefore).toHaveLength(1);
      expect(resultsBefore[0]!.status).toBe('provisional');
      expect(resultsBefore[0]!.flags).toContain('SINGLE_REVIEWER');

      const res = await http()
        .post(`/api/v1/assessments/${assess.id}/confirm`)
        .set('Cookie', committeeCookie)
        .send({ note: 'ยืนยันผลประเมินกรรมการเดี่ยว' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(assess.id);
      expect(res.body.data.status).toBe('approved');
      expect(res.body.data.latestResult).toMatchObject({
        version: 2,
        status: 'approved',
        source: 'computed',
        flags: expect.arrayContaining(['SINGLE_REVIEWER']),
        reason: 'ยืนยันผลประเมินกรรมการเดี่ยว',
        computedBy: committeeId,
      });

      // Verify in DB
      const updatedAssess = await prisma.assessment.findUnique({
        where: { id: assess.id },
      });
      expect(updatedAssess?.status).toBe('approved');

      // Audit recorded
      const audit = await prisma.auditLog.findFirst({
        where: { entityId: assess.id, action: 'assessment.confirm' },
      });
      expect(audit).toBeTruthy();
      expect(audit?.actorId).toBe(committeeId);
      expect(audit?.after).toMatchObject({
        status: 'approved',
        resultVersion: 2,
      });
    });

    it('rejects confirm on pending_approval -> 409 ASSESSMENT_NOT_PROVISIONAL', async () => {
      const assess = await createPendingApprovalAssessment();

      const res = await http()
        .post(`/api/v1/assessments/${assess.id}/confirm`)
        .set('Cookie', committeeCookie)
        .send({})
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ASSESSMENT_NOT_PROVISIONAL');
    });
  });

  describe('POST /assessments/:id/override', () => {
    it('overrides an approved result with centerKey N and 20+ char reason -> 200, status overridden, exact kind, OVERRIDE flag, older versions kept, officialResults returns override', async () => {
      const assess = await createProvisionalAssessment();

      // First confirm it to approved
      await http()
        .post(`/api/v1/assessments/${assess.id}/confirm`)
        .set('Cookie', committeeCookie)
        .send({ note: 'ยืนยันเพื่อเตรียม override' })
        .expect(200);

      const assessBefore = await prisma.assessment.findUnique({
        where: { id: assess.id },
      });
      expect(assessBefore?.status).toBe('approved');

      const resultsBefore = await prisma.assessmentResult.findMany({
        where: { assessmentId: assess.id },
      });
      expect(resultsBefore).toHaveLength(2); // v1 provisional, v2 approved

      const reason = 'ปรับเกรดโดยคณะกรรมการหลังพิจารณาประวัติการแข่งขันระดับชาติ';
      expect(reason.length).toBeGreaterThanOrEqual(20);

      const res = await http()
        .post(`/api/v1/assessments/${assess.id}/override`)
        .set('Cookie', committeeCookie)
        .send({
          centerKey: 'N',
          reason,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(assess.id);
      expect(res.body.data.status).toBe('overridden');
      expect(res.body.data.latestResult).toMatchObject({
        version: 3,
        source: 'override',
        status: 'overridden',
        reason,
        flags: ['OVERRIDE'],
        grade: {
          kind: 'exact',
          lower: 'N',
          upper: 'N',
          center: 'N',
          label: 'N',
        },
      });

      // Verify in DB: older versions are still there
      const allResults = await prisma.assessmentResult.findMany({
        where: { assessmentId: assess.id },
        orderBy: { version: 'asc' },
      });
      expect(allResults).toHaveLength(3);
      expect(allResults[0]!.version).toBe(1);
      expect(allResults[1]!.version).toBe(2);
      expect(allResults[2]!.version).toBe(3);
      expect(allResults[2]!.source).toBe('override');
      expect(allResults[2]!.status).toBe('overridden');
      expect(allResults[2]!.flags).toEqual(['OVERRIDE']);
      expect(allResults[2]!.label).toBe('N');
      expect(allResults[2]!.kind).toBe('exact');

      // Verify inputs contains overrideOf: 2
      const latestInputs = allResults[2]!.inputs as any;
      expect(latestInputs.overrideOf).toBe(2);

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: { entityId: assess.id, action: 'assessment.override' },
      });
      expect(audit).toBeTruthy();
      expect(audit?.actorId).toBe(committeeId);
      expect(audit?.before).toMatchObject({
        status: 'approved',
        version: 2,
      });
      expect(audit?.after).toMatchObject({
        status: 'overridden',
        label: 'N',
        version: 3,
      });
      expect(audit?.reason).toBe(reason);

      // Verify officialResults returns the override
      const usersRes = await http()
        .get(`/api/v1/users?q=${encodeURIComponent(subjectDisplayName)}`)
        .set('Cookie', committeeCookie)
        .expect(200);

      expect(usersRes.body.success).toBe(true);
      const subjectItem = usersRes.body.data.items.find((u: any) => u.id === subjectId);
      expect(subjectItem).toBeTruthy();
      expect(subjectItem.gradeLabel).toBe('N');
    });

    it('rejects override with a 19-char reason -> 422', async () => {
      const assess = await createPendingApprovalAssessment();

      const shortReason = '1234567890123456789'; // exactly 19 chars
      expect(shortReason.length).toBe(19);

      const res = await http()
        .post(`/api/v1/assessments/${assess.id}/override`)
        .set('Cookie', committeeCookie)
        .send({
          centerKey: 'N',
          reason: shortReason,
        })
        .expect(422);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('REASON_TOO_SHORT');
    });

    it('rejects override by a Committee member who shares a current team with the subject -> 403 OVERRIDE_CONFLICT_OF_INTEREST', async () => {
      const assess = await createPendingApprovalAssessment();

      const validReason = 'เหตุผลการปรับเกรดยาวเกินยี่สิบตัวอักษรแน่นอน';
      expect(validReason.length).toBeGreaterThanOrEqual(20);

      const res = await http()
        .post(`/api/v1/assessments/${assess.id}/override`)
        .set('Cookie', conflictCommitteeCookie)
        .send({
          centerKey: 'N',
          reason: validReason,
        })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('OVERRIDE_CONFLICT_OF_INTEREST');
      expect(res.body.error.details.teamIds).toContain(teamIds[0]);
    });
  });

  describe('RBAC & Error handling', () => {
    it('Member role gets 403 FORBIDDEN on confirm and override', async () => {
      const assess = await createProvisionalAssessment();

      const confirmRes = await http()
        .post(`/api/v1/assessments/${assess.id}/confirm`)
        .set('Cookie', memberCookie)
        .send({})
        .expect(403);
      expect(confirmRes.body.error.code).toBe('FORBIDDEN');

      const overrideRes = await http()
        .post(`/api/v1/assessments/${assess.id}/override`)
        .set('Cookie', memberCookie)
        .send({ centerKey: 'N', reason: 'เหตุผลยาวเกินยี่สิบตัวอักษรแน่นอน' })
        .expect(403);
      expect(overrideRes.body.error.code).toBe('FORBIDDEN');
    });

    it('Reviewer role gets 403 FORBIDDEN on confirm and override', async () => {
      const assess = await createProvisionalAssessment();

      const confirmRes = await http()
        .post(`/api/v1/assessments/${assess.id}/confirm`)
        .set('Cookie', r1Cookie)
        .send({})
        .expect(403);
      expect(confirmRes.body.error.code).toBe('FORBIDDEN');

      const overrideRes = await http()
        .post(`/api/v1/assessments/${assess.id}/override`)
        .set('Cookie', r1Cookie)
        .send({ centerKey: 'N', reason: 'เหตุผลยาวเกินยี่สิบตัวอักษรแน่นอน' })
        .expect(403);
      expect(overrideRes.body.error.code).toBe('FORBIDDEN');
    });

    it('unknown UUID gets 404 ASSESSMENT_NOT_FOUND', async () => {
      const unknownId = randomUUID();

      const confirmRes = await http()
        .post(`/api/v1/assessments/${unknownId}/confirm`)
        .set('Cookie', committeeCookie)
        .send({})
        .expect(404);
      expect(confirmRes.body.error.code).toBe('ASSESSMENT_NOT_FOUND');

      const overrideRes = await http()
        .post(`/api/v1/assessments/${unknownId}/override`)
        .set('Cookie', committeeCookie)
        .send({ centerKey: 'N', reason: 'เหตุผลยาวเกินยี่สิบตัวอักษรแน่นอน' })
        .expect(404);
      expect(overrideRes.body.error.code).toBe('ASSESSMENT_NOT_FOUND');
    });

    it('unauthenticated guest gets 401 UNAUTHENTICATED', async () => {
      const assess = await createProvisionalAssessment();

      const confirmRes = await http()
        .post(`/api/v1/assessments/${assess.id}/confirm`)
        .send({})
        .expect(401);
      expect(confirmRes.body.error.code).toBe('UNAUTHENTICATED');

      const overrideRes = await http()
        .post(`/api/v1/assessments/${assess.id}/override`)
        .send({ centerKey: 'N', reason: 'เหตุผลยาวเกินยี่สิบตัวอักษรแน่นอน' })
        .expect(401);
      expect(overrideRes.body.error.code).toBe('UNAUTHENTICATED');
    });
  });
});
