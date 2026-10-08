'use client';

import Link from 'next/link';
import { AssessmentStatusBadge } from './AssessmentStatusBadge';
import { GradeBand, type GradeKey } from '@/components/ui/GradeBand';
import type { components } from '@/lib/api/schema';

type AssessmentStatus = components['schemas']['AssessmentStatus'];
type GradeView = components['schemas']['GradeView'];

export interface Assessment {
  id: string;
  subjectUserId: string;
  subject?: { displayName?: string } | null;
  status: AssessmentStatus;
  latestGrade?: GradeView | null;
  latestResult?: {
    grade: GradeView;
    [key: string]: unknown;
  } | null;
  reviewsSubmitted?: number;
  reviewsRequired?: number;
  createdAt: string;
}

const allStatuses: AssessmentStatus[] = [
  'draft',
  'submitted',
  'in_review',
  'needs_reviewers',
  'provisional',
  'disputed',
  'pending_approval',
  'approved',
  'overridden',
  'rejected',
  'withdrawn',
];

const statusLabels: Record<AssessmentStatus, string> = {
  draft: 'ร่าง',
  submitted: 'ส่งแล้ว',
  in_review: 'กำลังรีวิว',
  needs_reviewers: 'ต้องหากรรมการเพิ่ม',
  provisional: 'ชั่วคราว (กรรมการ 1 คน)',
  disputed: 'เห็นต่างกันมาก',
  pending_approval: 'รออนุมัติ',
  approved: 'อนุมัติแล้ว',
  overridden: 'แก้ไขโดยคณะกรรมการ',
  rejected: 'ไม่ผ่าน',
  withdrawn: 'ถอนคำขอ',
};

export interface AssessmentTableProps {
  items: Assessment[];
  status?: AssessmentStatus;
  onStatusChange?: (s: AssessmentStatus | undefined) => void;
  emptyText?: string;
}

export function AssessmentTable({
  items,
  status,
  onStatusChange,
  emptyText = 'ไม่มีรายการ',
}: AssessmentTableProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div>
        <select
          data-testid="assessment-filter"
          value={status ?? 'all'}
          onChange={(e) => {
            const val = e.target.value === 'all' ? undefined : (e.target.value as AssessmentStatus);
            onStatusChange?.(val);
          }}
          className="px-3 py-2 min-h-[44px] border border-border rounded text-sm bg-background"
        >
          <option value="all">ทั้งหมด</option>
          {allStatuses.map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-border rounded">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium">ผู้ถูกประเมิน</th>
              <th className="px-4 py-2 text-left font-medium">สถานะ</th>
              <th className="px-4 py-2 text-left font-medium">รีวิว</th>
              <th className="px-4 py-2 text-left font-medium">ผล</th>
              <th className="px-4 py-2 text-left font-medium">การกระทำ</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                data-testid="assessment-row"
                data-assessment-id={item.id}
                className="border-t border-border hover:bg-muted/50"
              >
                <td className="px-4 py-2">
                  {item.subject?.displayName ?? 'ไม่ระบุ'}
                </td>
                <td className="px-4 py-2">
                  <AssessmentStatusBadge status={item.status} />
                </td>
                <td className="px-4 py-2">
                  {typeof item.reviewsSubmitted === 'number' &&
                  typeof item.reviewsRequired === 'number'
                    ? `${item.reviewsSubmitted}/${item.reviewsRequired}`
                    : '-'}
                </td>
                <td className="px-4 py-2" data-testid="assessment-result">
                  {(() => {
                    const grade = item.latestResult?.grade ?? item.latestGrade;
                    if (grade) {
                      return (
                        <div className="space-y-1">
                          <div
                            className="text-sm flex flex-wrap items-center gap-1.5"
                            data-testid="assessment-grade-text"
                          >
                            <span className="font-bold">{grade.label}</span>
                            {grade.lower && grade.upper ? (
                              <span className="text-muted-foreground">{` · ช่วง ${grade.lower}–${grade.upper}`}</span>
                            ) : null}
                          </div>
                          {grade.lower &&
                          grade.upper &&
                          typeof grade.score === 'number' ? (
                            <GradeBand
                              lower={grade.lower as GradeKey}
                              upper={grade.upper as GradeKey}
                              score={grade.score}
                              label={grade.label}
                            />
                          ) : null}
                        </div>
                      );
                    }
                    return (
                      <span className="text-muted-foreground">
                        {typeof item.reviewsSubmitted === 'number' &&
                        typeof item.reviewsRequired === 'number'
                          ? `รอผู้ตรวจ ${item.reviewsSubmitted}/${item.reviewsRequired}`
                          : 'รอผล'}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-4 py-2">
                  <Link
                    href={`/committee/assessments/${item.id}`}
                    data-testid="assessment-open"
                    className="text-primary hover:underline min-h-[44px] inline-flex items-center"
                  >
                    ดูรายละเอียด
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AssessmentTable;
