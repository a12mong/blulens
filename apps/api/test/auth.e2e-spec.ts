import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Roles } from '../src/common/auth/decorators';

/** Test-only endpoint to prove the @Roles guard (union of roles). */
@Controller('probe')
class ProbeController {
  @Roles('Admin', 'Committee')
  @Get('staff')
  staff() {
    return { ok: true };
  }
}

const prisma = new PrismaClient();
const PASSWORD = 'correct-horse-battery';
const email = () => `auth-${randomUUID()}@test.local`;

/** name=value pairs from Set-Cookie, plus the raw header lines for attribute checks. */
function cookies(res: request.Response): { jar: Record<string, string>; raw: string[] } {
  const raw = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const jar: Record<string, string> = {};
  for (const line of raw) {
    const [pair] = line.split(';');
    const i = pair!.indexOf('=');
    jar[pair!.slice(0, i)] = pair!.slice(i + 1);
  }
  return { jar, raw };
}

describe('auth (bl-10 platform)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule], controllers: [ProbeController] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    // The dev DB is shared: another agent's UI session may already have used a test user (e.g. picked it as a
    // player). Delete what we can and disable the rest so it never shows in pickers.
    const users = await prisma.user.findMany({
      where: { email: { startsWith: 'auth-', endsWith: '@test.local' } },
      select: { id: true },
    });
    for (const u of users) {
      await prisma.user.delete({ where: { id: u.id } }).catch(() =>
        prisma.user.update({ where: { id: u.id }, data: { status: 'disabled' } }),
      );
    }
    await prisma.$disconnect();
    await app.close();
  });

  it('registers a Member, sets the three cookies, and rejects a duplicate email', async () => {
    const e = email();
    const res = await http().post('/api/v1/auth/register').send({ email: e.toUpperCase(), password: PASSWORD, displayName: 'นักกีฬา' }).expect(201);
    expect(res.body.data).toMatchObject({ email: e, roles: ['Member'], teamIds: [], currentGrade: null });
    expect(res.body.data.permissions).toContain('assessment.request');

    const { jar, raw } = cookies(res);
    expect(Object.keys(jar).sort()).toEqual(['bl_access', 'bl_refresh', 'bl_session']);
    expect(raw.find((l) => l.startsWith('bl_refresh='))).toMatch(/Path=\/api\/v1\/auth; .*HttpOnly; SameSite=Lax/);
    expect(raw.find((l) => l.startsWith('bl_access='))).toMatch(/Path=\/; .*HttpOnly/);
    expect(raw.find((l) => l.startsWith('bl_session='))).not.toMatch(/HttpOnly/);

    const dup = await http().post('/api/v1/auth/register').send({ email: e, password: PASSWORD, displayName: 'x' }).expect(409);
    expect(dup.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('logs in, serves /auth/me only with the access cookie, and rejects a wrong password', async () => {
    const e = email();
    await http().post('/api/v1/auth/register').send({ email: e, password: PASSWORD, displayName: 'a' }).expect(201);

    const bad = await http().post('/api/v1/auth/login').send({ identifier: e, password: 'wrong-password' }).expect(401);
    expect(bad.body.error.code).toBe('UNAUTHENTICATED');

    const ok = await http().post('/api/v1/auth/login').send({ identifier: e, password: PASSWORD }).expect(200);
    const { jar } = cookies(ok);
    await http().get('/api/v1/auth/me').expect(401);
    const me = await http().get('/api/v1/auth/me').set('Cookie', `bl_access=${jar.bl_access}`).expect(200);
    expect(me.body.data.email).toBe(e);
  });

  it('rotates the refresh token once and revokes the whole family on reuse', async () => {
    const e = email();
    const reg = await http().post('/api/v1/auth/register').send({ email: e, password: PASSWORD, displayName: 'r' }).expect(201);
    const first = cookies(reg).jar.bl_refresh!;

    const rotated = await http().post('/api/v1/auth/refresh').set('Cookie', `bl_refresh=${first}`).expect(204);
    const second = cookies(rotated).jar.bl_refresh!;
    expect(second).not.toBe(first);

    // the old token again = leaked: 401, and the fresh token of the same family dies with it
    await http().post('/api/v1/auth/refresh').set('Cookie', `bl_refresh=${first}`).expect(401);
    await http().post('/api/v1/auth/refresh').set('Cookie', `bl_refresh=${second}`).expect(401);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: e } });
    // both presentations of a revoked token are logged: the leaked one, then the family member it took down
    expect(await prisma.auditLog.count({ where: { action: 'auth.refresh_reuse', entityId: user.id } })).toBe(2);
  });

  it('logout revokes the session and clears cookies', async () => {
    const e = email();
    const reg = await http().post('/api/v1/auth/register').send({ email: e, password: PASSWORD, displayName: 'l' }).expect(201);
    const refresh = cookies(reg).jar.bl_refresh!;
    const out = await http().post('/api/v1/auth/logout').set('Cookie', `bl_refresh=${refresh}`).expect(204);
    expect(cookies(out).jar.bl_access).toBe('');
    await http().post('/api/v1/auth/refresh').set('Cookie', `bl_refresh=${refresh}`).expect(401);
  });

  it('rejects a mutating request from a foreign Origin (CSRF) and accepts the web origin', async () => {
    const res = await http()
      .post('/api/v1/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ identifier: 'x@test.local', password: 'whatever' })
      .expect(403);
    expect(res.body.error.code).toBe('ORIGIN_FORBIDDEN');
    await http()
      .post('/api/v1/auth/login')
      .set('Origin', new URL(process.env.WEB_URL ?? 'http://localhost:3100').origin)
      .send({ identifier: 'x@test.local', password: 'whatever' })
      .expect(401);
  });

  it('enforces @Roles as a union: Member gets 403, Committee gets 200', async () => {
    const e = email();
    const reg = await http().post('/api/v1/auth/register').send({ email: e, password: PASSWORD, displayName: 'c' }).expect(201);
    const memberCookie = `bl_access=${cookies(reg).jar.bl_access}`;
    const denied = await http().get('/api/v1/probe/staff').set('Cookie', memberCookie).expect(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');

    const user = await prisma.user.findUniqueOrThrow({ where: { email: e } });
    await prisma.userRole.create({ data: { userId: user.id, role: 'Committee' } });
    const login = await http().post('/api/v1/auth/login').send({ identifier: e, password: PASSWORD }).expect(200);
    await http().get('/api/v1/probe/staff').set('Cookie', `bl_access=${cookies(login).jar.bl_access}`).expect(200);
  });
});
