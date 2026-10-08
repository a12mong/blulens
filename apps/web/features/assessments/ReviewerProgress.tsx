'use client';

import React from 'react';
import { CheckIcon, TimerIcon } from '@/components/ui/Icon';
import type { components } from '@/lib/api/schema';

export type AssignmentProgressRow = components['schemas']['AssignmentProgressRow'];

export interface ReviewerProgressProps {
  assignments?: AssignmentProgressRow[] | null;
}

export const DISCIPLINE_TH: Record<string, string> = {
  MS: 'ชายเดี่ยว',
  WS: 'หญิงเดี่ยว',
  MD: 'ชายคู่',
  WD: 'หญิงคู่',
  XD: 'คู่ผสม',
};

export function formatEventLabel(
  event?: {
    discipline?: 'MS' | 'WS' | 'MD' | 'WD' | 'XD' | string;
    tournamentName?: string;
  } | null
): string {
  if (!event) return 'ประเมินทั่วไป';
  const disc = event.discipline
    ? DISCIPLINE_TH[event.discipline] ?? event.discipline
    : '';
  if (event.tournamentName && disc) {
    return `${event.tournamentName} · ${disc}`;
  }
  return event.tournamentName || disc || 'ประเมินทั่วไป';
}

const STATE_CONFIG: Record<
  AssignmentProgressRow['state'],
  { label: string }
> = {
  open: { label: 'รอส่ง' },
  submitted: { label: 'ส่งแล้ว' },
  expired: { label: 'หมดเวลา' },
  declined: { label: 'ปฏิเสธ' },
};

function getStateIcon(state: AssignmentProgressRow['state']) {
  switch (state) {
    case 'submitted':
      return <CheckIcon className="w-4 h-4" />;
    case 'open':
      return <TimerIcon className="w-4 h-4 text-primary" />;
    case 'expired':
      return <span className="inline-block text-destructive">✕</span>;
    case 'declined':
      return <span className="inline-block text-muted-foreground">⊘</span>;
    default:
      return <span className="inline-block text-muted-foreground">•</span>;
  }
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('th-TH-u-ca-gregory', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return dateStr;
  }
}

export function ReviewerProgress({ assignments }: ReviewerProgressProps) {
  if (!assignments || assignments.length === 0) {
    return null;
  }

  const submittedCount = assignments.filter((a) => a.state === 'submitted').length;
  const totalCount = assignments.length;

  return (
    <section data-testid="detail-progress" className="flex flex-col gap-2">
      <h2 className="text-base font-semibold text-foreground">
        ส่งแล้ว {submittedCount}/{totalCount}
      </h2>
      <div className="overflow-x-auto w-full border border-border rounded-lg bg-card">
        <table className="w-full text-left text-sm border-collapse min-w-[500px]">
          <thead className="bg-muted/50 text-muted-foreground text-xs">
            <tr className="border-b border-border">
              <th className="p-3">กรรมการ</th>
              <th className="p-3">สถานะ</th>
              <th className="p-3">กำหนดส่ง</th>
              <th className="p-3">เวลาส่ง</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {assignments.map((assignment) => {
              const config =
                STATE_CONFIG[assignment.state] ?? {
                  label: assignment.state,
                };
              return (
                <tr
                  key={assignment.id}
                  data-testid="progress-row"
                  className="hover:bg-muted/50"
                >
                  <td className="p-3 font-medium text-foreground">
                    {assignment.reviewerName}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden="true">{getStateIcon(assignment.state)}</span>
                      <span>{config.label}</span>
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {formatDate(assignment.dueAt)}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {assignment.submittedAt
                      ? formatDate(assignment.submittedAt)
                      : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default ReviewerProgress;
