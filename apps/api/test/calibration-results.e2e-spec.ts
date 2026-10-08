import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('GET /calibration-sets/{setId}/results (bl-35-6)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const tag = `cal-res-${Date.now().toString(36)}`;
  const userIds: string[] = [];
  const reviewer: Record<'a' | 'b' | 'c', string> = { a: '', b: '', c: '' };
  let committeeCookie: string;
  let setId: string;

  const http = () => request(app.getHttpServer());
  const cookieFor = (id: string, roles: string[]) =>
    `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);

    const makeUser = async (who: string, role: 'Committee' | 'Reviewer') => {
      const u = await prisma.user.create({
        data: {
          email: `${tag}-${who}@test.local`,
          passwordHash: 'x',
          displayName: `${tag} ${who}`,
          roles: { create: [{ role }] },
        },
      });
      userIds.push(u.id);
      return u.id;
    };
    const committeeId = await makeUser('committee', 'Committee');
    committeeCookie = cookieFor(committeeId, ['Committee']);
    for (const k of ['a', 'b', 'c'] as const) reviewer[k] = await makeUser(k, 'Reviewer');

    setId = (
      await prisma.calibrationSet.create({ data: { name: `${tag} set`, createdBy: committeeId } })
    ).id;
    // reference 'S' = ladder index 7 (centre 7.5), 'N' = index 10 (centre 10.5)
    const clipS = await prisma.calibrationClip.create({
      data: {
        setId,
        objectKey: `calibration/${setId}/s.mp4`,
        referenceIndex: 7,
        status: 'uploaded',
      },
    });
    const clipN = await prisma.calibrationClip.create({
      data: {
        setId,
        objectKey: `calibration/${setId}/n.mp4`,
        referenceIndex: 10,
        status: 'uploaded',
      },
    });

    const due = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    const score = async (reviewerId: string, clipId: string, overall: number | null) => {
      const asg = await prisma.reviewAssignment.create({
        data: {
          kind: 'calibration',
          calibrationClipId: clipId,
          reviewerId,
          dueAt: due,
          state: 'submitted',
        },
      });
      await prisma.review.create({
        data: { assignmentId: asg.id, overall, abstained: overall === null },
      });
    };
    await score(reviewer.a, clipS.id, 8.0); // +0.5
    await score(reviewer.a, clipN.id, 10.0); // -0.5
    await score(reviewer.b, clipS.id, 7.5); // 0
    await score(reviewer.b, clipN.id, null); // abstained: skipped
    // reviewer C has open assignments but no review
    await prisma.reviewAssignment.create({
      data: {
        kind: 'calibration',
        calibrationClipId: clipS.id,
        reviewerId: reviewer.c,
        dueAt: due,
      },
    });
  });

  afterAll(async () => {
    await prisma.user.updateMany({ where: { id: { in: userIds } }, data: { status: 'disabled' } });
    await app.close();
  });

  it('per reviewer: clipsScored, bias and mean absolute error vs the reference centre; abstained and unscored skipped', async () => {
    const res = await http()
      .get(`/api/v1/calibration-sets/${setId}/results`)
      .set('Cookie', committeeCookie)
      .expect(200);
    const expected = [
      { reviewerId: reviewer.a, clipsScored: 2, biasVsReference: 0, meanAbsError: 0.5 },
      { reviewerId: reviewer.b, clipsScored: 1, biasVsReference: 0, meanAbsError: 0 },
    ].sort((x, y) => (x.reviewerId < y.reviewerId ? -1 : 1));
    expect(res.body.data).toEqual(expected);
  });

  it('unknown set -> 404 CALIBRATION_SET_NOT_FOUND; Reviewer -> 403; unauthenticated -> 401', async () => {
    const res = await http()
      .get('/api/v1/calibration-sets/00000000-0000-4000-8000-000000000000/results')
      .set('Cookie', committeeCookie)
      .expect(404);
    expect(res.body.error.code).toBe('CALIBRATION_SET_NOT_FOUND');
    await http()
      .get(`/api/v1/calibration-sets/${setId}/results`)
      .set('Cookie', cookieFor(reviewer.a, ['Reviewer']))
      .expect(403);
    await http().get(`/api/v1/calibration-sets/${setId}/results`).expect(401);
  });
});
