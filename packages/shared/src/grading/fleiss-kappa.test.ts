import { describe, expect, it } from 'vitest';
import { fleissKappa, type FleissResult } from './fleiss-kappa';

describe('fleissKappa', () => {
  // Helper to expand category counts into a ratings list
  // e.g., [0,0,0,0,14] becomes [4,4,4,4,4,4,4,4,4,4,4,4,4,4]
  const expandCounts = (counts: number[]): number[] => {
    const result: number[] = [];
    for (let category = 0; category < counts.length; category++) {
      for (let i = 0; i < counts[category]!; i++) {
        result.push(category);
      }
    }
    return result;
  };

  it('reproduces the Wikipedia example and the hand-computed panels, null when undefined', () => {
    // WIKI: Wikipedia "Fleiss' kappa" worked example
    // 10 cases × 14 raters, 5 categories (0..4)
    const wikiCounts = [
      [0, 0, 0, 0, 14],
      [0, 2, 6, 4, 2],
      [0, 0, 3, 5, 6],
      [0, 3, 9, 2, 0],
      [2, 2, 8, 1, 1],
      [7, 7, 0, 0, 0],
      [3, 2, 6, 3, 0],
      [2, 5, 3, 2, 2],
      [6, 5, 2, 1, 0],
      [0, 2, 2, 3, 7],
    ];

    const wikiRatings = wikiCounts.map(expandCounts);
    const wikiResult = fleissKappa(wikiRatings, 5);
    expect(wikiResult.kappa).toBeCloseTo(0.20993070442195522, 10);
    expect(wikiResult.cases).toBe(10);

    // UNEQUAL: Different number of raters per case
    const unequalResult = fleissKappa([[0, 0, 1], [2, 2], [1, 1, 1, 1]], 3);
    expect(unequalResult.kappa).toBeCloseTo(0.625, 10); // 5/8
    expect(unequalResult.cases).toBe(3);

    // SKIP: Case with 1 rating is skipped
    const skipResult = fleissKappa([[0, 0, 1], [3], [2, 2], [1, 1, 1, 1]], 4);
    expect(skipResult.kappa).toBeCloseTo(0.625, 10); // same as UNEQUAL
    expect(skipResult.cases).toBe(3); // the [3] case is skipped

    // ALLSAME: All ratings in one category -> undefined
    const allsameResult = fleissKappa([[2, 2], [2, 2, 2]], 3);
    expect(allsameResult.kappa).toBeNull();
    expect(allsameResult.cases).toBe(2);

    // PERFECT: Perfect agreement
    const perfectResult = fleissKappa([[0, 0], [4, 4, 4], [2, 2]], 5);
    expect(perfectResult.kappa).toBeCloseTo(1, 10);
    expect(perfectResult.cases).toBe(3);

    // NONE: No valid cases (all have < 2 ratings)
    const noneResult = fleissKappa([[1], [2]], 3);
    expect(noneResult.kappa).toBeNull();
    expect(noneResult.cases).toBe(0);

    // Empty input
    const emptyResult = fleissKappa([], 5);
    expect(emptyResult.kappa).toBeNull();
    expect(emptyResult.cases).toBe(0);
  });

  it('throws RangeError for invalid categories', () => {
    expect(() => fleissKappa([[0, 1]], 1)).toThrow(
      new RangeError('KAPPA_INVALID_CATEGORIES'),
    );
    expect(() => fleissKappa([[0, 1]], 0)).toThrow(
      new RangeError('KAPPA_INVALID_CATEGORIES'),
    );
    expect(() => fleissKappa([[0, 1]], -1)).toThrow(
      new RangeError('KAPPA_INVALID_CATEGORIES'),
    );
    expect(() => fleissKappa([[0, 1]], 2.5)).toThrow(
      new RangeError('KAPPA_INVALID_CATEGORIES'),
    );
  });

  it('throws RangeError for invalid ratings', () => {
    // Out of range: category >= categories
    expect(() => fleissKappa([[0, 5]], 5)).toThrow(
      new RangeError('KAPPA_INVALID_RATING'),
    );

    // Out of range: category < 0
    expect(() => fleissKappa([[-1, 1]], 5)).toThrow(
      new RangeError('KAPPA_INVALID_RATING'),
    );

    // Non-integer rating
    expect(() => fleissKappa([[0.5, 1]], 5)).toThrow(
      new RangeError('KAPPA_INVALID_RATING'),
    );
  });

  it('is order-independent: shuffling cases or ratings within cases gives the same kappa', () => {
    // Test with Wikipedia example
    const wikiCounts = [
      [0, 0, 0, 0, 14],
      [0, 2, 6, 4, 2],
      [0, 0, 3, 5, 6],
      [0, 3, 9, 2, 0],
      [2, 2, 8, 1, 1],
      [7, 7, 0, 0, 0],
      [3, 2, 6, 3, 0],
      [2, 5, 3, 2, 2],
      [6, 5, 2, 1, 0],
      [0, 2, 2, 3, 7],
    ];

    const wikiRatings = wikiCounts.map((c) => expandCounts(c));
    const originalResult = fleissKappa(wikiRatings, 5);

    // Shuffle cases (reverse order)
    const shuffledCases = [...wikiRatings].reverse();
    const shuffledCasesResult = fleissKappa(shuffledCases, 5);
    expect(shuffledCasesResult.kappa).toBeCloseTo(originalResult.kappa as number, 10);
    expect(shuffledCasesResult.cases).toBe(originalResult.cases);

    // Shuffle ratings within a case
    const shuffledRatings = wikiRatings.map((c) => [...c].sort(() => Math.random() - 0.5));
    const shuffledRatingsResult = fleissKappa(shuffledRatings, 5);
    expect(shuffledRatingsResult.kappa).toBeCloseTo(originalResult.kappa as number, 10);
    expect(shuffledRatingsResult.cases).toBe(originalResult.cases);
  });
});
