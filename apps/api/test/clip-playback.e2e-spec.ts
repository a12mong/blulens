import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('GET /clips/{clipId}/playback-url + presigned viewUrl in details (bl-36-4)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const tag = `clip-play-${Date.now().toString(36)}`;
  const userIds: string[] = [];
  const ids: Record<'member' | 'reviewer' | 'stranger' | 'committee', string> = {
    member: '',
    reviewer: '',
    stranger: '',
    committee: '',
  };
  let assessmentId: string;
  let clipId: string;
  let pendingClipId: string;
  let assignmentId: string;

  const http = () => request(app.getHttpServer());
  const cookieFor = (id: string, roles: string[]) =>
    `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;
  const member = () => cookieFor(ids.member, ['Member']);
  const bytes = Buffer.alloc(1500, 3);
  const playback = (id: string, cookie: string) => http().get(`/api/v1/clips/${id}/playback-url`).set('Cookie', cookie);
  const fetchBytes = async (url: string) => Buffer.from(await (await fetch(url)).arrayBuffer());

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);

    const roles = { member: 'Member', reviewer: 'Reviewer', stranger: 'Reviewer', committee: 'Committee' } as const;
    for (const who of Object.keys(roles) as Array<keyof typeof roles>) {
      const u = await prisma.user.create({
        data: {
          email: `${tag}-${who}@test.local`,
          passwordHash: 'x',
          displayName: `${tag} ${who}`,
          roles: { create: [{ role: roles[who] }] },
        },
      });
      ids[who] = u.id;
      userIds.push(u.id);
    }
    assessmentId = (await prisma.assessment.create({ data: { subjectUserId: ids.member, status: 'draft' } })).id;

    // real presign flow: upload-url -> PUT -> complete
    const start = await http()
      .post(`/api/v1/assessments/${assessmentId}/clips/upload-url`)
      .set('Cookie', member())
      .send({ fileName: 'rally.mp4', contentType: 'video/mp4', sizeBytes: bytes.length })
      .expect(200);
    clipId = start.body.data.clipId;
    await fetch(start.body.data.uploadUrl, { method: 'PUT', body: bytes, headers: { 'Content-Type': 'video/mp4' } });
    await http().post(`/api/v1/clips/${clipId}/complete`).set('Cookie', member()).send({ durationSec: 30 }).expect(200);

    pendingClipId = (
      await http()
        .post(`/api/v1/assessments/${assessmentId}/clips/upload-url`)
        .set('Cookie', member())
        .send({ fileName: 'later.mp4', contentType: 'video/mp4', sizeBytes: 10 })
        .expect(200)
    ).body.data.clipId;

    assignmentId = (
      await prisma.reviewAssignment.create({
        data: { assessmentId, reviewerId: ids.reviewer, dueAt: new Date(Date.now() + 72 * 3600 * 1000) },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.user.updateMany({ where: { id: { in: userIds } }, data: { status: 'disabled' } });
    await app.close();
  });

  it('owner, Committee and the assigned reviewer get a fresh URL that serves the bytes', async () => {
    for (const cookie of [member(), cookieFor(ids.committee, ['Committee']), cookieFor(ids.reviewer, ['Reviewer'])]) {
      const res = await playback(clipId, cookie).expect(200);
      expect(new Date(res.body.data.expiresAt).getTime()).toBeGreaterThan(Date.now() + 14 * 60 * 1000);
      expect((await fetchBytes(res.body.data.url)).equals(bytes)).toBe(true);
    }
  });

  it('an unassigned reviewer -> 403 CLIP_FORBIDDEN; pending clip -> 409 CLIP_NOT_UPLOADED; unknown -> 404', async () => {
    expect((await playback(clipId, cookieFor(ids.stranger, ['Reviewer'])).expect(403)).body.error.code).toBe(
      'CLIP_FORBIDDEN',
    );
    expect((await playback(pendingClipId, member()).expect(409)).body.error.code).toBe('CLIP_NOT_UPLOADED');
    expect((await playback('00000000-0000-4000-8000-000000000000', member()).expect(404)).body.error.code).toBe(
      'CLIP_NOT_FOUND',
    );
  });

  it('assessment detail and the reviewer task carry a presigned viewUrl for the bucket clip, null while pending', async () => {
    const detail = await http().get(`/api/v1/assessments/${assessmentId}`).set('Cookie', member()).expect(200);
    const clips = detail.body.data.clips as Array<{ id: string; viewUrl: string | null }>;
    const uploaded = clips.find((c) => c.id === clipId)!;
    expect((await fetchBytes(uploaded.viewUrl!)).equals(bytes)).toBe(true);
    expect(clips.find((c) => c.id === pendingClipId)!.viewUrl).toBeNull();

    const task = await http()
      .get(`/api/v1/reviews/assignments/${assignmentId}`)
      .set('Cookie', cookieFor(ids.reviewer, ['Reviewer']))
      .expect(200);
    const taskClip = (task.body.data.clips as Array<{ id: string; viewUrl: string | null }>).find((c) => c.id === clipId)!;
    expect((await fetchBytes(taskClip.viewUrl!)).equals(bytes)).toBe(true);
  });
});
