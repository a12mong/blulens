import { detectOutliers, OUTLIER_EPSILON } from './outliers';
import { projectGrade, type GradeView } from './project-grade';

export type AggregateStatus = 'needs_reviewers' | 'provisional' | 'pending_approval' | 'disputed';
export type ResultFlag = 'SINGLE_REVIEWER' | 'PAIR_DISAGREEMENT' | 'OUTLIER_EXCLUDED' | 'HIGH_DISAGREEMENT' | 'LOW_RATER_COUNT';

export interface AggregateResult {
  status: AggregateStatus;
  score: number | null;
  margin: number | null;
  grade: GradeView | null;
  nRaters: number;
  nExcluded: number;
  excludedIndexes: number[];
  spread: number | null;
  flags: ResultFlag[];
  suggestThirdReviewer: boolean;
}

const T_TABLE: Record<number, number> = {
  1: 3.078,
  2: 1.886,
  3: 1.638,
  4: 1.533,
  5: 1.476,
  6: 1.44,
  7: 1.415,
  8: 1.397,
  9: 1.383,
  10: 1.372,
  11: 1.363,
  12: 1.356,
  13: 1.35,
  14: 1.345,
  15: 1.341,
  16: 1.337,
  17: 1.333,
  18: 1.33,
  19: 1.328,
  20: 1.325,
  21: 1.323,
  22: 1.321,
  23: 1.319,
  24: 1.318,
  25: 1.316,
  26: 1.315,
  27: 1.314,
  28: 1.313,
  29: 1.311,
};

const T_DEFAULT = 1.31;

function getTValue(df: number): number {
  return T_TABLE[df] ?? T_DEFAULT;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function computeMargin(K: readonly number[]): number {
  if (K.length < 2) return 0;
  const sorted = K.slice().sort((a, b) => a - b);
  const min = sorted[0]!;
  const max = sorted[sorted.length - 1]!;
  const range = max - min;

  if (K.length === 2) {
    return Math.max(0.5, range / 2 + 0.25);
  }

  // K.length >= 3: sample SD with t-distribution
  const mean = K.reduce((a, b) => a + b, 0) / K.length;
  const sumSquares = K.reduce((a, v) => a + (v - mean) ** 2, 0);
  const s = Math.sqrt(sumSquares / (K.length - 1));
  const df = K.length - 1;
  const t = getTValue(df);
  const m = clamp((t * s) / Math.sqrt(K.length), 0.25, 3.0);
  return m;
}

export function aggregateAssessment(scores: readonly number[], minReviewers: number): AggregateResult {
  // Validate inputs
  if (!Number.isInteger(minReviewers) || minReviewers < 1 || minReviewers > 5) {
    throw new RangeError('GRADING_INVALID_MIN_REVIEWERS');
  }

  // Validate scores
  for (const v of scores) {
    if (!Number.isFinite(v) || v < 0 || v >= 15) {
      throw new RangeError('GRADING_INVALID_SCORE');
    }
  }

  // Empty scores -> needs_reviewers
  if (scores.length === 0) {
    return {
      status: 'needs_reviewers',
      score: null,
      margin: null,
      grade: null,
      nRaters: 0,
      nExcluded: 0,
      excludedIndexes: [],
      spread: null,
      flags: [],
      suggestThirdReviewer: false,
    };
  }

  let K: number[] = Array.from(scores);
  let excludedIndexes: number[] = [];
  let hadOutlierExclusion = false;

  // Step 1: Outlier exclusion only if n >= 3
  if (scores.length >= 3) {
    const report = detectOutliers(scores);
    hadOutlierExclusion = report.excludedIndexes.length > 0;
    excludedIndexes = report.excludedIndexes;
    K = scores.filter((_v, i) => !report.excludedIndexes.includes(i));
  }

  // Step 2: Check if |K| < minReviewers -> needs_reviewers
  if (K.length < minReviewers) {
    const flags: ResultFlag[] = [];
    if (hadOutlierExclusion) {
      flags.push('OUTLIER_EXCLUDED');
    }
    flags.sort();

    return {
      status: 'needs_reviewers',
      score: null,
      margin: null,
      grade: null,
      nRaters: K.length,
      nExcluded: excludedIndexes.length,
      excludedIndexes,
      spread: null,
      flags,
      suggestThirdReviewer: false,
    };
  }

  // Step 3: Route by |K|
  const flags: ResultFlag[] = [];
  if (hadOutlierExclusion) {
    flags.push('OUTLIER_EXCLUDED');
  }

  let status: AggregateStatus;
  let score: number;
  let margin: number;
  let spread: number | null = null;
  let suggestThirdReviewer = false;

  if (K.length === 1) {
    // Provisional
    score = K[0]!;
    margin = 1.0;
    status = 'provisional';
    flags.push('SINGLE_REVIEWER');
  } else if (K.length === 2) {
    // Pair rule
    score = (K[0]! + K[1]!) / 2;
    const a = K[0]!;
    const b = K[1]!;
    const gap = Math.abs(a - b);
    spread = gap;
    margin = Math.max(0.5, gap / 2 + 0.25);

    if (gap > 2.0 + OUTLIER_EPSILON) {
      status = 'disputed';
      flags.push('PAIR_DISAGREEMENT');
      suggestThirdReviewer = true;
    } else {
      status = 'pending_approval';
    }
  } else {
    // K.length >= 3: v1 rule
    score = K.reduce((a, b) => a + b, 0) / K.length;
    const sorted = K.slice().sort((a, b) => a - b);
    const min = sorted[0]!;
    const max = sorted[sorted.length - 1]!;
    spread = max - min;

    margin = computeMargin(K);

    if (spread > 3.0 + OUTLIER_EPSILON || margin > 1.5 + OUTLIER_EPSILON) {
      status = 'disputed';
      flags.push('HIGH_DISAGREEMENT');
    } else {
      status = 'pending_approval';
    }

    if (K.length === minReviewers) {
      flags.push('LOW_RATER_COUNT');
    }
  }

  flags.sort();
  const grade = projectGrade(score, margin);

  return {
    status,
    score,
    margin,
    grade,
    nRaters: K.length,
    nExcluded: excludedIndexes.length,
    excludedIndexes,
    spread,
    flags,
    suggestThirdReviewer,
  };
}
