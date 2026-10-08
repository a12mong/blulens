import React from 'react';
import { CheckIcon } from '@/components/ui/Icon';

export type QualificationStatus =
  | 'qualified'
  | 'best_third'
  | 'best_third_contender'
  | 'out';

export interface QualificationBadgeProps {
  q: QualificationStatus;
}

export function QualificationBadge({ q }: QualificationBadgeProps) {
  switch (q) {
    case 'qualified':
      return (
        <span
          data-testid="qual-badge"
          data-q={q}
          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400"
        >
          <span>เข้ารอบ</span>
          <CheckIcon className="w-4 h-4" />
        </span>
      );
    case 'best_third':
      return (
        <span
          data-testid="qual-badge"
          data-q={q}
          className="inline-flex items-center gap-1 text-xs font-medium text-sky-400"
        >
          เข้ารอบ (อันดับ 3 ที่ดีที่สุด)
        </span>
      );
    case 'best_third_contender':
      return (
        <span
          data-testid="qual-badge"
          data-q={q}
          className="inline-flex items-center gap-1 text-xs font-medium text-amber-400"
        >
          ลุ้นอันดับ 3
        </span>
      );
    case 'out':
      return (
        <span
          data-testid="qual-badge"
          data-q={q}
          className="inline-flex items-center gap-1 text-xs font-medium text-night-muted"
        >
          ตกรอบ
        </span>
      );
    default:
      return null;
  }
}
