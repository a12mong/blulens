import { describe, it, expect } from 'vitest';
import { calibrationStats } from '../calibration';

describe('GR-33: calibrationStats (bias, meanAbsError with reference centre = referenceIndex + 0.5)', () => {
  describe('Structure and basic', () => {
    it('returns {n, bias, meanAbsError}', () => {
      const result = calibrationStats([{ overall: 7.5, referenceIndex: 7 }]);
      expect(result.n).toBe(1);
      expect(typeof result.bias === 'number' || result.bias === null).toBe(true);
      expect(typeof result.meanAbsError === 'number' || result.meanAbsError === null).toBe(true);
    });

    it('empty array → n=0, bias=null, meanAbsError=null', () => {
      const result = calibrationStats([]);
      expect(result.n).toBe(0);
      expect(result.bias).toBeNull();
      expect(result.meanAbsError).toBeNull();
    });
  });

  describe('Reference centre convention: referenceIndex + 0.5', () => {
    it('referenceIndex 7 centre 7.5: overall 7.5 → bias 0, MAE 0', () => {
      const result = calibrationStats([{ overall: 7.5, referenceIndex: 7 }]);
      expect(result.n).toBe(1);
      expect(result.bias).toBeCloseTo(0, 2);
      expect(result.meanAbsError).toBeCloseTo(0, 2);
    });

    it('referenceIndex 7 centre 7.5: overall 8.0 → bias +0.5, MAE 0.5', () => {
      const result = calibrationStats([{ overall: 8.0, referenceIndex: 7 }]);
      expect(result.bias).toBeCloseTo(0.5, 2);
      expect(result.meanAbsError).toBeCloseTo(0.5, 2);
    });

    it('referenceIndex 7 centre 7.5: overall 7.0 → bias -0.5, MAE 0.5', () => {
      const result = calibrationStats([{ overall: 7.0, referenceIndex: 7 }]);
      expect(result.bias).toBeCloseTo(-0.5, 2);
      expect(result.meanAbsError).toBeCloseTo(0.5, 2);
    });
  });

  describe('Hand-computed examples', () => {
    it('two items: overall [7.0, 8.0] vs centre 7.5 → bias 0, MAE 0.5', () => {
      const result = calibrationStats([
        { overall: 7.0, referenceIndex: 7 },
        { overall: 8.0, referenceIndex: 7 },
      ]);
      expect(result.n).toBe(2);
      expect(result.bias).toBeCloseTo(0, 2);
      expect(result.meanAbsError).toBeCloseTo(0.5, 2);
    });

    it('three items: all +0.5 → bias +0.5, MAE 0.5', () => {
      const result = calibrationStats([
        { overall: 8.0, referenceIndex: 7 },
        { overall: 8.0, referenceIndex: 7 },
        { overall: 8.0, referenceIndex: 7 },
      ]);
      expect(result.n).toBe(3);
      expect(result.bias).toBeCloseTo(0.5, 2);
      expect(result.meanAbsError).toBeCloseTo(0.5, 2);
    });

    it('three items: +1.0, -1.0, 0 → bias 0, MAE 0.667', () => {
      const result = calibrationStats([
        { overall: 8.5, referenceIndex: 7 },
        { overall: 6.5, referenceIndex: 7 },
        { overall: 7.5, referenceIndex: 7 },
      ]);
      expect(result.n).toBe(3);
      expect(result.bias).toBeCloseTo(0, 2);
      expect(result.meanAbsError).toBeCloseTo(2/3, 2);
    });
  });

  describe('Invariant: meanAbsError ≥ |bias|', () => {
    it('always holds across examples', () => {
      const tests = [
        [{ overall: 8.5, referenceIndex: 7 }, { overall: 8.0, referenceIndex: 7 }],
        [{ overall: 6.5, referenceIndex: 8 }, { overall: 7.0, referenceIndex: 8 }],
      ];
      tests.forEach(items => {
        const r = calibrationStats(items);
        if (r.bias !== null && r.meanAbsError !== null) {
          expect(r.meanAbsError).toBeGreaterThanOrEqual(Math.abs(r.bias));
        }
      });
    });
  });

  describe('Error handling → CALIBRATION_INVALID_ITEM', () => {
    it('overall NaN', () => expect(() => calibrationStats([{ overall: NaN, referenceIndex: 7 }])).toThrow(RangeError));
    it('overall Infinity', () => expect(() => calibrationStats([{ overall: Infinity, referenceIndex: 7 }])).toThrow(RangeError));
    it('overall < 0', () => expect(() => calibrationStats([{ overall: -0.1, referenceIndex: 7 }])).toThrow(RangeError));
    it('overall >= 15', () => expect(() => calibrationStats([{ overall: 15, referenceIndex: 7 }])).toThrow(RangeError));
    it('referenceIndex < 0', () => expect(() => calibrationStats([{ overall: 7.5, referenceIndex: -1 }])).toThrow(RangeError));
    it('referenceIndex > 14', () => expect(() => calibrationStats([{ overall: 7.5, referenceIndex: 15 }])).toThrow(RangeError));
    it('referenceIndex non-integer', () => expect(() => calibrationStats([{ overall: 7.5, referenceIndex: 7.5 }])).toThrow(RangeError));
  });

  describe('Determinism & order-independence', () => {
    it('same input same output', () => {
      const items = [{ overall: 7.5, referenceIndex: 7 }, { overall: 8.0, referenceIndex: 8 }];
      const r1 = calibrationStats(items);
      const r2 = calibrationStats(items);
      expect(r1).toEqual(r2);
    });

    it('different order same result', () => {
      const items1 = [
        { overall: 7.5, referenceIndex: 7 },
        { overall: 8.0, referenceIndex: 8 },
      ];
      const items2 = [
        { overall: 8.0, referenceIndex: 8 },
        { overall: 7.5, referenceIndex: 7 },
      ];
      const r1 = calibrationStats(items1);
      const r2 = calibrationStats(items2);
      expect(r1.n).toBe(r2.n);
      if (r1.bias !== null && r2.bias !== null) {
        expect(r1.bias).toBeCloseTo(r2.bias, 10);
      }
      if (r1.meanAbsError !== null && r2.meanAbsError !== null) {
        expect(r1.meanAbsError).toBeCloseTo(r2.meanAbsError, 10);
      }
    });
  });

  describe('Grade range boundaries', () => {
    it('referenceIndex 0 (RK1): centre 0.5', () => {
      const result = calibrationStats([{ overall: 1.0, referenceIndex: 0 }]);
      expect(result.bias).toBeCloseTo(1.0 - 0.5, 2);
    });

    it('referenceIndex 14 (P+): centre 14.5', () => {
      const result = calibrationStats([{ overall: 14.0, referenceIndex: 14 }]);
      expect(result.bias).toBeCloseTo(14.0 - 14.5, 2);
    });
  });

  describe('Larger calibration set (5 items)', () => {
    it('diverse raters and references', () => {
      const result = calibrationStats([
        { overall: 7.5, referenceIndex: 7 },
        { overall: 8.0, referenceIndex: 7 },
        { overall: 7.0, referenceIndex: 7 },
        { overall: 9.0, referenceIndex: 8 },
        { overall: 8.5, referenceIndex: 8 },
      ]);
      expect(result.n).toBe(5);
      expect(typeof result.bias === 'number').toBe(true);
      expect(typeof result.meanAbsError === 'number').toBe(true);
      expect(result.meanAbsError).toBeGreaterThanOrEqual(Math.abs(result.bias));
    });
  });
});
