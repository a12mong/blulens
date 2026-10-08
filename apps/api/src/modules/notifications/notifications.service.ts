import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface NotificationEmit {
  recipientUserId: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async emit(
    tx: Prisma.TransactionClient,
    actorId: string,
    items: NotificationEmit[],
  ): Promise<void> {
    const filtered = items.filter((item) => item.recipientUserId !== actorId);
    if (filtered.length === 0) return;

    await tx.notification.createMany({
      data: filtered.map((item) => ({
        recipientUserId: item.recipientUserId,
        type: item.type,
        title: item.title,
        body: item.body ?? null,
        link: item.link ?? null,
        createdAt: new Date(),
      })),
    });
  }
}
