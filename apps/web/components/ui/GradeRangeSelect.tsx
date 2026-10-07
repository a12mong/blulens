'use client';

import React, { useId } from 'react';
import { GRADE_KEYS, type GradeKey } from './GradeBand';

export const TIERS = [
  { label: 'Rookie', keys: GRADE_KEYS.slice(0, 3) },
  { label: 'Beginner', keys: GRADE_KEYS.slice(3, 6) },
  { label: 'Standard', keys: GRADE_KEYS.slice(6, 9) },
  { label: 'Neutral', keys: GRADE_KEYS.slice(9, 12) },
  { label: 'Professional', keys: GRADE_KEYS.slice(12, 15) },
] as const;

export type GradeRangeValue = {
  min: GradeKey;
  max: GradeKey;
};

export type GradeRangeSelectProps = {
  min: GradeKey;
  max: GradeKey;
  onChange: (v: GradeRangeValue) => void;
  error?: string;
};

export function GradeRangeSelect({ min, max, onChange, error }: GradeRangeSelectProps) {
  const minId = useId();
  const maxId = useId();

  const handleMinChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMin = e.target.value as GradeKey;
    const minIdx = GRADE_KEYS.indexOf(newMin);
    const maxIdx = GRADE_KEYS.indexOf(max);
    if (minIdx > maxIdx) {
      onChange({ min: newMin, max: newMin });
    } else {
      onChange({ min: newMin, max });
    }
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMax = e.target.value as GradeKey;
    const maxIdx = GRADE_KEYS.indexOf(newMax);
    const minIdx = GRADE_KEYS.indexOf(min);
    if (maxIdx < minIdx) {
      onChange({ min: newMax, max: newMax });
    } else {
      onChange({ min, max: newMax });
    }
  };

  const renderOptions = () => (
    <>
      {TIERS.map((tier) => (
        <optgroup key={tier.label} label={tier.label}>
          {tier.keys.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex items-center gap-3">
        <div className="flex flex-col flex-1 gap-1">
          <label htmlFor={minId} className="text-xs font-medium text-muted-foreground">
            เกรดต่ำสุด
          </label>
          <select
            id={minId}
            data-testid="grade-min"
            value={min}
            onChange={handleMinChange}
            className="w-full border rounded px-3 py-2 text-sm bg-background text-foreground"
          >
            {renderOptions()}
          </select>
        </div>

        <span className="self-end pb-2 text-muted-foreground text-sm font-medium">ถึง</span>

        <div className="flex flex-col flex-1 gap-1">
          <label htmlFor={maxId} className="text-xs font-medium text-muted-foreground">
            เกรดสูงสุด
          </label>
          <select
            id={maxId}
            data-testid="grade-max"
            value={max}
            onChange={handleMaxChange}
            className="w-full border rounded px-3 py-2 text-sm bg-background text-foreground"
          >
            {renderOptions()}
          </select>
        </div>
      </div>

      {error ? (
        <p role="alert" data-testid="grade-range-error" className="text-xs text-destructive mt-1">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default GradeRangeSelect;
