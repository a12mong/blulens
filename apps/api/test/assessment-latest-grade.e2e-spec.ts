import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-lat-grd-${randomUUID().slice(0, 8)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

describe('GET /api/v1/assessments - latestGrade + latestResultVersion (bl-26-7)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const userIds: string[] = [];
  let subjectId: string;
  let committeeId: string;
  let otherMemberId: string;

  let subjectCookie: string;
  let committeeCookie: string;

  let assessmentId: string;

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
        displayName: `${tag} Subject Member`,
      },
    });
    subjectId = subject.id;
    userIds.push(subjectId);
    subjectCookie = cookieFor(subjectId, ['Member']);

    const comm = await prisma.user.create({
      data: {
        email: `${tag}-comm@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Committee`,
      },
    });
    committeeId = comm.id;
    userIds.push(committeeId);
    committeeCookie = cookieFor(committeeId, ['Committee']);

    const other = await prisma.user.create({
      data: {
        email: `${tag}-other@test.local`,
        passwordHash: 'x',
        displayName: `${tag} Other Member`,
      },
    });
    otherMemberId = other.id;
    userIds.push(otherMemberId);

    // 2. Assessment with status 'pending_approval'
    const assessment = await prisma.assessment.create({
      data: {
        subjectUserId: subjectId,
        status: 'pending_approval',
        reviewsRequired: 2,
      },
    });
    assessmentId = assessment.id;

    // 3. Computed pending result version 1
    await prisma.assessmentResult.create({
      data: {
        assessmentId,
        version: 1,
        source: 'computed',
        status: 'pending_approval',
        score: 7.5,
        margin: 0.25,
        lowerIndex: 5,
        centerIndex: 6,
        upperIndex: 7,
        kind: 'exact',
        label: 'B+',
        nRaters: 2,
        nExcluded: 0,
        methodVersion: '1.0',
        computedBy: committeeId,
        inputs: {},
      },
    });
  });

  afterAll(async () => {
    if (userIds.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: { status: 'disabled' },
      });
    }
    await app.close();
    await prisma.$disconnect();
  });

  it('before approval: Committee sees latestGrade + latestResultVersion in list, Member sees null', async () => {
    // Committee list
    const commRes = await http()
      .get('/api/v1/assessments')
      .set('Cookie', committeeCookie)
      .expect(200);

    expect(commRes.body.success).toBe(true);
    const commItem = commRes.body.data.items.find((it: { id: string }) => it.id === assessmentId);
    expect(commItem).toBeDefined();
    expect(commItem.latestResultVersion).toBe(1);
    expect(commItem.latestGrade).toMatchObject({
      score: 7.5,
      margin: 0.25,
      label: 'B+',
      kind: 'exact',
    });

    // Subject Member list
    const memberRes = await http()
      .get('/api/v1/assessments')
      .set('Cookie', subjectCookie)
      .expect(200);

    expect(memberRes.body.success).toBe(true);
    const memberItem = memberRes.body.data.items.find(
      (it: { id: string }) => it.id === assessmentId,
    );
    expect(memberItem).toBeDefined();
    expect(memberItem.latestResultVersion).toBeNull();
    expect(memberItem.latestGrade).toBeNull();
  });

  it('before approval: Committee sees latestResult in detail, Member gets latestResult = null', async () => {
    // Committee detail
    const commRes = await http()
      .get(`/api/v1/assessments/${assessmentId}`)
      .set('Cookie', committeeCookie)
      .expect(200);

    expect(commRes.body.success).toBe(true);
    expect(commRes.body.data.latestResultVersion).toBe(1);
    expect(commRes.body.data.latestGrade).toMatchObject({
      score: 7.5,
      margin: 0.25,
      label: 'B+',
    });
    expect(commRes.body.data.latestResult).toMatchObject({
      version: 1,
      status: 'pending_approval',
    });

    // Subject Member detail
    const memberRes = await http()
      .get(`/api/v1/assessments/${assessmentId}`)
      .set('Cookie', subjectCookie)
      .expect(200);

    expect(memberRes.body.success).toBe(true);
    expect(memberRes.body.data.latestResultVersion).toBeNull();
    expect(memberRes.body.data.latestGrade).toBeNull();
    expect(memberRes.body.data.latestResult).toBeNull();
  });

  it('after approval (POST /approve): Member sees latestGrade + latestResult in both list and detail', async () => {
    // Approve as Committee
    await http()
      .post(`/api/v1/assessments/${assessmentId}/approve`)
      .set('Cookie', committeeCookie)
      .send({ note: 'อนุมัติผลประเมิน' })
      .expect(200);

    // Subject Member list
    const memberListRes = await http()
      .get('/api/v1/assessments')
      .set('Cookie', subjectCookie)
      .expect(200);

    const memberItem = memberListRes.body.data.items.find(
      (it: { id: string }) => it.id === assessmentId,
    );
    expect(memberItem).toBeDefined();
    expect(memberItem.latestResultVersion).toBe(2);
    expect(memberItem.latestGrade).toMatchObject({
      score: 7.5,
      margin: 0.25,
      label: 'B+',
      kind: 'exact',
    });

    // Subject Member detail
    const memberDetailRes = await http()
      .get(`/api/v1/assessments/${assessmentId}`)
      .set('Cookie', subjectCookie)
      .expect(200);

    expect(memberDetailRes.body.data.latestResultVersion).toBe(2);
    expect(memberDetailRes.body.data.latestGrade).toMatchObject({
      score: 7.5,
      margin: 0.25,
      label: 'B+',
    });
    expect(memberDetailRes.body.data.latestResult).toMatchObject({
      version: 2,
      status: 'approved',
      reason: 'อนุมัติผลประเมิน',
    });
  });

  it('multi-version: Member only sees highest approved version even if newer pending version exists', async () => {
    // Create a new pending result version 3
    await prisma.assessmentResult.create({
      data: {
        assessmentId,
        version: 3,
        source: 'computed',
        status: 'pending_approval',
        score: 9.5,
        margin: 0.25,
        lowerIndex: 8,
        centerIndex: 9,
        upperIndex: 10,
        kind: 'exact',
        label: 'A',
        nRaters: 1,
        nExcluded: 0,
        methodVersion: '1.0',
        computedBy: committeeId,
        inputs: {},
      },
    });

    // Committee sees version 3
    const commRes = await http()
      .get(`/api/v1/assessments/${assessmentId}`)
      .set('Cookie', committeeCookie)
      .expect(200);

    expect(commRes.body.data.latestResultVersion).toBe(3);
    expect(commRes.body.data.latestGrade.label).toBe('A');
    expect(commRes.body.data.latestResult.version).toBe(3);

    // Subject Member still sees version 2 (highest approved), not version 3 (pending)
    const memberRes = await http()
      .get(`/api/v1/assessments/${assessmentId}`)
      .set('Cookie', subjectCookie)
      .expect(200);

    expect(memberRes.body.data.latestResultVersion).toBe(2);
    expect(memberRes.body.data.latestGrade.label).toBe('B+');
    expect(memberRes.body.data.latestResult.version).toBe(2);
    expect(memberRes.body.data.latestResult.status).toBe('approved');
  });
});
