'use client';

import { useMemo, useState } from 'react';
import { AssessmentTable } from './AssessmentTable';
import { useAssessments } from './api';
import { thaiError } from '@/lib/errors';
import { StatTile } from './StatTile';
import { RaterPanel } from './RaterPanel';
import type { components } from '@/lib/api/schema';

type AssessmentStatus = components['schemas']['AssessmentStatus'];
type Assessment = components['schemas']['Assessment'];

const statusLabels: Record<AssessmentStatus, string> = {
  needs_reviewers: 'ต้องหากรรมการเพิ่ม',
  in_review: 'กำลังรีวิว',
  provisional: 'ชั่วคราว',
  disputed: 'เห็นต่างกัน',
  pending_approval: 'รออนุมัติ',
  approved: 'อนุมัติแล้ว',
  overridden: 'มีการแทนที่',
  draft: 'ร่าง',
  rejected: 'ถูกปฏิเสธ',
  submitted: 'ส่งแล้ว',
  withdrawn: 'ถอนตัว',
};

export function CommitteeAssessments() {
  const [tileStatus, setTileStatus] = useState<AssessmentStatus | undefined>(undefined);
  const [selectStatus, setSelectStatus] = useState<AssessmentStatus | undefined>(undefined);

  // Fetch ALL assessments for counting
  const { data, isPending, isError, error, refetch } = useAssessments(undefined);

  const items = useMemo(() => (data?.items ?? []) as any[], [data?.items]);

  const statusCounts = useMemo(() => {
    const counts: Record<AssessmentStatus, number> = {
      needs_reviewers: 0,
      in_review: 0,
      provisional: 0,
      disputed: 0,
      pending_approval: 0,
      approved: 0,
      overridden: 0,
      draft: 0,
      rejected: 0,
      submitted: 0,
      withdrawn: 0,
    };
    items.forEach((item: Assessment) => {
      if (item.status && item.status in counts) {
        counts[item.status]++;
      }
    });
    return counts;
  }, [items]);

  // Determine which filter to apply (tile takes precedence)
  const activeStatus = tileStatus ?? selectStatus;
  const filteredItems = useMemo(() => {
    if (!activeStatus) return items;
    return items.filter((item: Assessment) => item.status === activeStatus);
  }, [items, activeStatus]);

  const handleTileClick = (status: AssessmentStatus) => {
    setTileStatus((prev) => (prev === status ? undefined : status));
  };

  if (isPending) {
    return (
      <div role="status" data-testid="assessments-loading" className="text-sm text-muted-foreground">
        กำลังโหลด…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <div
          role="alert"
          data-testid="assessments-error"
          className="text-sm text-destructive bg-destructive/10 p-4 rounded"
        >
          {thaiError(error, 'เกิดข้อผิดพลาดในการโหลด')}
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 text-sm rounded border border-border hover:bg-accent"
        >
          ลองใหม่
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {(Object.keys(statusLabels) as AssessmentStatus[]).map((status) => (
          <StatTile
            key={status}
            label={statusLabels[status]}
            count={statusCounts[status]}
            active={tileStatus === status}
            onClick={() => handleTileClick(status)}
          />
        ))}
      </div>

      <RaterPanel />

      <AssessmentTable
        items={filteredItems}
        status={selectStatus}
        onStatusChange={setSelectStatus}
        emptyText="ยังไม่มีผลประเมิน"
      />
    </div>
  );
}

export default CommitteeAssessments;
