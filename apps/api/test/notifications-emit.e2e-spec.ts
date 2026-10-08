import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { NotificationsService } from '../src/common/notifications/notifications.service';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('NotificationsService.emit (bl-39-0)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let notifications: NotificationsService;
  const tag = `notif-emit-${Date.now().toString(36)}`;
  const ids: Record<'actor' | 'a' | 'b', string> = { actor: '', a: '', b: '' };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    notifications = app.get(NotificationsService);
    for (const k of Object.keys(ids) as Array<keyof typeof ids>) {
      ids[k] = (
        await prisma.user.create({
          data: { email: `${tag}-${k}@test.local`, passwordHash: 'x', displayName: `${tag} ${k}` },
        })
      ).id;
    }
  });

  afterAll(async () => {
    // notifications cascade with their recipient
    await prisma.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
    await app.close();
  });

  it('drops the actor and duplicate items, trims title/body, stores rows unread', async () => {
    const count = await prisma.$transaction((tx) =>
      notifications.emit(tx, ids.actor, [
        {
          recipientUserId: ids.actor,
          type: 'assessment_overridden',
          title: 'ไม่ควรได้',
          link: '/x',
        },
        {
          recipientUserId: ids.a,
          type: 'assessment_overridden',
          title: 'ก'.repeat(250),
          body: 'ข'.repeat(1200),
          link: '/x',
        },
        { recipientUserId: ids.a, type: 'assessment_overridden', title: 'ซ้ำ', link: '/x' },
        { recipientUserId: ids.b, type: 'assessment_overridden', title: 'ผลถูกปรับ', link: '/x' },
      ]),
    );
    expect(count).toBe(2);

    const rows = await prisma.notification.findMany({
      where: { recipientUserId: { in: Object.values(ids) } },
    });
    expect(rows.map((r) => r.recipientUserId).sort()).toEqual([ids.a, ids.b].sort());
    const forA = rows.find((r) => r.recipientUserId === ids.a)!;
    expect(forA.title).toHaveLength(200);
    expect(forA.body).toHaveLength(1000);
    expect(forA.readAt).toBeNull();
  });

  it('nothing is left behind when the surrounding transaction fails', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await notifications.emit(tx, null, [
          { recipientUserId: ids.b, type: 'umpire_assigned', title: 'แมตช์ใหม่', link: '/y' },
        ]);
        throw new Error('state change failed');
      }),
    ).rejects.toThrow('state change failed');
    expect(
      await prisma.notification.count({
        where: { recipientUserId: ids.b, type: 'umpire_assigned' },
      }),
    ).toBe(0);
  });

  it('rejects an external link (in-app paths only)', async () => {
    await expect(
      prisma.$transaction((tx) =>
        notifications.emit(tx, null, [
          {
            recipientUserId: ids.a,
            type: 'umpire_assigned',
            title: 't',
            link: 'https://evil.example',
          },
        ]),
      ),
    ).rejects.toThrow(/in-app path/);
  });
});
