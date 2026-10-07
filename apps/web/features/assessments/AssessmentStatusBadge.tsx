'use client';

import type { components } from '@/lib/api/schema';

type AssessmentStatus = components['schemas']['AssessmentStatus'];

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

export interface AssessmentStatusBadgeProps {
  status: AssessmentStatus;
}

export function AssessmentStatusBadge({ status }: AssessmentStatusBadgeProps) {
  return (
    <span data-testid="assessment-status" data-status={status} className="text-sm">
      {statusLabels[status]}
    </span>
  );
}

export default AssessmentStatusBadge;
