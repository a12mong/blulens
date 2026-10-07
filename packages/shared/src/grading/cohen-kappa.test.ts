import { describe, expect, it } from 'vitest';
import { cohenKappaQuadratic } from './cohen-kappa';

describe('cohenKappaQuadratic', () => {
  it('matches the hand-computed quadratic kappa fixtures and returns null when undefined', () => {
    // Fixture A: [[0,0],[1,1],[2,2],[0,1]], categories 3 -> 0.8
    expect(cohenKappaQuadratic([[0, 0], [1, 1], [2, 2], [0, 1]], 3)).toBeCloseTo(0.8, 10);

    // Fixture B: [[7,7],[7,8],[8,8],[6,7],[9,9],[7,7]], categories 15 -> 11/14
    expect(
      cohenKappaQuadratic([[7, 7], [7, 8], [8, 8], [6, 7], [9, 9], [7, 7]], 15),
    ).toBeCloseTo(11 / 14, 10);

    // Fixture C: [[7,7],[7,7],[7,7]], categories 15 -> null (all one category)
    expect(cohenKappaQuadratic([[7, 7], [7, 7], [7, 7]], 15)).toBeNull();

    // Fixture D: [[0,14],[14,0]], categories 15 -> -1 (perfect disagreement)
    expect(cohenKappaQuadratic([[0, 14], [14, 0]], 15)).toBeCloseTo(-1, 10);

    // Fixture E: [[3,3],[5,5],[9,9]], categories 15 -> 1 (perfect agreement with variety)
    expect(cohenKappaQuadratic([[3, 3], [5, 5], [9, 9]], 15)).toBeCloseTo(1, 10);

    // Empty pairs -> null
    expect(cohenKappaQuadratic([])).toBeNull();
  });

  it('throws RangeError for invalid categories', () => {
    expect(() => cohenKappaQuadratic([[0, 0]], 1)).toThrow(
      new RangeError('KAPPA_INVALID_CATEGORIES'),
    );
    expect(() => cohenKappaQuadratic([[0, 0]], 0)).toThrow(
      new RangeError('KAPPA_INVALID_CATEGORIES'),
    );
    expect(() => cohenKappaQuadratic([[0, 0]], -1)).toThrow(
      new RangeError('KAPPA_INVALID_CATEGORIES'),
    );
    expect(() => cohenKappaQuadratic([[0, 0]], 1.5)).toThrow(
      new RangeError('KAPPA_INVALID_CATEGORIES'),
    );
  });

  it('throws RangeError for invalid ratings', () => {
    // Rating out of range on rater A
    expect(() => cohenKappaQuadratic([[0, 15]], 15)).toThrow(
      new RangeError('KAPPA_INVALID_RATING'),
    );
    expect(() => cohenKappaQuadratic([[-1, 5]], 15)).toThrow(
      new RangeError('KAPPA_INVALID_RATING'),
    );

    // Rating out of range on rater B
    expect(() => cohenKappaQuadratic([[5, 15]], 15)).toThrow(
      new RangeError('KAPPA_INVALID_RATING'),
    );
    expect(() => cohenKappaQuadratic([[5, -1]], 15)).toThrow(
      new RangeError('KAPPA_INVALID_RATING'),
    );

    // Non-integer rating
    expect(() => cohenKappaQuadratic([[0.5, 1]], 15)).toThrow(
      new RangeError('KAPPA_INVALID_RATING'),
    );
    expect(() => cohenKappaQuadratic([[1, 0.5]], 15)).toThrow(
      new RangeError('KAPPA_INVALID_RATING'),
    );
  });

  it('is symmetric: swapping rater A and B in every pair gives the same value', () => {
    // Test with fixture B, swapped
    const originalB = cohenKappaQuadratic([[7, 7], [7, 8], [8, 8], [6, 7], [9, 9], [7, 7]], 15);
    const swappedB = cohenKappaQuadratic([[7, 7], [8, 7], [8, 8], [7, 6], [9, 9], [7, 7]], 15);

    expect(swappedB).toBeCloseTo(originalB as number, 10);
  });
});
