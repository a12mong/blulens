import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('POST /clips/{clipId}/complete (bl-36-3)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const tag = `clip-done-${Date.now().toString(36)}`;
  const userIds: string[] = [];
  let memberCookie: string;
  let otherCookie: string;
  let draftId: string;

  const http = () => request(app.getHttpServer());
  const cookieFor = (id: string, roles: string[]) =>
    `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;
  const bytes = Buffer.alloc(2048, 7);

  /** upload-url for a 2048-byte mp4; optionally PUT `body` to the returned URL. */
  const startUpload = async (body?: Buffer) => {
    const res = await http()
      .post(`/api/v1/assessments/${draftId}/clips/upload-url`)
      .set('Cookie', memberCookie)
      .send({ fileName: 'smash.mp4', contentType: 'video/mp4', sizeBytes: bytes.length })
      .expect(200);
    if (body) {
      const put = await fetch(res.body.data.uploadUrl, {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'video/mp4' },
      });
      expect(put.status).toBe(200);
    }
    return res.body.data.clipId as string;
  };
  const complete = (clipId: string, durationSec: unknown = 42, cookie = memberCookie) =>
    http().post(`/api/v1/clips/${clipId}/complete`).set('Cookie', cookie).send({ durationSec });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);

    const [member, other] = await Promise.all(
      ['member', 'other'].map((who) =>
        prisma.user.create({
          data: {
            email: `${tag}-${who}@test.local`,
            passwordHash: 'x',
            displayName: `${tag} ${who}`,
            roles: { create: [{ role: 'Member' }] },
          },
        }),
      ),
    );
    userIds.push(member!.id, other!.id);
    memberCookie = cookieFor(member!.id, ['Member']);
    otherCookie = cookieFor(other!.id, ['Member']);
    draftId = (await prisma.assessment.create({ data: { subjectUserId: member!.id, status: 'draft' } })).id;
  });

  afterAll(async () => {
    await prisma.user.updateMany({ where: { id: { in: userIds } }, data: { status: 'disabled' } });
    await app.close();
  });

  it('PUT then complete -> 200 uploaded with a viewUrl that serves the bytes; second call is idempotent', async () => {
    const clipId = await startUpload(bytes);

    const res = await complete(clipId).expect(200);
    expect(res.body.data).toMatchObject({ id: clipId, status: 'uploaded', durationSec: 42 });
    const download = await fetch(res.body.data.viewUrl);
    expect(download.status).toBe(200);
    expect(Buffer.from(await download.arrayBuffer()).equals(bytes)).toBe(true);

    const row = await prisma.clip.findUniqueOrThrow({ where: { id: clipId } });
    expect(row.uploadExpiresAt).toBeNull();
    expect(await prisma.auditLog.count({ where: { action: 'clip.complete', entityId: clipId } })).toBe(1);

    const again = await complete(clipId, 99).expect(200);
    expect(again.body.data).toMatchObject({ id: clipId, status: 'uploaded', durationSec: 42 });
  });

  it('complete before any PUT -> 409 CLIP_NOT_UPLOADED', async () => {
    const clipId = await startUpload();
    expect((await complete(clipId).expect(409)).body.error.code).toBe('CLIP_NOT_UPLOADED');
  });

  it('fewer bytes than declared -> 422 CLIP_MISMATCH, clip stays pending_upload', async () => {
    const clipId = await startUpload(bytes.subarray(0, 100));
    expect((await complete(clipId).expect(422)).body.error.code).toBe('CLIP_MISMATCH');
    expect((await prisma.clip.findUniqueOrThrow({ where: { id: clipId } })).status).toBe('pending_upload');
  });

  it('durationSec 301 -> 422 CLIP_TOO_LONG; 0 -> 400 VALIDATION_FAILED', async () => {
    const clipId = (await prisma.clip.findFirstOrThrow({ where: { assessmentId: draftId, status: 'pending_upload' } }))
      .id;
    expect((await complete(clipId, 301).expect(422)).body.error.code).toBe('CLIP_TOO_LONG');
    expect((await complete(clipId, 0).expect(400)).body.error.code).toBe('VALIDATION_FAILED');
  });

  it('another member, or the assessment is no longer a draft -> 404 CLIP_NOT_FOUND; Reviewer -> 403', async () => {
    const clipId = (await prisma.clip.findFirstOrThrow({ where: { assessmentId: draftId } })).id;
    expect((await complete(clipId, 42, otherCookie).expect(404)).body.error.code).toBe('CLIP_NOT_FOUND');
    await complete(clipId, 42, cookieFor(userIds[0]!, ['Reviewer'])).expect(403);

    await prisma.assessment.update({ where: { id: draftId }, data: { status: 'submitted' } });
    expect((await complete(clipId).expect(404)).body.error.code).toBe('CLIP_NOT_FOUND');
  });
});
