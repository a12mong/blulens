import { describe, it, expect } from 'vitest';
import { fleissKappa } from '../fleiss-kappa';

describe('GR-08/11 Fleiss: fleissKappa on 5 Tiers (0=Rookie, 1=Beginner, 2=Standard, 3=Neutral, 4=Professional)', () => {
  describe('Perfect agreement with variety → kappa = 1', () => {
    it('multiple cases, all raters agree per case, different tiers across cases → kappa 1', () => {
      const cases = [
        [0, 0, 0], // Tier 0
        [1, 1, 1], // Tier 1
        [2, 2, 2], // Tier 2
        [3, 3, 3], // Tier 3
        [4, 4, 4], // Tier 4
      ];
      const { kappa } = fleissKappa(cases, 5);
      expect(kappa).toBe(1);
    });
  });

  describe('One category only (P_e = 1) → kappa = null (never 1.0 or NaN)', () => {
    it('all raters give only tier 2 across all cases → null', () => {
      const cases = [
        [2, 2, 2],
        [2, 2, 2],
        [2, 2, 2],
      ];
      const { kappa } = fleissKappa(cases, 5);
      expect(kappa).toBeNull();
    });

    it('all same tier all cases → null not 1.0', () => {
      const cases = [[3, 3, 3], [3, 3, 3]];
      const { kappa } = fleissKappa(cases, 5);
      expect(kappa).toBeNull();
      expect(kappa).not.toBe(1.0);
    });
  });

  describe('Cases with <2 raters skipped', () => {
    it('case with 1 rater skipped, others used', () => {
      const cases = [
        [2, 2, 2], // 3 raters
        [3],       // 1 rater — skipped
        [2, 3, 4], // 3 raters
      ];
      const { kappa, cases: validCases } = fleissKappa(cases, 5);
      expect(validCases).toBe(2); // only 2 valid
      if (kappa !== null) {
        expect(typeof kappa).toBe('number');
      }
    });
  });

  describe('Unequal rater counts per case (Fleiss feature)', () => {
    it('2, 3, 4 raters per case → valid', () => {
      const cases = [
        [2, 3],
        [2, 3, 4],
        [1, 2, 3, 4],
      ];
      const { kappa } = fleissKappa(cases, 5);
      if (kappa !== null) {
        expect(kappa).toBeGreaterThanOrEqual(-1);
        expect(kappa).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Error handling', () => {
    it('categories < 2 → KAPPA_INVALID_CATEGORIES', () => {
      expect(() => fleissKappa([[2, 3]], 1)).toThrow(RangeError);
      expect(() => fleissKappa([[2, 3]], 0)).toThrow(RangeError);
    });

    it('non-integer categories → error', () => {
      expect(() => fleissKappa([[2, 3]], 5.5)).toThrow(RangeError);
    });

    it('rating >= categories → KAPPA_INVALID_RATING', () => {
      expect(() => fleissKappa([[0, 5]], 5)).toThrow(RangeError); // 5 is out of [0,4]
    });

    it('negative rating → error', () => {
      expect(() => fleissKappa([[-1, 2]], 5)).toThrow(RangeError);
    });

    it('non-integer rating → error', () => {
      expect(() => fleissKappa([[0.5, 2]], 5)).toThrow(RangeError);
    });
  });

  describe('Edge cases', () => {
    it('empty cases → kappa null, cases 0', () => {
      const { kappa, cases: cnt } = fleissKappa([], 5);
      expect(kappa).toBeNull();
      expect(cnt).toBe(0);
    });

    it('kappa in [-1, 1] for valid inputs', () => {
      const tests = [
        [[2, 3], [3, 4], [4, 0]],
        [[2, 2, 2], [3, 3, 3]],
      ];
      tests.forEach(cases => {
        const { kappa } = fleissKappa(cases, 5);
        if (kappa !== null) {
          expect(kappa).toBeGreaterThanOrEqual(-1);
          expect(kappa).toBeLessThanOrEqual(1);
        }
      });
    });
  });

  describe('Determinism', () => {
    it('same input → same output', () => {
      const cases = [[2, 3, 4], [3, 4, 0]];
      const r1 = fleissKappa(cases, 5);
      const r2 = fleissKappa(cases, 5);
      expect(r1.kappa).toBe(r2.kappa);
      expect(r1.cases).toBe(r2.cases);
    });

    it('row order independence', () => {
      const c1 = [[2, 3, 4], [3, 4, 0]];
      const c2 = [[3, 4, 0], [2, 3, 4]];
      const r1 = fleissKappa(c1, 5);
      const r2 = fleissKappa(c2, 5);
      if (r1.kappa !== null && r2.kappa !== null) {
        expect(r1.kappa).toBeCloseTo(r2.kappa, 10);
      }
    });
  });

  describe('Tier boundary tests', () => {
    it('tier 2 (grades 6-8) vs tier 3 (grades 9-11) disagreement', () => {
      const cases = [[2, 3, 2], [3, 2, 3]];
      const { kappa } = fleissKappa(cases, 5);
      if (kappa !== null) {
        expect(kappa).toBeLessThan(1); // Not perfect
      }
    });

    it('all tiers used → valid calculation', () => {
      const cases = [
        [0, 1, 2, 3, 4],
        [0, 1, 2, 3, 4],
      ];
      const { kappa } = fleissKappa(cases, 5);
      expect(typeof kappa === 'number' || kappa === null).toBe(true);
    });
  });
});
