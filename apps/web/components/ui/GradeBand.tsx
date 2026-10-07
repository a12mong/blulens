import React from 'react';

export const GRADE_KEYS = [
  'RK1',
  'RK2',
  'RK3',
  'BG1',
  'BG2',
  'BG3',
  'S-',
  'S',
  'S+',
  'N-',
  'N',
  'N+',
  'P-',
  'P',
  'P+',
] as const;

export type GradeKey = (typeof GRADE_KEYS)[number];

export type Tier = 'Rookie' | 'Beginner' | 'Standard' | 'Neutral' | 'Professional';

const TIERS: readonly Tier[] = [
  'Rookie',
  'Rookie',
  'Rookie',
  'Beginner',
  'Beginner',
  'Beginner',
  'Standard',
  'Standard',
  'Standard',
  'Neutral',
  'Neutral',
  'Neutral',
  'Professional',
  'Professional',
  'Professional',
];

export type GradeBandProps = {
  lower: GradeKey;
  upper: GradeKey;
  score: number;
  label?: string;
  provisional?: boolean;
  disputed?: boolean;
  reviewerCount?: number;
};

export function GradeBand({
  lower,
  upper,
  score,
  label,
  provisional,
  disputed,
  reviewerCount,
}: GradeBandProps) {
  const lowerIndex = GRADE_KEYS.indexOf(lower);
  const upperIndex = GRADE_KEYS.indexOf(upper);

  if (
    lowerIndex === -1 ||
    upperIndex === -1 ||
    lowerIndex > upperIndex ||
    typeof score !== 'number' ||
    Number.isNaN(score) ||
    score < 0 ||
    score >= 15
  ) {
    console.error('Invalid GradeBand props:', { lower, upper, score });
    return null;
  }

  let ariaLabel =
    lower === upper
      ? `เกรด ${lower} คะแนน ${score}`
      : `เกรด ${lower} ถึง ${upper} คะแนน ${score}`;

  if (provisional) {
    ariaLabel += ' (ผลชั่วคราว)';
  }
  if (disputed) {
    ariaLabel += ' (ผลไม่ตรงกัน)';
  }

  const markerIndex = Math.floor(score);
  const displayLabel =
    label !== undefined
      ? label
      : lower === upper
        ? lower
        : `${lower}\u2013${upper}`;

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      data-provisional={provisional ? 'true' : undefined}
      data-disputed={disputed ? 'true' : undefined}
      className="inline-flex flex-col gap-1"
    >
      <div className="flex flex-wrap gap-0.5">
        {GRADE_KEYS.map((key, i) => {
          const isActive = i >= lowerIndex && i <= upperIndex;
          const isMarker = i === markerIndex;
          const tier = TIERS[i];

          return (
            <span
              key={key}
              data-testid="grade-cell"
              data-key={key}
              data-tier={tier}
              data-active={isActive ? 'true' : 'false'}
              data-marker={isMarker ? 'true' : undefined}
              className={`border text-xs px-1.5 py-1 text-center ${
                isActive ? 'bg-primary text-primary-foreground' : 'bg-muted'
              } ${isMarker ? 'ring-2' : ''}`}
            >
              {key}
            </span>
          );
        })}
      </div>
      <div data-testid="grade-band-label" className="text-sm text-center">
        {displayLabel}
      </div>
      {(provisional || disputed) && (
        <div className="flex flex-wrap justify-center gap-1 mt-0.5">
          {provisional && (
            <span
              data-testid="grade-badge-provisional"
              className="text-xs border px-1 bg-muted"
            >
              {`ชั่วคราว · กรรมการ ${reviewerCount ?? 1} คน`}
            </span>
          )}
          {disputed && (
            <span
              data-testid="grade-badge-disputed"
              className="text-xs border px-1 bg-muted"
            >
              ผลไม่ตรงกัน รอคณะกรรมการ
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default GradeBand;
