'use client';

import { useState } from 'react';
import { AssessmentTable } from './AssessmentTable';
import { useAssessments } from './api';
import { thaiError } from '@/lib/errors';
import type { components } from '@/lib/api/schema';

type AssessmentStatus = components['schemas']['AssessmentStatus'];

export function CommitteeAssessments() {
  const [status, setStatus] = useState<AssessmentStatus | undefined>(undefined);
  const { data, isPending, isError, error, refetch } = useAssessments(status);

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

  const items = (data?.items ?? []) as any;

  return (
    <AssessmentTable
      items={items}
      status={status}
      onStatusChange={setStatus}
      emptyText="ยังไม่มีผลประเมิน"
    />
  );
}

export default CommitteeAssessments;
