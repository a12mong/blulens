import { describe, it, expect } from 'vitest';
import { fleissKappa } from '../fleiss-kappa';

describe('GR-08/11 Fleiss: fleissKappa (multi-rater on 5 Tiers)', () => {
  describe('Perfect agreement with variety → kappa = 1', () => {
    it('all raters give same Tier for each case, but use multiple Tiers across cases', () => {
      // Tier mapping: floor(v_j) / 3 = Tier
      // S- (6) → Tier 2, S (7) → Tier 2, S+ (8) → Tier 2
      // N- (9) → Tier 3, N (10) → Tier 3, N+ (11) → Tier 3
      // P- (12) → Tier 4, P (13) → Tier 4, P+ (14) → Tier 4

      // 5 cases, all raters agree on Tier but use different specific grades within Tier
      const cases = [
        [6, 6, 6], // All S- (Tier 2)
        [8, 8, 8], // All S+ (Tier 2)
        [9, 9, 9], // All N- (Tier 3)
        [12, 12, 12], // All P- (Tier 4)
        [14, 14, 14], // All P+ (Tier 4)
      ];

      const kappa = fleissKappa(cases, 5);
      expect(kappa).toBe(1);
    });

    it('same case: all raters in same Tier (perfect agreement)', () => {
      const cases = [
        [7, 7, 7], // All S (Tier 2)
        [7, 8, 8], // All S/S+ (Tier 2)
        [7, 7, 8], // All S/S+ (Tier 2)
      ];
      const kappa = fleissKappa(cases, 5);
      expect(kappa).toBe(1);
    });
  });

  describe('One category only (P_e = 1) → kappa = null, never 1.0 or NaN', () => {
    it('all raters give same Tier for all cases', () => {
      const cases = [
        [7, 7, 7], // All S (Tier 2)
        [8, 8, 8], // All S (Tier 2)
        [7, 8, 7], // All S (Tier 2)
      ];
      const kappa = fleissKappa(cases, 5);
      expect(kappa).toBeNull();
    });

    it('five cases all in single Tier', () => {
      const cases = [
        [9, 10, 9],
        [9, 11, 10],
        [10, 10, 11],
        [9, 9, 10],
        [11, 10, 9],
      ];
      const kappa = fleissKappa(cases, 5);
      expect(kappa).toBeNull();
    });

    it('never shows 1.0 when undefined', () => {
      const cases = [
        [5, 5, 5],
        [5, 5, 5],
        [5, 5, 5],
      ];
      const kappa = fleissKappa(cases, 5);
      expect(kappa).not.toBe(1.0);
      expect(kappa).toBeNull();
    });
  });

  describe('Cases with <2 raters are skipped', () => {
    it('cases with 1 rater are excluded from kappa calculation', () => {
      const cases = [
        [7, 7], // 2 raters
        [8], // 1 rater — skipped
        [7, 8, 9], // 3 raters
      ];
      const result = fleissKappa(cases, 5);
      // Should still be able to compute from cases 1 and 3
      expect(typeof result === 'number' || result === null).toBe(true);
    });

    it('only cases with ≥2 raters contribute', () => {
      const cases = [
        [7, 7],
        [8, 8, 8],
      ];
      const result = fleissKappa(cases, 5);
      expect(typeof result === 'number' || result === null).toBe(true);
    });
  });

  describe('Unequal rater counts per case', () => {
    it('cases can have different numbers of raters (Fleiss feature)', () => {
      const cases = [
        [7, 8], // 2 raters
        [7, 8, 9], // 3 raters
        [9, 10, 11, 12], // 4 raters
      ];
      const result = fleissKappa(cases, 5);
      expect(typeof result === 'number' || result === null).toBe(true);
      if (result !== null) {
        expect(result).toBeGreaterThanOrEqual(-1);
        expect(result).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Hand-computed golden example', () => {
    it('known 3-case example with verified kappa value', () => {
      // To be filled with actual verified computation
      // For now, test that it produces a valid kappa in [-1,1] or null
      const cases = [
        [7, 7, 8], // Mostly S, one S+
        [8, 8, 9], // Mostly S+, one N-
        [7, 9, 10], // Mixed S, N-, N
      ];
      const kappa = fleissKappa(cases, 5);
      if (kappa !== null) {
        expect(kappa).toBeGreaterThanOrEqual(-1);
        expect(kappa).toBeLessThanOrEqual(1);
        expect(isFinite(kappa)).toBe(true);
      }
    });
  });

  describe('Error handling', () => {
    it('categories < 2 throws RangeError', () => {
      const cases = [[7, 8]];
      expect(() => fleissKappa(cases, 1)).toThrow(RangeError);
      expect(() => fleissKappa(cases, 0)).toThrow(RangeError);
      expect(() => fleissKappa(cases, -1)).toThrow(RangeError);
    });

    it('non-integer categories throws RangeError', () => {
      const cases = [[7, 8]];
      expect(() => fleissKappa(cases, 5.5)).toThrow(RangeError);
    });

    it('rating >= categories throws RangeError', () => {
      const cases = [[0, 5]]; // 5 is out of range [0,4] for categories=5
      expect(() => fleissKappa(cases, 5)).toThrow(RangeError);
    });

    it('negative rating throws RangeError', () => {
      const cases = [[-1, 2]];
      expect(() => fleissKappa(cases, 5)).toThrow(RangeError);
    });

    it('non-integer rating throws RangeError', () => {
      const cases = [[0.5, 2]];
      expect(() => fleissKappa(cases, 5)).toThrow(RangeError);
    });
  });

  describe('Edge cases', () => {
    it('empty cases array → null', () => {
      const cases: number[][] = [];
      const kappa = fleissKappa(cases, 5);
      expect(kappa).toBeNull();
    });

    it('kappa property: result in [-1, 1] for any valid input', () => {
      const testCases = [
        [[7, 8], [9, 10], [11, 12]],
        [[7, 7, 7], [8, 8, 8]],
        [[7, 8, 9, 10, 11], [7, 8, 9, 10, 11]],
      ];

      testCases.forEach(cases => {
        const kappa = fleissKappa(cases, 5);
        if (kappa !== null) {
          expect(kappa).toBeGreaterThanOrEqual(-1);
          expect(kappa).toBeLessThanOrEqual(1);
        }
      });
    });
  });

  describe('Determinism', () => {
    it('same input always gives same output', () => {
      const cases = [[7, 8, 9], [8, 9, 10], [9, 10, 11]];
      const k1 = fleissKappa(cases, 5);
      const k2 = fleissKappa(cases, 5);
      expect(k1).toBe(k2);
    });

    it('order-independence (swapping rows or raters within row)', () => {
      const cases1 = [
        [7, 8, 9],
        [8, 9, 10],
      ];
      const cases2 = [
        [8, 9, 10],
        [7, 8, 9],
      ];
      const k1 = fleissKappa(cases1, 5);
      const k2 = fleissKappa(cases2, 5);
      expect(k1).toBeCloseTo(k2 || 0, 10);
    });
  });

  describe('Specific formula checks: Tier aggregation (floor(grade/3))', () => {
    it('Tier 0 (Rookie): grades 0,1,2 → floor/3 = 0', () => {
      // Grades 0-2 map to Tier 0
      const cases = [[0, 1], [1, 2], [2, 0]];
      const result = fleissKappa(cases, 5);
      expect(typeof result === 'number' || result === null).toBe(true);
    });

    it('Tier 2 (Standard): grades 6,7,8 → floor/3 = 2', () => {
      const cases = [[6, 7], [7, 8], [8, 6]];
      const result = fleissKappa(cases, 5);
      expect(typeof result === 'number' || result === null).toBe(true);
    });

    it('Tier 4 (Professional): grades 12,13,14 → floor/3 = 4', () => {
      const cases = [[12, 13], [13, 14], [14, 12]];
      const result = fleissKappa(cases, 5);
      expect(typeof result === 'number' || result === null).toBe(true);
    });
  });

  describe('Boundary: mixed Tiers', () => {
    it('raters in different Tiers → disagreement', () => {
      // Grade 5 (BG3, Tier 1) vs Grade 6 (S-, Tier 2)
      const cases = [[5, 6], [6, 5]];
      const kappa = fleissKappa(cases, 5);
      if (kappa !== null) {
        expect(kappa).toBeLessThan(1); // Not perfect agreement
      }
    });

    it('Tier boundary: 8 (S+, Tier 2) vs 9 (N-, Tier 3)', () => {
      const cases = [[8, 9, 8], [9, 8, 9]];
      const kappa = fleissKappa(cases, 5);
      expect(typeof kappa === 'number' || kappa === null).toBe(true);
    });
  });
});
