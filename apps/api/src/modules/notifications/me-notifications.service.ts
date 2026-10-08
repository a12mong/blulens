import { Injectable, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ApiException } from '../../common/errors/api.exception';
import type { AuthUser } from '../../common/auth/auth.types';

const getNotificationsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  unread: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
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

  async getNotifications(
    user: AuthUser,
    query: unknown,
  ): Promise<NotificationPageDto> {
    const parseResult = getNotificationsQuerySchema.safeParse(query);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      throw new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', issue?.message ?? 'Invalid request');
    }

    const { cursor, limit, unread } = parseResult.data;

    // Validate cursor if provided
    let cursorRow: { readAt: Date | null; createdAt: Date; id: string } | null = null;
    if (cursor) {
      cursorRow = await this.prisma.notification.findUnique({
        where: { id: cursor },
        select: { readAt: true, createdAt: true, id: true },
      });
      if (!cursorRow) {
        throw new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Cursor notification not found');
      }
      // Verify cursor belongs to caller
      const belongsToUser = await this.prisma.notification.count({
        where: { id: cursor, recipientUserId: user.id },
      });
      if (belongsToUser === 0) {
        throw new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Cursor does not belong to user');
      }
    }

    // Build WHERE clause for base query
    const where: Prisma.NotificationWhereInput = {
      recipientUserId: user.id,
    };

    // Add pagination condition
    if (cursorRow) {
      const isUnread = cursorRow.readAt === null;
      if (isUnread) {
        // Cursor was unread: get remaining unread + all read
        where.OR = [
          {
            AND: [
              { readAt: null },
              {
                OR: [
                  { createdAt: { lt: cursorRow.createdAt } },
                  { AND: [{ createdAt: cursorRow.createdAt }, { id: { lt: cursorRow.id } }] },
                ],
              },
            ],
          },
          { readAt: { not: null } },
        ];
      } else {
        // Cursor was read: get remaining read
        where.AND = [
          {
            readAt: { not: null },
          },
          {
            OR: [
              { createdAt: { lt: cursorRow.createdAt } },
              { AND: [{ createdAt: cursorRow.createdAt }, { id: { lt: cursorRow.id } }] },
            ],
          },
        ];
      }
    }

    // If unread filter is requested, only return unread (but continue respecting cursor logic)
    if (unread) {
      if (where.OR) {
        // Complex case: cursor is unread, filter is unread
        // Replace OR with just the unread part
        where.AND = [
          { readAt: null },
          {
            OR: [
              { createdAt: { lt: cursorRow!.createdAt } },
              { AND: [{ createdAt: cursorRow!.createdAt }, { id: { lt: cursorRow!.id } }] },
            ],
          },
        ];
        delete where.OR;
      } else {
        // Add unread filter
        (where as any).readAt = null;
      }
    }

    // Fetch limit + 1 rows to determine if there are more
    const rows = await this.prisma.notification.findMany({
      where,
      orderBy: [
        { readAt: 'asc' },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: limit + 1,
    });

    // Determine next cursor
    let nextCursor: string | null = null;
    if (rows.length > limit) {
      nextCursor = rows[limit - 1]!.id;
    }

    // Return only up to limit rows
    const items = rows.slice(0, limit).map((row) => ({
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
