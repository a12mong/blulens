import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-notif-emit-${randomUUID().slice(0, 8)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

describe('Assessment Notification Emits (bl-39-2)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  let tournamentId: string;
  let eventId: string;
  let subjectUserId: string;
  let subjectCookie: string;
  let committeeId1: string;
  let committeeId2: string;
  let committeeCookie1: string;
  let committeeCookie2: string;
  let reviewerId1: string;
  let reviewerId2: string;
  let reviewerCookie1: string;
  let assessmentId: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();

    // Create tournament
    const tournament = await prisma.tournament.create({
      data: {
        name: `${tag} Tournament`,
        startsOn: new Date('2026-12-01'),
        entriesCloseAt: new Date('2026-11-25T17:00:00Z'),
      },
    });
    tournamentId = tournament.id;

    // Create event
    const event = await prisma.event.create({
      data: {
        tournamentId,
        discipline: 'MS',
        minReviewers: 2,
      },
    });
    eventId = event.id;

    // Create subject user
    const subject = await prisma.user.create({
      data: {
        email: `${tag}-subject@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Subject`,
      },
    });
    subjectUserId = subject.id;
    await prisma.userRole.create({ data: { userId: subjectUserId, role: 'Member' } });
    subjectCookie = cookieFor(subjectUserId, ['Member']);

    // Create committee members with active status
    const committee1 = await prisma.user.create({
      data: {
        email: `${tag}-committee1@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Committee 1`,
        status: 'active',
      },
    });
    committeeId1 = committee1.id;
    await prisma.userRole.create({ data: { userId: committeeId1, role: 'Committee' } });
    committeeCookie1 = cookieFor(committeeId1, ['Committee']);

    const committee2 = await prisma.user.create({
      data: {
        email: `${tag}-committee2@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Committee 2`,
        status: 'active',
      },
    });
    committeeId2 = committee2.id;
    await prisma.userRole.create({ data: { userId: committeeId2, role: 'Committee' } });
    committeeCookie2 = cookieFor(committeeId2, ['Committee']);

    // Create reviewer users
    const reviewer1 = await prisma.user.create({
      data: {
        email: `${tag}-reviewer1@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Reviewer 1`,
      },
    });
    reviewerId1 = reviewer1.id;
    await prisma.userRole.create({ data: { userId: reviewerId1, role: 'Reviewer' } });
    reviewerCookie1 = cookieFor(reviewerId1, ['Reviewer']);

    const reviewer2 = await prisma.user.create({
      data: {
        email: `${tag}-reviewer2@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Reviewer 2`,
      },
    });
    reviewerId2 = reviewer2.id;
    await prisma.userRole.create({ data: { userId: reviewerId2, role: 'Reviewer' } });

    // Create assessment
    const rubric = await prisma.rubric.create({
      data: {
        methodVersion: 'test-r0',
        active: true,
        criteria: [],
        params: {},
      },
    });

    const assessment = await prisma.assessment.create({
      data: {
        subjectUserId,
        eventId,
        status: 'draft',
        rubricId: rubric.id,
        reviewsRequired: 2,
      },
    });
    assessmentId = assessment.id;

    // Add clip so assessment can be submitted
    await prisma.clip.create({
      data: {
        id: randomUUID(),
        assessmentId,
        objectKey: 'test-key',
        status: 'uploaded',
        contentType: 'video/mp4',
        sizeBytes: BigInt(1024),
        durationSec: 60,
      },
    });

    // Submit assessment
    await http()
      .post(`/api/v1/assessments/${assessmentId}/submit`)
      .set('Cookie', subjectCookie)
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
    // Cleanup
    await prisma.notification.deleteMany({
      where: {
        recipient: {
          email: { contains: tag },
        },
      },
    });
    await prisma.assessmentTransition.deleteMany({
      where: {
        assessment: {
          subject: {
            email: { contains: tag },
          },
        },
      },
    });
    await prisma.assessmentResult.deleteMany({
      where: {
        assessment: {
          subject: {
            email: { contains: tag },
          },
        },
      },
    });
    await prisma.reviewAssignment.deleteMany({
      where: {
        assessment: {
          subject: {
            email: { contains: tag },
          },
        },
      },
    });
    await prisma.clip.deleteMany({
      where: {
        assessment: {
          subject: {
            email: { contains: tag },
          },
        },
      },
    });
    await prisma.assessment.deleteMany({
      where: {
        subject: {
          email: { contains: tag },
        },
      },
    });
    await prisma.event.deleteMany({
      where: {
        tournament: {
          name: { contains: tag },
        },
      },
    });
    await prisma.tournament.deleteMany({
      where: {
        name: { contains: tag },
      },
    });
    const users = await prisma.user.findMany({ where: { email: { contains: tag } } });
    await prisma.userRole.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    await prisma.user.updateMany({
      where: { id: { in: users.map((u) => u.id) } },
      data: { status: 'disabled' },
    });
  });

  it('N5: assign reviewers -> emit blind review notifications to reviewers', async () => {
    await http()
      .post(`/api/v1/assessments/${assessmentId}/assign`)
      .set('Cookie', committeeCookie1)
      .send({ reviewerIds: [reviewerId1, reviewerId2] })
      .expect(204);

    // Check notifications for reviewer 1
    const res1 = await http()
      .get(`/api/v1/me/notifications?limit=10`)
      .set('Cookie', reviewerCookie1)
      .expect(200);

    expect(res1.body.data.items).toContainEqual(
      expect.objectContaining({
        type: 'review_assigned',
        title: 'มีงานประเมินใหม่ 2 งาน',
        body: null,
        link: '/review',
      }),
    );

    // Check notifications for reviewer 2
    const res2 = await http()
      .get(`/api/v1/me/notifications?limit=10`)
      .set('Cookie', `bl_access=${signJwt({ sub: reviewerId2, roles: ['Reviewer'] }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`)
      .expect(200);

    expect(res2.body.data.items).toContainEqual(
      expect.objectContaining({
        type: 'review_assigned',
        title: 'มีงานประเมินใหม่ 2 งาน',
      }),
    );
  });

  it('N1: approve assessment -> emit to member + committee', async () => {
    // Create new assessment for approve test
    const assessment2 = await prisma.assessment.create({
      data: {
        subjectUserId,
        eventId,
        status: 'draft',
        rubricId: (await prisma.rubric.findFirstOrThrow({ where: { active: true } })).id,
        reviewsRequired: 2,
      },
    });

    // Add clip
    await prisma.clip.create({
      data: {
        id: randomUUID(),
        assessmentId: assessment2.id,
        objectKey: 'test-key-2',
        status: 'uploaded',
        contentType: 'video/mp4',
        sizeBytes: BigInt(1024),
        durationSec: 60,
      },
    });

    // Submit
    await http()
      .post(`/api/v1/assessments/${assessment2.id}/submit`)
      .set('Cookie', subjectCookie)
      .expect(200);

    // Assign
    await http()
      .post(`/api/v1/assessments/${assessment2.id}/assign`)
      .set('Cookie', committeeCookie1)
      .send({ reviewerIds: [reviewerId1] })
      .expect(204);

    // Create result
    const result = await prisma.assessmentResult.create({
      data: {
        assessmentId: assessment2.id,
        version: 1,
        source: 'computed',
        status: 'pending_approval',
        score: 5,
        margin: 0.5,
        centerIndex: 2,
        lowerIndex: 1,
        upperIndex: 3,
        kind: 'exact',
        label: 'Good',
        nRaters: 1,
        nExcluded: 0,
        spread: 0,
        flags: [],
        methodVersion: 'test-r0',
        computedBy: 'system',
      },
    });

    // Approve
    await http()
      .put(`/api/v1/assessments/${assessment2.id}/approve`)
      .set('Cookie', committeeCookie1)
      .send({ resultVersion: result.version })
      .expect(200);

    // Check subject notification
    const subjectRes = await http()
      .get(`/api/v1/me/notifications?limit=20`)
      .set('Cookie', subjectCookie)
      .expect(200);

    expect(subjectRes.body.data.items).toContainEqual(
      expect.objectContaining({
        type: 'assessment_approved',
        title: 'ผลการประเมินอนุมัติแล้ว',
        link: `/me/assessments/${assessment2.id}`,
      }),
    );

    // Check committee 2 notification (not the approver)
    const committeeRes = await http()
      .get(`/api/v1/me/notifications?limit=20`)
      .set('Cookie', committeeCookie2)
      .expect(200);

    expect(committeeRes.body.data.items).toContainEqual(
      expect.objectContaining({
        type: 'assessment_approved',
        title: 'ผลการประเมินอนุมัติแล้ว',
        link: `/committee/assessments/${assessment2.id}`,
      }),
    );
  });

  it('N2: return assessment -> emit to member + committee', async () => {
    // Create new assessment for return test
    const assessment3 = await prisma.assessment.create({
      data: {
        subjectUserId,
        eventId,
        status: 'draft',
        rubricId: (await prisma.rubric.findFirstOrThrow({ where: { active: true } })).id,
        reviewsRequired: 2,
      },
    });

    // Add clip
    await prisma.clip.create({
      data: {
        id: randomUUID(),
        assessmentId: assessment3.id,
        objectKey: 'test-key-3',
        status: 'uploaded',
        contentType: 'video/mp4',
        sizeBytes: BigInt(1024),
        durationSec: 60,
      },
    });

    // Submit
    await http()
      .post(`/api/v1/assessments/${assessment3.id}/submit`)
      .set('Cookie', subjectCookie)
      .expect(200);

    // Assign
    await http()
      .post(`/api/v1/assessments/${assessment3.id}/assign`)
      .set('Cookie', committeeCookie1)
      .send({ reviewerIds: [reviewerId1] })
      .expect(204);

    // Create result
    const result = await prisma.assessmentResult.create({
      data: {
        assessmentId: assessment3.id,
        version: 1,
        source: 'computed',
        status: 'pending_approval',
        score: 5,
        margin: 0.5,
        centerIndex: 2,
        lowerIndex: 1,
        upperIndex: 3,
        kind: 'exact',
        label: 'Good',
        nRaters: 1,
        nExcluded: 0,
        spread: 0,
        flags: [],
        methodVersion: 'test-r0',
        computedBy: 'system',
      },
    });

    // Return
    await http()
      .put(`/api/v1/assessments/${assessment3.id}/return`)
      .set('Cookie', committeeCookie1)
      .send({ resultVersion: result.version, reason: 'Need better review data' })
      .expect(200);

    // Check subject notification
    const subjectRes = await http()
      .get(`/api/v1/me/notifications?limit=20&unread=true`)
      .set('Cookie', subjectCookie)
      .expect(200);

    expect(subjectRes.body.data.items).toContainEqual(
      expect.objectContaining({
        type: 'assessment_returned',
        title: 'คำขอประเมินส่งกลับเพื่อแก้ไข',
        link: `/me/assessments/${assessment3.id}`,
      }),
    );
  });

  it('N3: confirm assessment -> emit to member only', async () => {
    // Create assessment in provisional status
    const assessment4 = await prisma.assessment.create({
      data: {
        subjectUserId,
        eventId,
        status: 'provisional',
        rubricId: (await prisma.rubric.findFirstOrThrow({ where: { active: true } })).id,
        reviewsRequired: 2,
      },
    });

    // Create result
    const result = await prisma.assessmentResult.create({
      data: {
        assessmentId: assessment4.id,
        version: 1,
        source: 'computed',
        status: 'pending_approval',
        score: 5,
        margin: 0.5,
        centerIndex: 2,
        lowerIndex: 1,
        upperIndex: 3,
        kind: 'exact',
        label: 'Good',
        nRaters: 1,
        nExcluded: 0,
        spread: 0,
        flags: [],
        methodVersion: 'test-r0',
        computedBy: 'system',
      },
    });

    // Confirm
    await http()
      .put(`/api/v1/assessments/${assessment4.id}/confirm`)
      .set('Cookie', committeeCookie1)
      .send({ resultVersion: result.version })
      .expect(200);

    // Check subject notification exists
    const subjectRes = await http()
      .get(`/api/v1/me/notifications?limit=20&unread=true`)
      .set('Cookie', subjectCookie)
      .expect(200);

    expect(subjectRes.body.data.items).toContainEqual(
      expect.objectContaining({
        type: 'assessment_confirmed',
        title: 'ผลการประเมินยืนยันแล้ว',
        link: `/me/assessments/${assessment4.id}`,
      }),
    );

    // Verify committee does NOT receive this notification
    const committeeRes = await http()
      .get(`/api/v1/me/notifications?limit=20&unread=true`)
      .set('Cookie', committeeCookie2)
      .expect(200);

    const confirmNotif = committeeRes.body.data.items.find(
      (n: any) => n.type === 'assessment_confirmed' && n.link.includes(assessment4.id),
    );
    expect(confirmNotif).toBeUndefined();
  });

  it('N4: override assessment -> emit to member + committee except actor', async () => {
    // Create assessment for override test
    const assessment5 = await prisma.assessment.create({
      data: {
        subjectUserId,
        eventId,
        status: 'pending_approval',
        rubricId: (await prisma.rubric.findFirstOrThrow({ where: { active: true } })).id,
        reviewsRequired: 2,
      },
    });

    // Create result
    await prisma.assessmentResult.create({
      data: {
        assessmentId: assessment5.id,
        version: 1,
        source: 'computed',
        status: 'pending_approval',
        score: 5,
        margin: 0.5,
        centerIndex: 2,
        lowerIndex: 1,
        upperIndex: 3,
        kind: 'exact',
        label: 'Good',
        nRaters: 1,
        nExcluded: 0,
        spread: 0,
        flags: [],
        methodVersion: 'test-r0',
        computedBy: 'system',
      },
    });

    // Override by committee 1
    await http()
      .put(`/api/v1/assessments/${assessment5.id}/override`)
      .set('Cookie', committeeCookie1)
      .send({ centerKey: 'Beginner', reason: 'This is a detailed reason for the override decision' })
      .expect(200);

    // Check subject notification
    const subjectRes = await http()
      .get(`/api/v1/me/notifications?limit=20&unread=true`)
      .set('Cookie', subjectCookie)
      .expect(200);

    expect(subjectRes.body.data.items).toContainEqual(
      expect.objectContaining({
        type: 'assessment_overridden',
        title: 'ผลการประเมินถูกกำหนดเกรดเอง',
        link: `/me/assessments/${assessment5.id}`,
      }),
    );

    // Check committee 2 (not actor) receives notification
    const committeeRes = await http()
      .get(`/api/v1/me/notifications?limit=20&unread=true`)
      .set('Cookie', committeeCookie2)
      .expect(200);

    expect(committeeRes.body.data.items).toContainEqual(
      expect.objectContaining({
        type: 'assessment_overridden',
        title: 'ผลการประเมินถูกกำหนดเกรดเอง',
        link: `/committee/assessments/${assessment5.id}`,
      }),
    );

    // Committee 1 (actor) should NOT get self-notification
    const actor1Res = await http()
      .get(`/api/v1/me/notifications?limit=20&unread=true`)
      .set('Cookie', committeeCookie1)
      .expect(200);

    const overrideToSelf = actor1Res.body.data.items.find(
      (n: any) => n.type === 'assessment_overridden' && n.link.includes(assessment5.id),
    );
    expect(overrideToSelf).toBeUndefined();
  });
});
