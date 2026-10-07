import { describe, it, expect } from 'vitest';
import { cohenKappaQuadratic } from '../cohen-kappa';

describe('GR-08/09/10/11: Cohen Quadratic Kappa (cohenKappaQuadratic)', () => {
  describe('GR-08: Kappa undefined (all one category)', () => {
    it('all pairs in one category (P_e = 1) returns null, not 1.0', () => {
      // All pairs: both raters give category 7 (or any single category)
      const pairs: Array<readonly [number, number]> = [
        [7, 7],
        [7, 7],
        [7, 7],
      ];
      const kappa = cohenKappaQuadratic(pairs, 15);

      // When P_e = 1, kappa is undefined → return null
      expect(kappa).toBeNull();
    });

    it('kappa undefined for n=2 (Cohen): both raters identical on all cases', () => {
      const pairs: Array<readonly [number, number]> = [[3, 3], [7, 7]];
      const kappa = cohenKappaQuadratic(pairs, 15);

      expect(kappa).toBeNull();
    });

    it('kappa undefined for n≥3 (Fleiss): all raters same on all cases', () => {
      // Fleiss case with 5 pairs, all same
      const pairs: Array<readonly [number, number]> = [
        [5, 5],
        [5, 5],
        [5, 5],
        [5, 5],
        [5, 5],
      ];
      const kappa = cohenKappaQuadratic(pairs, 15);

      expect(kappa).toBeNull();
    });

    it('undefined kappa never shows 1.0 or NaN', () => {
      const pairs: Array<readonly [number, number]> = [[0, 0], [1, 1], [2, 2]];
      const kappa = cohenKappaQuadratic(pairs);

      expect(kappa).toBeNull();
      expect(typeof kappa !== 'number' || !isNaN(kappa)).toBe(true);
    });
  });

  describe('GR-09: Nearly degenerate (almost all one category)', () => {
    it('marginal case: differ by 1 in one case, identical otherwise', () => {
      const pairs: Array<readonly [number, number]> = [
        [7, 7],
        [7, 8], // differ by 1
        [7, 7],
        [8, 8],
      ];
      const kappa = cohenKappaQuadratic(pairs, 15);

      // Should compute, not be undefined
      expect(kappa).not.toBeNull();
      if (kappa !== null) {
        expect(typeof kappa).toBe('number');
        expect(isFinite(kappa)).toBe(true);
        expect(kappa).toBeGreaterThanOrEqual(-1);
        expect(kappa).toBeLessThanOrEqual(1);
      }
    });

    it('property: kappa in [-1, 1] for any valid input', () => {
      // Various cases
      const testCases = [
        [[0, 1], [1, 0], [0, 1]],
        [[5, 5], [5, 6], [6, 5], [6, 6]],
        [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]],
      ];

      testCases.forEach((pairs) => {
        const kappa = cohenKappaQuadratic(pairs as Array<readonly [number, number]>, 15);

        if (kappa !== null) {
          expect(kappa).toBeGreaterThanOrEqual(-1);
          expect(kappa).toBeLessThanOrEqual(1);
        }
      });
    });
  });

  describe('GR-10: Negative kappa (perfect disagreement)', () => {
    it('returns kappa < 0 when raters disagree', () => {
      const pairs: Array<readonly [number, number]> = [
        [0, 14],
        [14, 0],
      ];
      const kappa = cohenKappaQuadratic(pairs, 15);

      expect(kappa).toBe(-1); // Perfect disagreement
    });

    it('shows negative kappa correctly, does not clamp silently', () => {
      // Two raters consistently opposite
      const pairs: Array<readonly [number, number]> = [
        [2, 12],
        [3, 11],
        [1, 13],
      ];
      const kappa = cohenKappaQuadratic(pairs, 15);

      expect(kappa).not.toBeNull();
      if (kappa !== null) {
        expect(kappa).toBeLessThan(0);
      }
    });
  });

  describe('GR-11: Correctness of formula against hand-computed fixtures', () => {
    it('fixture A: [[0,0],[1,1],[2,2],[0,1]] with categories 3 → 0.8', () => {
      const pairs: Array<readonly [number, number]> = [[0, 0], [1, 1], [2, 2], [0, 1]];
      const kappa = cohenKappaQuadratic(pairs, 3);

      expect(kappa).toBeCloseTo(0.8, 10);
    });

    it('fixture B: [[7,7],[7,8],[8,8],[6,7],[9,9],[7,7]] → 11/14 ≈ 0.7857', () => {
      const pairs: Array<readonly [number, number]> = [
        [7, 7],
        [7, 8],
        [8, 8],
        [6, 7],
        [9, 9],
        [7, 7],
      ];
      const kappa = cohenKappaQuadratic(pairs, 15);

      expect(kappa).toBeCloseTo(11 / 14, 10);
    });

    it('fixture C: [[7,7],[7,7],[7,7]] → null (all one category)', () => {
      const pairs: Array<readonly [number, number]> = [[7, 7], [7, 7], [7, 7]];
      const kappa = cohenKappaQuadratic(pairs, 15);

      expect(kappa).toBeNull();
    });

    it('fixture D: [[0,14],[14,0]] with categories 15 → -1 (perfect disagreement)', () => {
      const pairs: Array<readonly [number, number]> = [[0, 14], [14, 0]];
      const kappa = cohenKappaQuadratic(pairs, 15);

      expect(kappa).toBe(-1);
    });

    it('fixture E: [[3,3],[5,5],[9,9]] → 1 (perfect agreement with variety)', () => {
      const pairs: Array<readonly [number, number]> = [[3, 3], [5, 5], [9, 9]];
      const kappa = cohenKappaQuadratic(pairs, 15);

      expect(kappa).toBe(1);
    });

    it('empty pairs → null', () => {
      const pairs: Array<readonly [number, number]> = [];
      const kappa = cohenKappaQuadratic(pairs, 15);

      expect(kappa).toBeNull();
    });
  });

  describe('Symmetry and properties', () => {
    it('swapping A and B in each pair gives same kappa', () => {
      const pairsAB: Array<readonly [number, number]> = [
        [7, 7],
        [7, 8],
        [8, 8],
        [6, 7],
        [9, 9],
        [7, 7],
      ];

      // Swap: [B, A]
      const pairsBA: Array<readonly [number, number]> = pairsAB.map(([a, b]) => [b, a]);

      const kappaAB = cohenKappaQuadratic(pairsAB, 15);
      const kappaBA = cohenKappaQuadratic(pairsBA, 15);

      expect(kappaAB).toBe(kappaBA);
    });
  });

  describe('Error handling', () => {
    it('invalid categories (< 2) throws RangeError', () => {
      const pairs: Array<readonly [number, number]> = [[0, 0]];

      expect(() => cohenKappaQuadratic(pairs, 1)).toThrow(RangeError);
      expect(() => cohenKappaQuadratic(pairs, 0)).toThrow(RangeError);
      expect(() => cohenKappaQuadratic(pairs, -1)).toThrow(RangeError);
    });

    it('invalid rating (out of range [0, categories-1]) throws RangeError', () => {
      const pairs1: Array<readonly [number, number]> = [[0, 15]]; // 15 >= categories(15)
      expect(() => cohenKappaQuadratic(pairs1, 15)).toThrow(RangeError);

      const pairs2: Array<readonly [number, number]> = [[-1, 7]]; // -1 < 0
      expect(() => cohenKappaQuadratic(pairs2, 15)).toThrow(RangeError);
    });

    it('non-integer rating throws RangeError', () => {
      const pairs: Array<readonly [number, number]> = [[0.5, 1]];
      expect(() => cohenKappaQuadratic(pairs, 15)).toThrow(RangeError);
    });

    it('invalid categories (non-integer) throws RangeError', () => {
      const pairs: Array<readonly [number, number]> = [[0, 0]];
      expect(() => cohenKappaQuadratic(pairs, 15.5)).toThrow(RangeError);
    });
  });

  describe('Edge case: zero denominator (P_e = 1)', () => {
    it('denominator sum w·E is 0 when all in one category → null', () => {
      // When all ratings are identical across all cases,
      // w_ij terms (quadratic weights) make the expected agreement denominator 0
      const pairs: Array<readonly [number, number]> = [
        [5, 5],
        [5, 5],
        [5, 5],
      ];
      const kappa = cohenKappaQuadratic(pairs, 15);

      expect(kappa).toBeNull();
    });
  });

  describe('Mutation tests: ensuring correct computation', () => {
    it('fixture A mutation: changing one pair changes the result', () => {
      const pairs1: Array<readonly [number, number]> = [[0, 0], [1, 1], [2, 2], [0, 1]];
      const kappa1 = cohenKappaQuadratic(pairs1, 3);

      // Mutate one pair
      const pairs2: Array<readonly [number, number]> = [[0, 0], [1, 1], [2, 2], [1, 0]]; // swap last pair
      const kappa2 = cohenKappaQuadratic(pairs2, 3);

      // Should be different (or both null if the change makes it undefined, but unlikely here)
      if (kappa1 !== null && kappa2 !== null) {
        expect(kappa1).not.toBe(kappa2);
      }
    });

    it('default categories = 15 is used when not specified', () => {
      const pairs: Array<readonly [number, number]> = [[7, 7], [8, 8]];

      const kappaDefault = cohenKappaQuadratic(pairs);
      const kappaExplicit = cohenKappaQuadratic(pairs, 15);

      expect(kappaDefault).toBe(kappaExplicit);
    });
  });

  describe('Determinism and consistency', () => {
    it('same input always produces same output', () => {
      const pairs: Array<readonly [number, number]> = [
        [0, 0],
        [1, 1],
        [2, 2],
        [0, 1],
      ];

      const kappa1 = cohenKappaQuadratic(pairs, 3);
      const kappa2 = cohenKappaQuadratic(pairs, 3);

      expect(kappa1).toBe(kappa2);
    });

    it('order of pairs should not matter (treated as aggregate statistics)', () => {
      const pairs1: Array<readonly [number, number]> = [
        [7, 7],
        [8, 8],
        [7, 8],
      ];

      const pairs2: Array<readonly [number, number]> = [
        [8, 8],
        [7, 8],
        [7, 7],
      ];

      const kappa1 = cohenKappaQuadratic(pairs1, 15);
      const kappa2 = cohenKappaQuadratic(pairs2, 15);

      expect(kappa1).toBe(kappa2);
    });
  });
});
