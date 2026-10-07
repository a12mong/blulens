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
    return `ให้ ${value}`;
  };

  const isAnswered = value !== undefined;

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
          {index}. {criterion.nameTh}
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
