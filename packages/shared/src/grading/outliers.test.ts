import { describe, expect, it } from 'vitest';
import {
  OUTLIER_EPSILON,
  OUTLIER_MIN_DEVIATION,
  OUTLIER_MIN_ROBUST_Z,
  detectOutliers,
} from './outliers';

describe('detectOutliers', () => {
  it('reproduces grading.md appendix C outlier decisions exactly', () => {
    // C.1: v = 7.50, 7.50, 7.83 -> M 7.50, MAD 0, no outlier
    const c1 = detectOutliers([7.5, 7.5, 7.83]);
    expect(c1.median).toBeCloseTo(7.5, 3);
    expect(c1.mad).toBeCloseTo(0, 3);
    expect(c1.excludedIndexes).toEqual([]);

    // C.3: v = 7.50, 7.83, 8.17, 11.00 -> M 8.00, MAD 0.335, z(11.00) = 6.04 -> exclude index 3
    const c3 = detectOutliers([7.5, 7.83, 8.17, 11.0]);
    expect(c3.median).toBeCloseTo(8.0, 3);
    expect(c3.mad).toBeCloseTo(0.335, 3);
    expect(c3.items[3]!.robustZ).toBeCloseTo(6.04, 2);
    expect(c3.excludedIndexes).toEqual([3]);

    // C.4: v = 6.50, 7.50, 9.50 -> M 7.50, MAD 1, no outlier (max deviation 2.0 is not > 2.0)
    const c4 = detectOutliers([6.5, 7.5, 9.5]);
    expect(c4.median).toBeCloseTo(7.5, 3);
    expect(c4.mad).toBeCloseTo(1.0, 3);
    expect(c4.excludedIndexes).toEqual([]);

    // C.5: v = 7.50, 7.50, 11.50 -> M 7.50, MAD 0, exclude index 2
    const c5 = detectOutliers([7.5, 7.5, 11.5]);
    expect(c5.median).toBeCloseTo(7.5, 3);
    expect(c5.mad).toBeCloseTo(0, 3);
    expect(c5.excludedIndexes).toEqual([2]);
  });

  it('handles edge cases from specification', () => {
    // [5.0, 7.0, 7.5, 8.0, 10.0] -> M 7.5, MAD 0.5, robustZ(5.0) = -3.3725: deviation 2.5 > 2 but |z| <= 3.5 -> nothing excluded
    const r1 = detectOutliers([5.0, 7.0, 7.5, 8.0, 10.0]);
    expect(r1.median).toBeCloseTo(7.5, 3);
    expect(r1.mad).toBeCloseTo(0.5, 3);
    expect(r1.items[0]!.robustZ).toBeCloseTo(-3.3725, 4);
    expect(r1.excludedIndexes).toEqual([]);

    // [7.5, 7.5, 7.5, 11.5, 3.0] -> MAD 0, candidates indexes 3 and 4, cap 1 -> excludedIndexes [4] (deviation 4.5 > 4.0)
    const r2 = detectOutliers([7.5, 7.5, 7.5, 11.5, 3.0]);
    expect(r2.mad).toBe(0);
    expect(r2.maxExclusions).toBe(1);
    expect(r2.items[3]!.candidate).toBe(true);
    expect(r2.items[4]!.candidate).toBe(true);
    expect(r2.excludedIndexes).toEqual([4]);

    // [7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 12.0, 2.0] (n = 8, cap 2) -> excludedIndexes [6, 7]
    const r3 = detectOutliers([7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 12.0, 2.0]);
    expect(r3.n).toBe(8);
    expect(r3.maxExclusions).toBe(2);
    expect(r3.excludedIndexes).toEqual([6, 7]);

    // [6.5, 6.5, 9.5, 9.5] (bipolar) -> nothing excluded
    const r4 = detectOutliers([6.5, 6.5, 9.5, 9.5]);
    expect(r4.excludedIndexes).toEqual([]);

    // [7.3, 9.3, 7.3] -> nothing excluded (float tolerance handles 9.3 - 7.3 = 2.000000000000001)
    const r5 = detectOutliers([7.3, 9.3, 7.3]);
    expect(r5.excludedIndexes).toEqual([]);

    // [7.5, 11.5] (n = 2) -> no candidates, maxExclusions 0
    const r6 = detectOutliers([7.5, 11.5]);
    expect(r6.n).toBe(2);
    expect(r6.maxExclusions).toBe(0);
    expect(r6.items.every((item) => !item.candidate)).toBe(true);
    expect(r6.excludedIndexes).toEqual([]);
  });

  it('validates errors and does not mutate input', () => {
    expect(() => detectOutliers([])).toThrow(RangeError);
    expect(() => detectOutliers([])).toThrow('GRADING_NO_SCORES');

    expect(() => detectOutliers([NaN, 1, 2])).toThrow(RangeError);
    expect(() => detectOutliers([NaN, 1, 2])).toThrow('GRADING_INVALID_SCORE');
    expect(() => detectOutliers([Infinity, 1, 2])).toThrow('GRADING_INVALID_SCORE');

    const input = Object.freeze([7.5, 11.0, 7.83, 8.17]);
    const res = detectOutliers(input);
    expect(res.excludedIndexes).toEqual([1]);
  });

  it('exports required constants', () => {
    expect(OUTLIER_MIN_DEVIATION).toBe(2.0);
    expect(OUTLIER_MIN_ROBUST_Z).toBe(3.5);
    expect(OUTLIER_EPSILON).toBe(1e-9);
  });
});
