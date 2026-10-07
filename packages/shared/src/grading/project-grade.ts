import { GRADES, type GradeKey, type Tier, tierOf } from './grades';

export type GradeKind = 'exact' | 'straddle' | 'wide';

export interface GradeView {
  score: number;
  margin: number;
  lower: GradeKey;
  upper: GradeKey;
  center: GradeKey;
  tier: Tier; // tier of center
  kind: GradeKind;
  label: string;
}

const clamp = (val: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, val));

export function projectGrade(score: number, margin: number): GradeView {
  if (
    !Number.isFinite(score) ||
    score < 0 ||
    score >= 15 ||
    !Number.isFinite(margin) ||
    margin < 0
  ) {
    throw new RangeError('GRADE_INVALID_INPUT');
  }

  const a = clamp(Math.floor(score - margin), 0, 14);
  const b = clamp(Math.ceil(score + margin) - 1, 0, 14);
  const centerIdx = clamp(Math.floor(score), 0, 14);

  const lower = GRADES[a]!;
  const upper = GRADES[b]!;
  const center = GRADES[centerIdx]!;
  const tier = tierOf(centerIdx);

  const diff = b - a;
  const kind: GradeKind = diff === 0 ? 'exact' : diff === 1 ? 'straddle' : 'wide';

  let label: string;
  if (kind === 'exact') {
    label = lower;
  } else if (kind === 'straddle') {
    label = `${lower}/${upper}`;
  } else {
    label = `${lower}\u2013${upper}`;
  }

  return {
    score,
    margin,
    lower,
    upper,
    center,
    tier,
    kind,
    label,
  };
}
