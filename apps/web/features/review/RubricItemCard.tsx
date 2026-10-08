'use client';

import { GradePicker } from '@/components/ui/GradePicker';
import type { GradeKey, Tier } from '@/components/ui/GradeBand';

export type Criterion = {
  key: string;
  nameTh: string;
  weight: number;
  anchorsTh?: Partial<Record<Tier, string>>;
};

export interface RubricItemCardProps {
  index: number;
  criterion: Criterion;
  value: GradeKey | null | undefined;
  onChange: (v: GradeKey | null | undefined) => void;
  readOnly?: boolean;
}

const GRADE_LABELS: Record<GradeKey, string> = {
  RK1: 'มือใหม่ (RK1)',
  RK2: 'มือใหม่ (RK2)',
  RK3: 'มือใหม่ (RK3)',
  BG1: 'เริ่มต้น (BG1)',
  BG2: 'เริ่มต้น (BG2)',
  BG3: 'เริ่มต้น (BG3)',
  'S-': 'มาตรฐาน (S-)',
  S: 'มาตรฐาน (S)',
  'S+': 'มาตรฐาน (S+)',
  'N-': 'กลาง (N-)',
  N: 'กลาง (N)',
  'N+': 'กลาง (N+)',
  'P-': 'มืออาชีพ (P-)',
  P: 'มืออาชีพ (P)',
  'P+': 'มืออาชีพ (P+)',
};

export function RubricItemCard({
  index,
  criterion,
  value,
  onChange,
  readOnly = false,
}: RubricItemCardProps) {
  const getStatusText = (): string => {
    if (value === undefined) {
      return 'ยังไม่เลือก';
    }
    if (value === null) {
      return 'ประเมินไม่ได้';
    }
    return GRADE_LABELS[value] ?? value;
  };

  const isAnswered = value !== undefined;
  const displayIndex = index <= 0 ? 1 : index;

  return (
    <section
      data-testid="rubric-item"
      data-criterion={criterion.key}
      data-answered={isAnswered}
      className="space-y-3 border-b border-border pb-4 last:border-b-0"
    >
      {/* Title and Weight */}
      <div>
        <h3 className="font-medium">
          {displayIndex}. {criterion.nameTh}
        </h3>
        <p className="text-sm text-muted-foreground">น้ำหนัก ×{criterion.weight}</p>
      </div>

      {/* Status Text */}
      <p data-testid="rubric-item-status" className="text-sm">
        {getStatusText()}
      </p>

      {/* Grade Picker (hidden if readOnly) */}
      {!readOnly && (
        <GradePicker
          value={value}
          onChange={onChange}
          allowNA={true}
          anchorsByTier={criterion.anchorsTh}
          aria-label={criterion.nameTh}
        />
      )}
    </section>
  );
}

export default RubricItemCard;
