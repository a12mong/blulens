import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('POST /rubrics/{rubricId}/activate (bl-34-3)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const tag = `rub-act-${Date.now().toString(36)}`;
  const userIds: string[] = [];
  let committeeCookie: string;
  let memberCookie: string;
  let originalActiveId: string;
  let originalMethodVersion: string;
  let draftId: string;

  const http = () => request(app.getHttpServer());
  const cookieFor = (id: string, roles: string[]) =>
    `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;
  const activate = (id: string, body: unknown, cookie = committeeCookie) =>
    http().post(`/api/v1/rubrics/${id}/activate`).set('Cookie', cookie).send(body as object);

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);

    for (const role of ['Committee', 'Member'] as const) {
      const u = await prisma.user.create({
        data: {
          email: `${tag}-${role}@test.local`,
          passwordHash: 'x',
          displayName: `${tag} ${role}`,
          roles: { create: [{ role }] },
        },
      });
      userIds.push(u.id);
      if (role === 'Committee') committeeCookie = cookieFor(u.id, [role]);
      else memberCookie = cookieFor(u.id, [role]);
    }

    const active = await prisma.rubric.findFirstOrThrow({ where: { active: true } });
    originalActiveId = active.id;
    originalMethodVersion = active.methodVersion;
    // the draft slot is shared with other rubric suites; free it, then open this suite's draft
    await prisma.rubric.deleteMany({ where: { active: false, activatedAt: null } });
    draftId = (await http().post('/api/v1/rubrics').set('Cookie', committeeCookie).expect(201)).body.data.id;
  });

  afterAll(async () => {
    // Other suites expect the seeded rubric to be the active one: restore it and drop the version activated here.
    await prisma.$transaction([
      prisma.rubric.updateMany({ where: { active: true }, data: { active: false } }),
      prisma.rubric.update({ where: { id: originalActiveId }, data: { active: true } }),
    ]);
    await prisma.rubric.deleteMany({ where: { id: draftId } });
    await prisma.user.updateMany({ where: { id: { in: userIds } }, data: { status: 'disabled' } });
    await app.close();
  });

  it('reason shorter than 5 -> 400 VALIDATION_FAILED; Member -> 403; unauthenticated -> 401', async () => {
    expect((await activate(draftId, { reason: 'abc' }).expect(400)).body.error.code).toBe('VALIDATION_FAILED');
    expect((await activate(draftId, {}).expect(400)).body.error.code).toBe('VALIDATION_FAILED');
    await activate(draftId, { reason: 'ใช้เกณฑ์ใหม่' }, memberCookie).expect(403);
    await http().post(`/api/v1/rubrics/${draftId}/activate`).send({ reason: 'ใช้เกณฑ์ใหม่' }).expect(401);
  });

  it('activating the draft -> 200 active; GET /rubric serves it; the old version is retired; audit has the reason', async () => {
    const res = await activate(draftId, { reason: 'ปรับน้ำหนักเกณฑ์ไตรมาส 4' }).expect(200);
    expect(res.body.data).toMatchObject({ id: draftId, status: 'active' });
    const newVersion = res.body.data.methodVersion as string;

    expect((await http().get('/api/v1/rubric').expect(200)).body.data.methodVersion).toBe(newVersion);

    const all = (await http().get('/api/v1/rubrics').set('Cookie', committeeCookie).expect(200)).body.data as Array<{
      id: string;
      status: string;
    }>;
    expect(all.find((r) => r.id === originalActiveId)?.status).toBe('retired');
    expect(all.filter((r) => r.status === 'active').map((r) => r.id)).toEqual([draftId]);

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'rubric.activate', entityId: draftId } });
    expect(audit.reason).toBe('ปรับน้ำหนักเกณฑ์ไตรมาส 4');
    expect(audit.before).toEqual({ methodVersion: originalMethodVersion });
    expect(audit.after).toEqual({ methodVersion: newVersion });
  });

  it('activating an active or retired version -> 409 RUBRIC_NOT_DRAFT; unknown id -> 404', async () => {
    expect((await activate(originalActiveId, { reason: 'กลับไปใช้ของเดิม' }).expect(409)).body.error.code).toBe(
      'RUBRIC_NOT_DRAFT',
    );
    expect((await activate(draftId, { reason: 'กดซ้ำอีกครั้ง' }).expect(409)).body.error.code).toBe('RUBRIC_NOT_DRAFT');
    expect(
      (await activate('00000000-0000-4000-8000-000000000000', { reason: 'ไม่มีอยู่จริง' }).expect(404)).body.error.code,
    ).toBe('RUBRIC_NOT_FOUND');
  });
});
