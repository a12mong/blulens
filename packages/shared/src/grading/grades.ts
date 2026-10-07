export const GRADES = [
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
export type GradeKey = (typeof GRADES)[number];

export const TIERS = ['Rookie', 'Beginner', 'Standard', 'Neutral', 'Professional'] as const;
export type Tier = (typeof TIERS)[number];

export function gradeIndex(key: GradeKey): number {
  const index = (GRADES as readonly string[]).indexOf(key);
  if (index === -1) {
    throw new RangeError('GRADE_UNKNOWN_KEY');
  }
  return index;
}

export function tierOf(index: number): Tier {
  if (!Number.isInteger(index) || index < 0 || index > 14) {
    throw new RangeError('GRADE_INVALID_INDEX');
  }
  return TIERS[Math.floor(index / 3)]!;
}
