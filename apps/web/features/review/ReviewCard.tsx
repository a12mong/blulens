'use client';

import Link from 'next/link';
import type { components } from '@/lib/api/schema';

type ReviewAssignment = components['schemas']['ReviewAssignment'];

export interface ReviewCardProps {
  assignment: ReviewAssignment;
  now?: Date;
}

export function ReviewCard({ assignment, now = new Date() }: ReviewCardProps) {
  const { id, state, dueAt, submittedAt } = assignment;

  const taskIdShort = id.substring(id.length - 4).toUpperCase();

  const dueDate = new Date(dueAt);
  const isExpiring = state === 'open' && dueDate.getTime() - now.getTime() <= 24 * 60 * 60 * 1000;

  const formatter = new Intl.DateTimeFormat('th-TH-u-ca-gregory', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const dueDateFormatted = formatter.format(dueDate);

  const stateBadgeText = {
    open: 'ยังไม่ทำ',
    submitted: 'ส่งแล้ว',
    expired: 'หมดเวลา',
    declined: 'ปฏิเสธแล้ว',
  }[state];

  const actionText = state === 'open' ? 'เริ่ม' : state === 'submitted' ? 'ดู' : null;
  const showAction = actionText !== null;

  return (
    <article
      data-testid="review-card"
      data-state={state}
      {...(isExpiring && { 'data-testid': 'review-card-soon' })}
      className="border border-border rounded-lg p-4 bg-card text-card-foreground shadow-sm space-y-3"
    >
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-semibold text-base">งาน #{taskIdShort}</h3>
        <div data-testid="review-card-state" className="text-sm font-medium whitespace-nowrap">
          {stateBadgeText}
          {state === 'submitted' && submittedAt && (
            <div className="text-xs text-muted-foreground mt-1">
              ส่ง {formatter.format(new Date(submittedAt))}
            </div>
          )}
        </div>
      </div>

      <div className="text-sm">
        <div>ส่งภายใน {dueDateFormatted}</div>
        {isExpiring && (
          <div className="text-warning-foreground bg-warning px-2 py-1 rounded mt-2 font-medium inline-block">
            ใกล้ครบกำหนด
          </div>
        )}
      </div>

      {showAction && (
        <Link
          href={`/review/tasks/${id}`}
          data-testid="review-card-action"
          className="inline-block min-h-[44px] min-w-[44px] px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 font-medium transition-opacity"
        >
          {actionText}
        </Link>
      )}
    </article>
  );
}
