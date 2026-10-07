import { describe, it, expect } from 'vitest';
import { cohenKappaQuadratic } from '../cohen-kappa';

describe('GR-08/09/10/11: Cohen Quadratic Kappa (cohenKappaQuadratic)', () => {
  describe('GR-08: Kappa undefined (all ratings in single category)', () => {
    it('returns null only when EVERY pair is in the same single category (P_e=1)', () => {
      // All pairs in category 7 only
      const pairs: Array<readonly [number, number]> = [[7, 7], [7, 7], [7, 7]];
      const kappa = cohenKappaQuadratic(pairs, 15);
      expect(kappa).toBeNull();
    });

    it('perfect agreement WITH variety gives kappa = 1, not null', () => {
      // Fixture: perfect agreement but different categories
      // [[0,0],[1,1],[2,2]] => both raters agree perfectly but use variety
      const pairs: Array<readonly [number, number]> = [[0, 0], [1, 1], [2, 2]];
      const kappa = cohenKappaQuadratic(pairs, 3);
      // This is perfect agreement => kappa = 1
      expect(kappa).toBe(1);
    });

    it('two pairs same category each, but perfect agreement: kappa = 1, not null', () => {
      // [[3,3],[7,7]] => perfect agreement (each pair agrees), different categories
      const pairs: Array<readonly [number, number]> = [[3, 3], [7, 7]];
      const kappa = cohenKappaQuadratic(pairs, 15);
      // Perfect agreement with variety => kappa = 1
      expect(kappa).toBe(1);
    });

    it('undefined (null) only when both raters always give same category, e.g. [[5,5] x5]', () => {
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

    it('never shows 1.0 when undefined; undefined != perfect agreement', () => {
      // Undefined: all same
      const undefined_pairs: Array<readonly [number, number]> = [[9, 9], [9, 9], [9, 9]];
      const kappa_undef = cohenKappaQuadratic(undefined_pairs, 15);
      expect(kappa_undef).toBeNull();

      // Perfect agreement with variety: gives 1
      const perfect_pairs: Array<readonly [number, number]> = [
        [7, 7],
        [8, 8],
        [9, 9],
      ];
      const kappa_perfect = cohenKappaQuadratic(perfect_pairs, 15);
      expect(kappa_perfect).toBe(1);
    });
  });

  describe('GR-09: Nearly degenerate and boundary cases', () => {
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
    it('returns kappa = -1 for perfect disagreement', () => {
      const pairs: Array<readonly [number, number]> = [[0, 14], [14, 0]];
      const kappa = cohenKappaQuadratic(pairs, 15);

      expect(kappa).toBe(-1);
    });

    it('shows negative kappa correctly, does not clamp silently', () => {
      // Two raters consistently opposite
      const pairs: Array<readonly [number, number]> = [[2, 12], [3, 11], [1, 13]];
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

    it('fixture D: [[0,14],[14,0]] → -1 (perfect disagreement)', () => {
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

    it('determinism: same input always same output', () => {
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
  });

  describe('Error handling', () => {
    it('KAPPA_INVALID_CATEGORIES: categories < 2 throws RangeError', () => {
      const pairs: Array<readonly [number, number]> = [[0, 0]];

      expect(() => cohenKappaQuadratic(pairs, 1)).toThrow(RangeError);
      expect(() => cohenKappaQuadratic(pairs, 0)).toThrow(RangeError);
      expect(() => cohenKappaQuadratic(pairs, -1)).toThrow(RangeError);
    });

    it('KAPPA_INVALID_RATING: rating >= categories throws RangeError', () => {
      // [[0,15]] with categories=15 (max valid is 14)
      const pairs: Array<readonly [number, number]> = [[0, 15]];
      expect(() => cohenKappaQuadratic(pairs, 15)).toThrow(RangeError);
    });

    it('KAPPA_INVALID_RATING: negative rating throws RangeError', () => {
      const pairs: Array<readonly [number, number]> = [[-1, 7]];
      expect(() => cohenKappaQuadratic(pairs, 15)).toThrow(RangeError);
    });

    it('KAPPA_INVALID_RATING: non-integer rating throws RangeError', () => {
      const pairs: Array<readonly [number, number]> = [[0.5, 1]];
      expect(() => cohenKappaQuadratic(pairs, 15)).toThrow(RangeError);
    });

    it('KAPPA_INVALID_CATEGORIES: non-integer categories throws RangeError', () => {
      const pairs: Array<readonly [number, number]> = [[0, 0]];
      expect(() => cohenKappaQuadratic(pairs, 15.5)).toThrow(RangeError);
    });

    it('categories = 1 (minimum valid is 2) throws RangeError', () => {
      const pairs: Array<readonly [number, number]> = [[0, 0]];
      expect(() => cohenKappaQuadratic(pairs, 1)).toThrow(RangeError);
    });
  });

  describe('Edge case: zero denominator (undefined kappa)', () => {
    it('denominator sum w·E is 0 when all in one category → null', () => {
      // All ratings identical across all cases
      const pairs: Array<readonly [number, number]> = [
        [5, 5],
        [5, 5],
        [5, 5],
      ];
      const kappa = cohenKappaQuadratic(pairs, 15);

      expect(kappa).toBeNull();
    });
  });
});
