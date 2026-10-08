import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { signJwt } from '../src/common/auth/jwt';

const prisma = new PrismaClient();
const tag = `zz-notif-${randomUUID().slice(0, 8)}`;

const cookieFor = (id: string, roles: string[]) =>
  `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;

describe('GET/POST /me/notifications (bl-39-1)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  let userAId: string;
  let userACookie: string;
  let userBId: string;
  let userBCookie: string;
  let notifA1Id: string;
  let notifA2Id: string;
  let notifA3Id: string;
  let notifA4Id: string;
  let notifA5Id: string;
  let notifBId: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();

    // Create user A
    const userA = await prisma.user.create({
      data: {
        email: `${tag}-user-a@test.local`,
        passwordHash: 'x',
        displayName: `${tag} User A`,
      },
    });
    userAId = userA.id;
    await prisma.userRole.create({ data: { userId: userAId, role: 'Member' } });
    userACookie = cookieFor(userAId, ['Member']);

    // Create user B
    const userB = await prisma.user.create({
      data: {
        email: `${tag}-user-b@test.local`,
        passwordHash: 'x',
        displayName: `${tag} User B`,
      },
    });
    userBId = userB.id;
    await prisma.userRole.create({ data: { userId: userBId, role: 'Member' } });
    userBCookie = cookieFor(userBId, ['Member']);

    // Create 5 notifications for user A (3 unread + 2 read)
    // unread 1 (newest unread)
    const now = new Date();
    const notifA1 = await prisma.notification.create({
      data: {
        recipientUserId: userAId,
        type: 'assessment_approved',
        title: 'Assessment Approved 1',
        body: 'Congratulations',
        link: '/me/assessments/1',
        createdAt: new Date(now.getTime() - 10000),
      },
    });
    notifA1Id = notifA1.id;

    // unread 2
    const notifA2 = await prisma.notification.create({
      data: {
        recipientUserId: userAId,
        type: 'assessment_approved',
        title: 'Assessment Approved 2',
        createdAt: new Date(now.getTime() - 20000),
      },
    });
    notifA2Id = notifA2.id;

    // unread 3 (oldest unread)
    const notifA3 = await prisma.notification.create({
      data: {
        recipientUserId: userAId,
        type: 'assessment_approved',
        title: 'Assessment Approved 3',
        createdAt: new Date(now.getTime() - 30000),
      },
    });
    notifA3Id = notifA3.id;

    // read 1 (newest read)
    const notifA4 = await prisma.notification.create({
      data: {
        recipientUserId: userAId,
        type: 'assessment_approved',
        title: 'Assessment Approved 4',
        readAt: new Date(now.getTime() - 5000),
        createdAt: new Date(now.getTime() - 40000),
      },
    });
    notifA4Id = notifA4.id;

    // read 2 (oldest read)
    const notifA5 = await prisma.notification.create({
      data: {
        recipientUserId: userAId,
        type: 'assessment_approved',
        title: 'Assessment Approved 5',
        readAt: new Date(now.getTime() - 5000),
        createdAt: new Date(now.getTime() - 50000),
      },
    });
    notifA5Id = notifA5.id;

    // Create 1 unread notification for user B
    const notifB = await prisma.notification.create({
      data: {
        recipientUserId: userBId,
        type: 'review_assigned',
        title: 'Review Assigned',
        link: '/review',
        createdAt: new Date(now.getTime() - 15000),
      },
    });
    notifBId = notifB.id;
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
    const users = await prisma.user.findMany({ where: { email: { contains: tag } } });
    await prisma.userRole.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    await prisma.user.updateMany({
      where: { id: { in: users.map((u) => u.id) } },
      data: { status: 'disabled' },
    });
  });

  it('GET as A -> unread rows first newest-first, then read newest-first; unreadCount 3; never B row', async () => {
    const res = await http()
      .get('/api/v1/me/notifications')
      .set('Cookie', userACookie)
      .expect(200);

    expect(res.body.data).toHaveProperty('items');
    expect(res.body.data).toHaveProperty('nextCursor');
    expect(res.body.data).toHaveProperty('unreadCount');
    expect(res.body.data.unreadCount).toBe(3);
    expect(res.body.data.items).toHaveLength(5);

    // Order: unread first (A1, A2, A3), then read (A4, A5)
    expect(res.body.data.items[0].id).toBe(notifA1Id);
    expect(res.body.data.items[0].readAt).toBeNull();
    expect(res.body.data.items[1].id).toBe(notifA2Id);
    expect(res.body.data.items[1].readAt).toBeNull();
    expect(res.body.data.items[2].id).toBe(notifA3Id);
    expect(res.body.data.items[2].readAt).toBeNull();
    expect(res.body.data.items[3].id).toBe(notifA4Id);
    expect(res.body.data.items[3].readAt).not.toBeNull();
    expect(res.body.data.items[4].id).toBe(notifA5Id);
    expect(res.body.data.items[4].readAt).not.toBeNull();

    // Never B's notification
    const hasBNotif = res.body.data.items.some((n: { id: string }) => n.id === notifBId);
    expect(hasBNotif).toBe(false);
  });

  it('limit=2 -> page 1 (2 unread) + nextCursor, page 2 (1 unread + 1 read) + nextCursor, page 3 (1 read) + null', async () => {
    const res1 = await http()
      .get('/api/v1/me/notifications?limit=2')
      .set('Cookie', userACookie)
      .expect(200);

    expect(res1.body.data.items).toHaveLength(2);
    expect(res1.body.data.items[0].id).toBe(notifA1Id);
    expect(res1.body.data.items[1].id).toBe(notifA2Id);
    expect(res1.body.data.nextCursor).toBe(notifA2Id);

    const res2 = await http()
      .get(`/api/v1/me/notifications?limit=2&cursor=${res1.body.data.nextCursor}`)
      .set('Cookie', userACookie)
      .expect(200);

    expect(res2.body.data.items).toHaveLength(2);
    expect(res2.body.data.items[0].id).toBe(notifA3Id);
    expect(res2.body.data.items[1].id).toBe(notifA4Id);
    expect(res2.body.data.nextCursor).toBe(notifA4Id);

    const res3 = await http()
      .get(`/api/v1/me/notifications?limit=2&cursor=${res2.body.data.nextCursor}`)
      .set('Cookie', userACookie)
      .expect(200);

    expect(res3.body.data.items).toHaveLength(1);
    expect(res3.body.data.items[0].id).toBe(notifA5Id);
    expect(res3.body.data.nextCursor).toBeNull();
  });

  it('unread=true -> only the 3 unread, unreadCount still 3', async () => {
    const res = await http()
      .get('/api/v1/me/notifications?unread=true')
      .set('Cookie', userACookie)
      .expect(200);

    expect(res.body.data.items).toHaveLength(3);
    expect(res.body.data.items[0].id).toBe(notifA1Id);
    expect(res.body.data.items[1].id).toBe(notifA2Id);
    expect(res.body.data.items[2].id).toBe(notifA3Id);
    expect(res.body.data.unreadCount).toBe(3);
    expect(res.body.data.nextCursor).toBeNull();
  });

  it('read on one -> 204, unreadCount 2', async () => {
    await http()
      .post(`/api/v1/me/notifications/${notifA1Id}/read`)
      .set('Cookie', userACookie)
      .expect(204);

    const res = await http()
      .get('/api/v1/me/notifications?limit=1')
      .set('Cookie', userACookie)
      .expect(200);

    expect(res.body.data.unreadCount).toBe(2);
  });

  it('read again -> 204 and readAt unchanged', async () => {
    const before = await prisma.notification.findUnique({ where: { id: notifA1Id } });
    const readAtBefore = before!.readAt;

    await new Promise((r) => setTimeout(r, 10));

    await http()
      .post(`/api/v1/me/notifications/${notifA1Id}/read`)
      .set('Cookie', userACookie)
      .expect(204);

    const after = await prisma.notification.findUnique({ where: { id: notifA1Id } });
    expect(after!.readAt?.getTime()).toBe(readAtBefore?.getTime());
  });

  it('read B notification as A -> 404', async () => {
    await http()
      .post(`/api/v1/me/notifications/${notifBId}/read`)
      .set('Cookie', userACookie)
      .expect(404);
  });

  it('read-all -> { updated: 2 } then { updated: 0 } (marks remaining 2 unread)', async () => {
    const res1 = await http()
      .post('/api/v1/me/notifications/read-all')
      .set('Cookie', userACookie)
      .expect(200);

    expect(res1.body.data.updated).toBe(2);

    const res2 = await http()
      .post('/api/v1/me/notifications/read-all')
      .set('Cookie', userACookie)
      .expect(200);

    expect(res2.body.data.updated).toBe(0);
  });

  it('B notifications untouched after A reads', async () => {
    const res = await http()
      .get('/api/v1/me/notifications')
      .set('Cookie', userBCookie)
      .expect(200);

    expect(res.body.data.unreadCount).toBe(1);
  });

  it('Unauthenticated -> 401', async () => {
    await http().get('/api/v1/me/notifications').expect(401);
  });
});
