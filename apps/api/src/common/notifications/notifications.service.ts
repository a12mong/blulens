import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

/** docs/specs/notifications.md §2. Stored as text; add a type here, never a DB enum. */
export type NotificationType =
  | 'assessment_approved'
  | 'assessment_returned'
  | 'assessment_confirmed'
  | 'assessment_overridden'
  | 'review_assigned'
  | 'match_result_approved'
  | 'match_result_rejected'
  | 'umpire_assigned'
  | 'knockout_published';

export interface NotificationItem {
  recipientUserId: string;
  type: NotificationType;
  /** Thai, rendered now; cut to 200 chars */
  title: string;
  /** cut to 1000 chars */
  body?: string | null;
  /** in-app path starting with '/' */
  link?: string | null;
}

/**
 * Writes notifications inside the caller's transaction, so a failed state change leaves none behind (§1).
 * Drops the actor (nobody is notified about their own action) and duplicate (recipient, type, link) items.
 */
@Injectable()
export class NotificationsService {
  async emit(
    tx: Prisma.TransactionClient,
    actorId: string | null,
    items: NotificationItem[],
  ): Promise<number> {
    const seen = new Set<string>();
    const data = items
      .filter((i) => i.recipientUserId !== actorId)
      .filter((i) => {
        const key = `${i.recipientUserId}|${i.type}|${i.link ?? ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((i) => {
        if (i.link && !i.link.startsWith('/')) {
          throw new Error(`notification link must be an in-app path: ${i.link}`);
        }
        return {
          recipientUserId: i.recipientUserId,
          type: i.type,
          title: i.title.slice(0, 200),
          body: i.body ? i.body.slice(0, 1000) : null,
          link: i.link ?? null,
        };
      });
    if (data.length === 0) return 0;
    const res = await tx.notification.createMany({ data });
    return res.count;
  }
}
