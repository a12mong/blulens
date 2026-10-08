import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';
import { PrismaService } from '../src/common/prisma/prisma.service';

interface ClipDetail {
  clipId: string;
  referenceKey: string;
  status: string;
  viewUrl: string | null;
  durationSec: number | null;
}

describe('calibration clips: upload-url, complete, PATCH, DELETE (bl-35-2, bl-35-4)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const tag = `cal-clips-${Date.now().toString(36)}`;
  const userIds: string[] = [];
  let committeeId: string;
  let committeeCookie: string;
  let reviewerCookie: string;
  let setId: string;

  const http = () => request(app.getHttpServer());
  const cookieFor = (id: string, roles: string[]) =>
    `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;
  const bytes = Buffer.alloc(1200, 9);
  const base = (id = setId) => `/api/v1/calibration-sets/${id}/clips`;
  const uploadUrl = (body: Record<string, unknown>, cookie = committeeCookie, id = setId) =>
    http()
      .post(`${base(id)}/upload-url`)
      .set('Cookie', cookie)
      .send(body);
  const mp4 = {
    fileName: 'ref.mp4',
    contentType: 'video/mp4',
    sizeBytes: bytes.length,
    referenceKey: 'S',
  };
  const put = (url: string, body: Buffer) =>
    fetch(url, { method: 'PUT', body, headers: { 'Content-Type': 'video/mp4' } });
  const complete = (clipId: string, durationSec: number, id = setId) =>
    http()
      .post(`${base(id)}/${clipId}/complete`)
      .set('Cookie', committeeCookie)
      .send({ durationSec });
  const newSet = async () =>
    (
      await http()
        .post('/api/v1/calibration-sets')
        .set('Cookie', committeeCookie)
        .send({ name: `${tag} set` })
        .expect(201)
    ).body.data.id as string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);

    for (const role of ['Committee', 'Reviewer'] as const) {
      const u = await prisma.user.create({
        data: {
          email: `${tag}-${role}@test.local`,
          passwordHash: 'x',
          displayName: `${tag} ${role}`,
          roles: { create: [{ role }] },
        },
      });
      userIds.push(u.id);
      if (role === 'Committee') {
        committeeId = u.id;
        committeeCookie = cookieFor(u.id, [role]);
      } else reviewerCookie = cookieFor(u.id, [role]);
    }
    setId = await newSet();
  });

  afterAll(async () => {
    await prisma.user.updateMany({ where: { id: { in: userIds } }, data: { status: 'disabled' } });
    await app.close();
  });

  it('upload-url -> PUT -> complete: clip uploaded with its referenceKey and a fetchable viewUrl; idempotent', async () => {
    const start = await uploadUrl(mp4).expect(200);
    const { clipId, uploadUrl: url, expiresAt } = start.body.data;
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now() + 14 * 60 * 1000);
    expect(
      (await prisma.calibrationClip.findUniqueOrThrow({ where: { id: clipId } })).objectKey,
    ).toBe(`calibration/${setId}/${clipId}.mp4`);
    expect((await put(url, bytes)).status).toBe(200);

    const done = await complete(clipId, 12).expect(200);
    const clip = (done.body.data.clipDetails as ClipDetail[]).find((c) => c.clipId === clipId)!;
    expect(clip).toMatchObject({ referenceKey: 'S', status: 'uploaded', durationSec: 12 });
    expect(Buffer.from(await (await fetch(clip.viewUrl!)).arrayBuffer()).equals(bytes)).toBe(true);

    await complete(clipId, 99).expect(200);
    expect(
      (await prisma.calibrationClip.findUniqueOrThrow({ where: { id: clipId } })).durationSec,
    ).toBe(12);
  });

  it('complete: no object -> 409 CLIP_NOT_UPLOADED; short PUT -> 422 CLIP_MISMATCH; 301 s -> 422 CLIP_TOO_LONG', async () => {
    const empty = (await uploadUrl(mp4).expect(200)).body.data;
    expect((await complete(empty.clipId, 10).expect(409)).body.error.code).toBe(
      'CLIP_NOT_UPLOADED',
    );

    expect((await put(empty.uploadUrl, bytes.subarray(0, 10))).status).toBe(200);
    expect((await complete(empty.clipId, 10).expect(422)).body.error.code).toBe('CLIP_MISMATCH');
    expect((await complete(empty.clipId, 301).expect(422)).body.error.code).toBe('CLIP_TOO_LONG');
  });

  it('upload-url validation: bad referenceKey, avi, over 500 MB -> 400; Reviewer -> 403; unknown set -> 404', async () => {
    for (const body of [
      { ...mp4, referenceKey: 'XX' },
      { ...mp4, contentType: 'video/avi' },
      { ...mp4, sizeBytes: 524288001 },
    ]) {
      expect((await uploadUrl(body).expect(400)).body.error.code).toBe('VALIDATION_FAILED');
    }
    await uploadUrl(mp4, reviewerCookie).expect(403);
    const unknown = '00000000-0000-4000-8000-000000000000';
    expect((await uploadUrl(mp4, committeeCookie, unknown).expect(404)).body.error.code).toBe(
      'CALIBRATION_SET_NOT_FOUND',
    );
  });

  it('PATCH referenceKey -> 200 detail shows it; bad key -> 400; clip of another set -> 404 CLIP_NOT_FOUND', async () => {
    const clipId = (await uploadUrl(mp4).expect(200)).body.data.clipId as string;
    const res = await http()
      .patch(`${base()}/${clipId}`)
      .set('Cookie', committeeCookie)
      .send({ referenceKey: 'N' })
      .expect(200);
    expect(
      (res.body.data.clipDetails as ClipDetail[]).find((c) => c.clipId === clipId)?.referenceKey,
    ).toBe('N');
    expect(res.body.data.clips).toContainEqual({ clipId, referenceKey: 'N' });

    await http()
      .patch(`${base()}/${clipId}`)
      .set('Cookie', committeeCookie)
      .send({ referenceKey: 'XX' })
      .expect(400);
    const otherSet = await newSet();
    const wrong = await http()
      .patch(`${base(otherSet)}/${clipId}`)
      .set('Cookie', committeeCookie)
      .send({ referenceKey: 'N' })
      .expect(404);
    expect(wrong.body.error.code).toBe('CLIP_NOT_FOUND');
  });

  it('DELETE -> 204 and the clip is gone, audited', async () => {
    const clipId = (await uploadUrl(mp4).expect(200)).body.data.clipId as string;
    await http().delete(`${base()}/${clipId}`).set('Cookie', committeeCookie).expect(204);
    expect(await prisma.calibrationClip.findUnique({ where: { id: clipId } })).toBeNull();
    expect(
      await prisma.auditLog.count({
        where: { action: 'calibration_clip.delete', entityId: clipId, actorId: committeeId },
      }),
    ).toBe(1);
  });

  it('assigned set: upload-url, complete, PATCH, DELETE -> 409 CALIBRATION_SET_ASSIGNED', async () => {
    const clipId = (await uploadUrl(mp4).expect(200)).body.data.clipId as string;
    await prisma.calibrationSet.update({ where: { id: setId }, data: { assignedAt: new Date() } });

    const codes = [
      (await uploadUrl(mp4).expect(409)).body.error.code,
      (await complete(clipId, 10).expect(409)).body.error.code,
      (
        await http()
          .patch(`${base()}/${clipId}`)
          .set('Cookie', committeeCookie)
          .send({ referenceKey: 'P' })
          .expect(409)
      ).body.error.code,
      (await http().delete(`${base()}/${clipId}`).set('Cookie', committeeCookie).expect(409)).body
        .error.code,
    ];
    expect(codes).toEqual(Array(4).fill('CALIBRATION_SET_ASSIGNED'));
  });
});
