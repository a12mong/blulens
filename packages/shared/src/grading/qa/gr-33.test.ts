import { describe, it, expect } from 'vitest';
import { calibrationStats } from '../calibration-stats';

describe('GR-33: calibrationStats', () => {
  describe('Basic structure', () => {
    it('returns { n, bias, meanAbsError }', () => {
      const items = [
        { overall: 7.5, referenceIndex: 7 },
      ];
      const result = calibrationStats(items);
      expect(result).toHaveProperty('n');
      expect(result).toHaveProperty('bias');
      expect(result).toHaveProperty('meanAbsError');
      expect(result.n).toBe(1);
    });
  });

  describe('Empty array', () => {
    it('[] → n=0, bias=null, meanAbsError=null', () => {
      const result = calibrationStats([]);
      expect(result.n).toBe(0);
      expect(result.bias).toBeNull();
      expect(result.meanAbsError).toBeNull();
    });
  });

  describe('Reference centre convention: referenceIndex + 0.5', () => {
    it('referenceIndex=7 means reference centre = 7.5 (S)', () => {
      // If overall=7.5 and referenceIndex=7 (centre 7.5)
      // bias = 7.5 - 7.5 = 0
      const items = [{ overall: 7.5, referenceIndex: 7 }];
      const result = calibrationStats(items);
      expect(result.n).toBe(1);
      expect(result.bias).toBeCloseTo(0, 2);
      expect(result.meanAbsError).toBeCloseTo(0, 2);
    });

    it('bias: rater overestimates (higher overall than reference)', () => {
      // referenceIndex=7 (centre 7.5), overall=8.5
      // bias = 8.5 - 7.5 = 1.0
      const items = [
        { overall: 8.5, referenceIndex: 7 },
        { overall: 8.0, referenceIndex: 7 },
        { overall: 8.0, referenceIndex: 7 },
      ];
      const result = calibrationStats(items);
      expect(result.n).toBe(3);
      expect(result.bias).toBeCloseTo((8.5 - 7.5 + 8.0 - 7.5 + 8.0 - 7.5) / 3, 2);
      expect(result.bias).toBeGreaterThan(0);
    });

    it('bias: rater underestimates (lower overall than reference)', () => {
      // referenceIndex=8 (centre 8.5), overall=7.5
      // bias = 7.5 - 8.5 = -1.0
      const items = [
        { overall: 7.5, referenceIndex: 8 },
        { overall: 7.0, referenceIndex: 8 },
      ];
      const result = calibrationStats(items);
      expect(result.n).toBe(2);
      expect(result.bias).toBeLessThan(0);
    });
  });

  describe('Hand-computed examples', () => {
    it('two items: compute bias and meanAbsError exactly', () => {
      // Item 1: overall=7.0, referenceIndex=7 (centre 7.5) → bias = 7.0 - 7.5 = -0.5, absError = 0.5
      // Item 2: overall=8.0, referenceIndex=7 (centre 7.5) → bias = 8.0 - 7.5 = +0.5, absError = 0.5
      // bias = (-0.5 + 0.5) / 2 = 0
      // meanAbsError = (0.5 + 0.5) / 2 = 0.5
      const items = [
        { overall: 7.0, referenceIndex: 7 },
        { overall: 8.0, referenceIndex: 7 },
      ];
      const result = calibrationStats(items);
      expect(result.n).toBe(2);
      expect(result.bias).toBeCloseTo(0, 2);
      expect(result.meanAbsError).toBeCloseTo(0.5, 2);
    });

    it('three items with consistent over-estimation', () => {
      // All overestimate by 0.5 (reference 7.5, overall 8.0 each time)
      // bias = (8.0-7.5 + 8.0-7.5 + 8.0-7.5) / 3 = 1.5 / 3 = 0.5
      // meanAbsError = (0.5 + 0.5 + 0.5) / 3 = 0.5
      const items = [
        { overall: 8.0, referenceIndex: 7 },
        { overall: 8.0, referenceIndex: 7 },
        { overall: 8.0, referenceIndex: 7 },
      ];
      const result = calibrationStats(items);
      expect(result.n).toBe(3);
      expect(result.bias).toBeCloseTo(0.5, 2);
      expect(result.meanAbsError).toBeCloseTo(0.5, 2);
    });

    it('variable bias (positive and negative)', () => {
      // Item 1: +1.0 bias
      // Item 2: -1.0 bias
      // Item 3: 0 bias
      // bias = (1.0 - 1.0 + 0) / 3 = 0
      // meanAbsError = (1.0 + 1.0 + 0) / 3 = 0.667
      const items = [
        { overall: 8.5, referenceIndex: 7 }, // +1.0
        { overall: 6.5, referenceIndex: 7 }, // -1.0
        { overall: 7.5, referenceIndex: 7 }, // 0
      ];
      const result = calibrationStats(items);
      expect(result.n).toBe(3);
      expect(result.bias).toBeCloseTo(0, 2);
      expect(result.meanAbsError).toBeCloseTo(2 / 3, 2);
    });
  });

  describe('Calibration dataset sizes', () => {
    it('calibration set 5 items (typical size)', () => {
      const items = [
        { overall: 7.5, referenceIndex: 7 },
        { overall: 8.0, referenceIndex: 7 },
        { overall: 7.0, referenceIndex: 7 },
        { overall: 9.0, referenceIndex: 8 },
        { overall: 8.5, referenceIndex: 8 },
      ];
      const result = calibrationStats(items);
      expect(result.n).toBe(5);
      expect(typeof result.bias === 'number').toBe(true);
      expect(typeof result.meanAbsError === 'number').toBe(true);
    });

    it('calibration set 10 items', () => {
      const items = Array.from({ length: 10 }, (_, i) => ({
        overall: 7.0 + i * 0.5,
        referenceIndex: 7,
      }));
      const result = calibrationStats(items);
      expect(result.n).toBe(10);
      expect(typeof result.bias === 'number').toBe(true);
      expect(typeof result.meanAbsError === 'number').toBe(true);
    });
  });

  describe('Property: meanAbsError >= |bias|', () => {
    it('meanAbsError cannot be smaller than absolute bias', () => {
      const testCases = [
        [
          { overall: 8.5, referenceIndex: 7 },
          { overall: 8.0, referenceIndex: 7 },
        ],
        [
          { overall: 6.5, referenceIndex: 8 },
          { overall: 7.0, referenceIndex: 8 },
        ],
        [
          { overall: 7.5, referenceIndex: 7 },
          { overall: 8.5, referenceIndex: 7 },
          { overall: 6.5, referenceIndex: 7 },
        ],
      ];

      testCases.forEach(items => {
        const result = calibrationStats(items);
        if (result.bias !== null && result.meanAbsError !== null) {
          expect(result.meanAbsError).toBeGreaterThanOrEqual(Math.abs(result.bias));
        }
      });
    });
  });

  describe('Invalid inputs throw CALIBRATION_INVALID_ITEM', () => {
    it('item missing overall throws RangeError', () => {
      const items = [
        { referenceIndex: 7 } as any,
      ];
      expect(() => calibrationStats(items)).toThrow(RangeError);
    });

    it('item missing referenceIndex throws RangeError', () => {
      const items = [
        { overall: 7.5 } as any,
      ];
      expect(() => calibrationStats(items)).toThrow(RangeError);
    });

    it('overall = NaN throws RangeError', () => {
      const items = [
        { overall: NaN, referenceIndex: 7 },
      ];
      expect(() => calibrationStats(items)).toThrow(RangeError);
    });

    it('overall = Infinity throws RangeError', () => {
      const items = [
        { overall: Infinity, referenceIndex: 7 },
      ];
      expect(() => calibrationStats(items)).toThrow(RangeError);
    });

    it('referenceIndex < 0 throws RangeError', () => {
      const items = [
        { overall: 7.5, referenceIndex: -1 },
      ];
      expect(() => calibrationStats(items)).toThrow(RangeError);
    });

    it('referenceIndex > 14 throws RangeError', () => {
      const items = [
        { overall: 7.5, referenceIndex: 15 },
      ];
      expect(() => calibrationStats(items)).toThrow(RangeError);
    });

    it('referenceIndex not integer throws RangeError', () => {
      const items = [
        { overall: 7.5, referenceIndex: 7.5 },
      ];
      expect(() => calibrationStats(items)).toThrow(RangeError);
    });
  });

  describe('Determinism', () => {
    it('same input gives same output', () => {
      const items = [
        { overall: 7.5, referenceIndex: 7 },
        { overall: 8.0, referenceIndex: 7 },
        { overall: 8.5, referenceIndex: 8 },
      ];
      const r1 = calibrationStats(items);
      const r2 = calibrationStats(items);
      expect(r1.n).toBe(r2.n);
      expect(r1.bias).toBe(r2.bias);
      expect(r1.meanAbsError).toBe(r2.meanAbsError);
    });

    it('order-independence: different order gives same statistics', () => {
      const items1 = [
        { overall: 7.5, referenceIndex: 7 },
        { overall: 8.0, referenceIndex: 8 },
        { overall: 9.0, referenceIndex: 9 },
      ];
      const items2 = [
        { overall: 9.0, referenceIndex: 9 },
        { overall: 7.5, referenceIndex: 7 },
        { overall: 8.0, referenceIndex: 8 },
      ];
      const r1 = calibrationStats(items1);
      const r2 = calibrationStats(items2);
      expect(r1.n).toBe(r2.n);
      expect(r1.bias).toBeCloseTo(r2.bias || 0, 10);
      expect(r1.meanAbsError).toBeCloseTo(r2.meanAbsError || 0, 10);
    });
  });

  describe('Edge case: single item', () => {
    it('n=1: bias = overall - (referenceIndex + 0.5)', () => {
      const items = [{ overall: 8.0, referenceIndex: 7 }];
      const result = calibrationStats(items);
      expect(result.n).toBe(1);
      expect(result.bias).toBeCloseTo(8.0 - 7.5, 2);
      expect(result.meanAbsError).toBeCloseTo(Math.abs(8.0 - 7.5), 2);
    });

    it('n=1: zero bias when perfect', () => {
      const items = [{ overall: 7.5, referenceIndex: 7 }];
      const result = calibrationStats(items);
      expect(result.bias).toBeCloseTo(0, 2);
      expect(result.meanAbsError).toBeCloseTo(0, 2);
    });
  });

  describe('Grade range boundary', () => {
    it('referenceIndex=0 (RK1) centre = 0.5', () => {
      const items = [{ overall: 1.0, referenceIndex: 0 }];
      const result = calibrationStats(items);
      expect(result.bias).toBeCloseTo(1.0 - 0.5, 2);
    });

    it('referenceIndex=14 (P+) centre = 14.5', () => {
      const items = [{ overall: 14.0, referenceIndex: 14 }];
      const result = calibrationStats(items);
      expect(result.bias).toBeCloseTo(14.0 - 14.5, 2);
    });
  });
});
