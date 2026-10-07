import { describe, it, expect } from 'vitest';
import { detectOutliers, OUTLIER_MIN_DEVIATION, OUTLIER_MIN_ROBUST_Z, OUTLIER_EPSILON } from '../outliers';

/**
 * Deterministic permutation generator for shuffle tests (no Math.random)
 * Returns all permutations of an array
 */
function* allPermutations<T>(arr: readonly T[]): Generator<T[]> {
  if (arr.length <= 1) {
    yield [...arr];
    return;
  }
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of allPermutations(rest)) {
      yield [arr[i], ...perm];
    }
  }
}

describe('GR-01/02/03: Outlier Detection (detectOutliers)', () => {
  describe('GR-01: Lone outlier with n >= 3', () => {
    it('reproduces grading.md appendix C.3 exactly: v = 7.50, 7.83, 8.17, 11.00', () => {
      const values = [7.50, 7.83, 8.17, 11.00];
      const report = detectOutliers(values);

      // Check basic stats
      expect(report.median).toBeCloseTo(8.00, 3);
      expect(report.mad).toBeCloseTo(0.335, 3);
      expect(report.n).toBe(4);

      // Index 3 (11.00) should be the outlier
      const item3 = report.items[3];
      expect(item3.value).toBe(11.00);
      expect(item3.deviation).toBeCloseTo(3.00, 3);
      expect(item3.robustZ).toBeCloseTo(6.04, 2);
      expect(item3.candidate).toBe(true);
      expect(item3.excluded).toBe(true);

      // Non-outliers should have excluded = false
      for (let i = 0; i < 3; i++) {
        expect(report.items[i].excluded).toBe(false);
        expect(report.items[i].robustZ).not.toBeNull();
      }

      // Result
      expect(report.excludedIndexes).toEqual([3]);
      expect(report.maxExclusions).toBe(1);
    });

    it('GR-01: order-independence — all 24 permutations of 4 values give same excluded set', () => {
      const values = [7.50, 7.83, 8.17, 11.00];
      const reference = detectOutliers(values);
      const refExcludedSet = new Set(reference.excludedIndexes.map((idx) => values[idx]));

      // Test all 24 permutations
      let testCount = 0;
      for (const perm of allPermutations(values)) {
        const report = detectOutliers(perm);

        expect(report.median).toBeCloseTo(reference.median, 5);
        expect(report.mad).toBeCloseTo(reference.mad, 5);

        // Same values should be excluded (values set should match)
        const excludedValues = new Set(report.excludedIndexes.map((idx) => perm[idx]));
        expect(excludedValues).toEqual(refExcludedSet);

        testCount++;
      }
      expect(testCount).toBe(24); // Verify all permutations tested
    });
  });

  describe('GR-02: Outlier at exact boundary', () => {
    it('2.0 deviation exactly is NOT outlier; must have > 2.0', () => {
      // [7, 7, 7, 9.0] => M=7, MAD=0, dev=2.0 exactly => NOT outlier
      const values1 = [7, 7, 7, 9.0];
      const report1 = detectOutliers(values1);

      expect(report1.median).toBe(7);
      expect(report1.mad).toBe(0);
      expect(report1.items[3].deviation).toBe(2.0);
      expect(report1.items[3].candidate).toBe(false); // strict > 2.0, not >=
      expect(report1.excludedIndexes).toEqual([]);

      // [7, 7, 7, 9.01] => dev=2.01 > 2.0 => IS outlier
      const values2 = [7, 7, 7, 9.01];
      const report2 = detectOutliers(values2);

      expect(report2.items[3].deviation).toBeCloseTo(2.01, 10);
      expect(report2.items[3].candidate).toBe(true);
      expect(report2.excludedIndexes).toEqual([3]);
    });

    it('z-score boundary: actual z computation with MAD > 0', () => {
      // Construct a case where z is just below and just above 3.5
      // z = 0.6745 * (value - median) / MAD
      // We want: 0.6745 * dev / MAD = 3.5 exactly
      // => dev / MAD = 3.5 / 0.6745 = 5.1854...
      // Let's use MAD = 1, dev = 5.2 for z > 3.5
      // and dev = 5.1 for z < 3.5
      // But we also need dev > 2.0 for the first condition

      // Case: dev=5.2, MAD=1 => z=0.6745*5.2/1=3.5074 > 3.5, AND dev > 2 => outlier
      const values_above = [7.5, 7.5, 7.5, 7.5, 7.5, 12.7]; // median=7.5, dev of 12.7 is 5.2
      const report_above = detectOutliers(values_above);
      // After sorting: [7.5, 7.5, 7.5, 7.5, 7.5, 12.7]
      // Median = (7.5+7.5)/2 = 7.5, MAD = |7.5-7.5| = 0
      // This doesn't give us MAD > 0. Let me use a different fixture.

      // Better: [6.4, 7.5, 8.6, 12.7]
      // Sorted: [6.4, 7.5, 8.6, 12.7], M = (7.5+8.6)/2 = 8.05
      // deviations: 1.65, 0.55, 0.55, 4.65, MAD = 0.55
      // z for 12.7 = 0.6745 * 4.65 / 0.55 = 5.68 > 3.5, and dev=4.65 > 2.0 => outlier
      const values_z_high = [6.4, 7.5, 8.6, 12.7];
      const report_z_high = detectOutliers(values_z_high);
      const item_high = report_z_high.items.find((it) => it.value === 12.7)!;
      expect(item_high.robustZ).not.toBeNull();
      if (item_high.robustZ !== null) {
        expect(Math.abs(item_high.robustZ)).toBeGreaterThan(3.5 + OUTLIER_EPSILON);
      }
      expect(item_high.candidate).toBe(true);

      // Case: values just below z threshold
      // dev=5.0, MAD=1 => z=0.6745*5.0/1=3.3725 < 3.5, but dev > 2 and MAD > 0
      // Need: (value - M) = 5.0, MAD = 1
      // Try: [7, 7, 7, 7, 12] => M=7, MAD=0 (doesn't work)
      // Try: [5.5, 7.5, 9.5, 12.5] => M=8.5, deviations=[3,1,1,4], MAD=1
      // z for 12.5 = 0.6745*4/1 = 2.698 < 3.5, dev=4 > 2 => only MAD condition matters
      const values_z_low = [5.5, 7.5, 9.5, 12.5];
      const report_z_low = detectOutliers(values_z_low);
      const item_low = report_z_low.items.find((it) => it.value === 12.5)!;
      expect(item_low.robustZ).not.toBeNull();
      if (item_low.robustZ !== null) {
        expect(Math.abs(item_low.robustZ)).toBeLessThan(3.5 + OUTLIER_EPSILON);
      }
      expect(item_low.deviation).toBeGreaterThan(2.0); // Still > 2.0
      // If MAD > 0 and |z| <= 3.5, but dev > 2, both conditions required
      expect(item_low.candidate).toBe(false); // Because |z| <= 3.5
    });
  });

  describe('GR-03: 2/2 bipolar split and exclusion quota', () => {
    it('2/2 exact split [6.5, 6.5, 9.5, 9.5] excludes nobody (trivial MAD < 2)', () => {
      const values = [6.5, 6.5, 9.5, 9.5];
      const report = detectOutliers(values);

      expect(report.median).toBeCloseTo(8.0, 3);
      expect(report.mad).toBeCloseTo(1.5, 3);
      expect(report.excludedIndexes).toEqual([]);
    });

    it('large gap bipolar [4, 4, 10, 10] has dev=3 > 2 but MAD=3, z=0.67 → no outlier', () => {
      // M = 7, deviations = [3, 3, 3, 3], MAD = 3
      // z = 0.6745 * 3 / 3 = 0.6745 < 3.5, but dev = 3 > 2
      // Both conditions required: dev > 2 AND (MAD=0 OR |z| > 3.5) => false
      const values = [4, 4, 10, 10];
      const report = detectOutliers(values);

      expect(report.median).toBe(7);
      expect(report.mad).toBe(3);
      expect(report.excludedIndexes).toEqual([]);
    });

    it('exclusion quota: n=8 can exclude up to floor(8/4)=2', () => {
      const values = [7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 12.0, 2.0];
      const report = detectOutliers(values);

      expect(report.n).toBe(8);
      expect(report.maxExclusions).toBe(2);
      expect(report.excludedIndexes).toEqual([6, 7]);
    });

    it('exclusion quota: n=7 can exclude up to 1', () => {
      const values = [7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 12.0];
      const report = detectOutliers(values);

      expect(report.n).toBe(7);
      expect(report.maxExclusions).toBe(1);
      expect(report.excludedIndexes).toEqual([6]);
    });

    it('quota cap with ties: [7.5, 7.5, 7.5, 11.5, 3.0] → exclude [4] (index 2 skipped by later iteration)', () => {
      // Sorted: [3.0, 7.5, 7.5, 7.5, 11.5], M = 7.5
      // deviations: [4.5, 0, 0, 0, 4.0]
      // Both indices 0 and 4 are candidates (dev > 2)
      // MAD = 0, so z undefined, but dev > 2 alone is enough
      // Cap = 1 (n=5 < 8), so only the one with largest dev gets excluded
      // dev[0] = 4.5 > dev[4] = 4.0, so exclude index 0
      // But the original order: [7.5, 7.5, 7.5, 11.5, 3.0]
      // Sorted indices: input[4]=3.0 → pos 0, input[3]=11.5 → pos 4
      // excludedIndexes should be sorted indices in ascending order
      const values = [7.5, 7.5, 7.5, 11.5, 3.0];
      const report = detectOutliers(values);

      expect(report.n).toBe(5);
      expect(report.maxExclusions).toBe(1);
      // Sort: [3.0, 7.5, 7.5, 7.5, 11.5]
      // dev: [4.5, 0, 0, 0, 4.0] => candidates at indices 0,4
      // Sort by dev desc: index 0 (dev=4.5) first
      // Exclude index 0, which maps to input index 4
      // So excludedIndexes = [4]
      expect(report.excludedIndexes).toEqual([4]);
    });
  });

  describe('Golden fixtures from appendix C', () => {
    it('C.1: v = 7.50, 7.50, 7.83 → no outlier', () => {
      const values = [7.50, 7.50, 7.83];
      const report = detectOutliers(values);

      expect(report.median).toBeCloseTo(7.50, 3);
      expect(report.mad).toBe(0);
      expect(report.excludedIndexes).toEqual([]);
    });

    it('C.4: v = 6.50, 7.50, 9.50 → no outlier (max deviation 2.0 is not > 2.0)', () => {
      const values = [6.50, 7.50, 9.50];
      const report = detectOutliers(values);

      expect(report.median).toBeCloseTo(7.50, 3);
      expect(report.mad).toBeCloseTo(1.0, 3);
      expect(report.excludedIndexes).toEqual([]);
    });

    it('C.5: v = 7.50, 7.50, 11.50 → exclude index 2', () => {
      const values = [7.50, 7.50, 11.50];
      const report = detectOutliers(values);

      expect(report.median).toBeCloseTo(7.50, 3);
      expect(report.mad).toBe(0);
      expect(report.excludedIndexes).toEqual([2]);
    });
  });

  describe('Edge cases', () => {
    it('n < 3: no candidates (maxExclusions = 0)', () => {
      const values1 = [7.5];
      const report1 = detectOutliers(values1);
      expect(report1.maxExclusions).toBe(0);
      expect(report1.excludedIndexes).toEqual([]);

      const values2 = [7.5, 8.0];
      const report2 = detectOutliers(values2);
      expect(report2.maxExclusions).toBe(0);
      expect(report2.excludedIndexes).toEqual([]);
    });

    it('floating-point epsilon: 7.3, 9.3, 7.3 should not have 9.3 as outlier', () => {
      // In floating point: 9.3 - 7.3 = 2.000000000000001, which would wrongly pass > 2.0
      // OUTLIER_EPSILON should fix this
      const values = [7.3, 9.3, 7.3];
      const report = detectOutliers(values);

      // Should not exclude 9.3 because the deviation is effectively 2.0
      expect(report.excludedIndexes).toEqual([]);
    });

    it('empty array throws RangeError(GRADING_NO_SCORES)', () => {
      expect(() => detectOutliers([])).toThrow(RangeError);
    });

    it('NaN or Infinity throws RangeError(GRADING_INVALID_SCORE)', () => {
      expect(() => detectOutliers([7.5, NaN, 8.0])).toThrow(RangeError);
      expect(() => detectOutliers([7.5, Infinity, 8.0])).toThrow(RangeError);
      expect(() => detectOutliers([7.5, -Infinity, 8.0])).toThrow(RangeError);
    });

    it('does not mutate input array', () => {
      const values = [11.00, 7.50, 8.17, 7.83];
      const original = [...values];
      detectOutliers(values);
      expect(values).toEqual(original);
    });
  });
});
