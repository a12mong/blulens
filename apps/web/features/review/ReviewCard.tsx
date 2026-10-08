'use client';

import Link from 'next/link';
import type { components } from '@/lib/api/schema';

type ReviewAssignment = components['schemas']['ReviewAssignment'];

export type ReviewAssignmentWithClips = ReviewAssignment & {
  clipCount?: number;
  totalDurationSec?: number | null;
  clips?: Array<{ id?: string; durationSec?: number | null }>;
};

export interface ReviewCardProps {
  assignment: ReviewAssignmentWithClips;
  now?: Date;
}

export function ReviewCard({ assignment, now = new Date() }: ReviewCardProps) {
  const { id, state, dueAt, submittedAt } = assignment;

  const taskIdShort = id.substring(id.length - 4).toUpperCase();

  const dueDate = new Date(dueAt);
  const diffMs = dueDate.getTime() - now.getTime();
  const isOverdue = diffMs <= 0;
  const diffDays = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
  const isExpiring = state === 'open' && !isOverdue && diffMs <= 24 * 60 * 60 * 1000;

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

  const rawClips = assignment.clips;
  const count = assignment.clipCount ?? rawClips?.length;
  const hasDuration =
    typeof assignment.totalDurationSec === 'number' ||
    (rawClips !== undefined && rawClips.some((c) => typeof c.durationSec === 'number'));

  let totalDuration: number | null = null;
  if (typeof assignment.totalDurationSec === 'number') {
    totalDuration = assignment.totalDurationSec;
  } else if (hasDuration && rawClips) {
    totalDuration = rawClips.reduce((sum, c) => sum + (c.durationSec ?? 0), 0);
  }

  let clipsText: string | null = null;
  if (typeof count === 'number') {
    if (typeof totalDuration === 'number') {
      const mins = Math.floor(totalDuration / 60);
      const secs = Math.round(totalDuration % 60);
      const mmss = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      clipsText = `${count} คลิป · ยาวรวม ${mmss}`;
    } else {
      clipsText = `${count} คลิป`;
    }
  }

  return (
    <article
      data-testid="review-card"
      data-state={state}
      {...(isExpiring && { 'data-testid': 'review-card-soon' })}
      className="border border-border rounded-lg p-4 bg-card text-card-foreground shadow-sm space-y-3"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-base">งาน #{taskIdShort}</h3>
          {clipsText && (
            <div data-testid="review-card-clips" className="text-sm text-muted-foreground mt-0.5">
              {clipsText}
            </div>
          )}
        </div>
        <div data-testid="review-card-state" className="text-sm font-medium whitespace-nowrap text-right">
          {stateBadgeText}
          {state === 'submitted' && submittedAt && (
            <div className="text-xs text-muted-foreground mt-1">
              ส่ง {formatter.format(new Date(submittedAt))}
            </div>
          )}
        </div>
      </div>

      <div className="text-sm space-y-1.5">
        <div>ส่งภายใน {dueDateFormatted}</div>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            data-testid="review-card-due"
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
              isOverdue
                ? 'bg-destructive/15 text-destructive'
                : 'bg-secondary text-secondary-foreground'
            }`}
          >
            <span aria-hidden="true">{isOverdue ? '⚠️' : '⏱️'}</span>
            <span>{isOverdue ? 'เกินกำหนด' : `เหลือ ${diffDays} วัน`}</span>
          </span>
          {isExpiring && (
            <span className="text-warning-foreground bg-warning px-2 py-0.5 rounded text-xs font-medium inline-block">
              ใกล้ครบกำหนด
            </span>
          )}
        </div>
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
