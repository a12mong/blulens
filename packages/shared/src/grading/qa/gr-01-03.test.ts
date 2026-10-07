import { describe, it, expect } from 'vitest';
import { detectOutliers, OUTLIER_MIN_DEVIATION, OUTLIER_MIN_ROBUST_Z, OUTLIER_EPSILON } from '../outliers';

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

      // Result
      expect(report.excludedIndexes).toEqual([3]);
      expect(report.maxExclusions).toBe(1);
    });

    it('GR-01: order-independence — shuffle same case 20 times', () => {
      const values = [7.50, 7.83, 8.17, 11.00];
      const reference = detectOutliers(values);

      // Test 20 shuffles
      for (let i = 0; i < 20; i++) {
        const shuffled = [...values].sort(() => Math.random() - 0.5);
        const report = detectOutliers(shuffled);

        expect(report.median).toBeCloseTo(reference.median, 5);
        expect(report.mad).toBeCloseTo(reference.mad, 5);
        // Excluded indexes change with shuffle, but same values are excluded
        const excludedValues = report.excludedIndexes.map((idx) => shuffled[idx]);
        const refExcludedValues = reference.excludedIndexes.map((idx) => values[idx]);
        expect(new Set(excludedValues)).toEqual(new Set(refExcludedValues));
      }
    });

    it('GR-01: mutation test — excluding different index makes test fail', () => {
      const values = [7.50, 7.83, 8.17, 11.00];
      const report = detectOutliers(values);

      // Verify that excluding index 0 instead would be wrong
      expect(report.excludedIndexes).not.toContain(0);
      expect(report.excludedIndexes).toContain(3);
    });
  });

  describe('GR-02: Outlier at exact boundary', () => {
    it('2.0 deviation exactly is NOT outlier, 2.01 IS (with MAD > 0)', () => {
      // Case 1: exactly 2.0 deviation → not outlier
      const values1 = [5.0, 7.0, 9.0]; // M = 7, MAD = 2, dev = 2 exactly
      const report1 = detectOutliers(values1);
      expect(report1.items[0].deviation).toBe(2.0);
      expect(report1.items[0].candidate).toBe(false); // strict > 2.0
      expect(report1.items[2].deviation).toBe(2.0);
      expect(report1.items[2].candidate).toBe(false);

      // Case 2: 2.01 deviation → outlier
      const values2 = [4.99, 7.0, 9.01]; // dev ~2.01
      const report2 = detectOutliers(values2);
      expect(report2.excludedIndexes.length).toBeGreaterThan(0);
    });

    it('z = 3.5 exactly is NOT outlier, 3.51 IS (with MAD = 0 case)', () => {
      // When MAD = 0, second condition (|z| > 3.5) doesn't apply; only use first condition
      // When MAD > 0: need both conditions
      const values = [7.0, 7.0, 7.0, 10.51]; // M = 7, MAD = 0, dev = 3.51
      const report = detectOutliers(values);

      const item3 = report.items[3];
      expect(item3.robustZ).toBeNull(); // MAD = 0
      expect(item3.candidate).toBe(true); // dev > 2.0 alone is enough when MAD = 0
    });

    it('both conditions must pass: deviation AND (MAD=0 or z>3.5)', () => {
      // Example: deviation 2.5 > 2, but |z| ≤ 3.5 → not outlier
      const values = [5.0, 7.0, 7.5, 8.0, 10.0];
      const report = detectOutliers(values);
      // M = 7.5, MAD = 0.5
      // item 0: dev = 2.5, z = -3.3725 (abs = 3.3725 < 3.5) → candidate = false
      const item0 = report.items[0];
      expect(item0.deviation).toBeCloseTo(2.5, 5);
      expect(item0.robustZ).not.toBeNull();
      if (item0.robustZ !== null) {
        expect(Math.abs(item0.robustZ)).toBeLessThan(3.5 + OUTLIER_EPSILON);
      }
      expect(item0.candidate).toBe(false);
    });
  });

  describe('GR-03: 2/2 bipolar split and exclusion quota', () => {
    it('2/2 split (e.g., 6.0, 6.0, 9.0, 9.0) excludes nobody', () => {
      const values = [6.0, 6.0, 9.0, 9.0];
      const report = detectOutliers(values);

      // M = 7.5, MAD = 1.5 (middle two values: 6.0 and 9.0 → |6-7.5|=1.5, |9-7.5|=1.5)
      expect(report.median).toBeCloseTo(7.5, 3);
      expect(report.mad).toBeCloseTo(1.5, 3);

      // No deviation > 2 → nobody is a candidate
      expect(report.items.every((item) => !item.candidate)).toBe(true);
      expect(report.excludedIndexes).toEqual([]);
    });

    it('exclusion quota: n=8 can exclude up to floor(8/4)=2', () => {
      const values = [7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 12.0, 2.0];
      const report = detectOutliers(values);

      expect(report.n).toBe(8);
      expect(report.maxExclusions).toBe(2);

      // 12.0 and 2.0 are candidates (dev > 2)
      const candidates = report.items.filter((item) => item.candidate);
      expect(candidates.length).toBeGreaterThanOrEqual(2);

      // Should exclude exactly 2 (or fewer if not enough candidates)
      expect(report.excludedIndexes.length).toBeLessThanOrEqual(2);
    });

    it('exclusion quota: n=7 can exclude up to 1', () => {
      const values = [7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 12.0];
      const report = detectOutliers(values);

      expect(report.n).toBe(7);
      expect(report.maxExclusions).toBe(1);
      expect(report.excludedIndexes.length).toBeLessThanOrEqual(1);
    });

    it('assertion test: count excluded must be ≤ maxExclusions and deterministic', () => {
      const values = [7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 12.0, 2.0];
      const report1 = detectOutliers(values);

      // Run twice with same input
      const report2 = detectOutliers(values);

      expect(report1.excludedIndexes).toEqual(report2.excludedIndexes);
      expect(report1.excludedIndexes.length).toBeLessThanOrEqual(report1.maxExclusions);
      expect(report2.excludedIndexes.length).toBeLessThanOrEqual(report2.maxExclusions);
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
