import { Injectable, HttpStatus } from '@nestjs/common';
import { Notification, Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ApiException } from '../../common/errors/api.exception';
import type { AuthUser } from '../../common/auth/auth.types';

const getNotificationsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unread: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export type GetNotificationsQuery = z.infer<typeof getNotificationsQuerySchema>;

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPageDto {
  items: NotificationDto[];
  nextCursor: string | null;
  unreadCount: number;
}

@Injectable()
export class MeNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getNotifications(user: AuthUser, query: unknown): Promise<NotificationPageDto> {
    const parseResult = getNotificationsQuerySchema.safeParse(query);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        issue?.message ?? 'Invalid request',
      );
    }

    const { cursor, limit, unread } = parseResult.data;

    // Order: unread first, then newest first (createdAt desc, id desc). Read rows are NOT ordered by readAt,
    // so this is two simple queries (unread part, then read part) instead of one ORDER BY.
    let cursorRow: { readAt: Date | null; createdAt: Date; id: string } | null = null;
    if (cursor) {
      cursorRow = await this.prisma.notification.findFirst({
        where: { id: cursor, recipientUserId: user.id },
        select: { readAt: true, createdAt: true, id: true },
      });
      if (!cursorRow) {
        throw new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'cursor ไม่ถูกต้อง');
      }
    }
    const after = (c: { createdAt: Date; id: string }): Prisma.NotificationWhereInput => ({
      OR: [{ createdAt: { lt: c.createdAt } }, { createdAt: c.createdAt, id: { lt: c.id } }],
    });
    const newestFirst: Prisma.NotificationOrderByWithRelationInput[] = [
      { createdAt: 'desc' },
      { id: 'desc' },
    ];
    const want = limit + 1;

    const rows: Notification[] = [];
    const cursorIsRead = cursorRow?.readAt != null;
    if (!cursorIsRead) {
      rows.push(
        ...(await this.prisma.notification.findMany({
          where: { recipientUserId: user.id, readAt: null, ...(cursorRow ? after(cursorRow) : {}) },
          orderBy: newestFirst,
          take: want,
        })),
      );
    }
    if (!unread && rows.length < want) {
      rows.push(
        ...(await this.prisma.notification.findMany({
          where: {
            recipientUserId: user.id,
            readAt: { not: null },
            ...(cursorRow && cursorIsRead ? after(cursorRow) : {}),
          },
          orderBy: newestFirst,
          take: want - rows.length,
        })),
      );
    }

    const page = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? page[page.length - 1]!.id : null;
    const items = page.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      link: row.link,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }));

    // Count unread (independent of filters)
    const unreadCount = await this.prisma.notification.count({
      where: {
        recipientUserId: user.id,
        readAt: null,
      },
    });

    return {
      items,
      nextCursor,
      unreadCount,
    };
  }

  async readNotification(user: AuthUser, notificationId: string): Promise<void> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.recipientUserId !== user.id) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'NOTIFICATION_NOT_FOUND',
        'Notification not found',
      );
    }

    if (!notification.readAt) {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { readAt: new Date() },
      });
    }
  }

  async readAllNotifications(user: AuthUser): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: {
        recipientUserId: user.id,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return { updated: result.count };
  }
}
