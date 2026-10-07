/**
 * Quadratic-weighted Cohen's kappa for two raters (grading.md G6, appendix B.6).
 * Pure: no Date, no Math.random, no I/O.
 */

/**
 * Quadratic-weighted Cohen's kappa coefficient for agreement between two raters.
 * Returns null when mathematically undefined (G12: all ratings fall in one category).
 *
 * @param pairs Pairs of [raterA_category, raterB_category] for each shared case
 * @param categories Number of categories (default 15 for grade ladder); must be >= 2
 * @returns Kappa value in range [-1, 1], or null if undefined
 * @throws RangeError if categories < 2 or any rating outside [0, categories-1]
 *
 * Formula (grading.md appendix B.6):
 *   O_ij = proportion of cases where rater A gave i, rater B gave j
 *   r_i = Σ_j O_ij  (marginal for rater A)
 *   c_j = Σ_i O_ij  (marginal for rater B)
 *   E_ij = r_i × c_j  (expected by chance)
 *   w_ij = (i − j)² / (k − 1)²  (quadratic weight)
 *   κ_w = 1 − (Σ w_ij O_ij) / (Σ w_ij E_ij)
 *   If Σ w_ij E_ij === 0, return null (all ratings in one category)
 */
export function cohenKappaQuadratic(
  pairs: readonly (readonly [number, number])[],
  categories = 15,
): number | null {
  // Validate categories
  if (!Number.isInteger(categories) || categories < 2) {
    throw new RangeError('KAPPA_INVALID_CATEGORIES');
  }

  // Handle empty pairs
  if (pairs.length === 0) {
    return null;
  }

  const N = pairs.length;
  const k = categories;

  // Build confusion matrix and validate ratings
  const O: number[][] = Array.from({ length: k }, () => Array(k).fill(0));

  for (const [a, b] of pairs) {
    // Validate ratings
    if (!Number.isInteger(a) || a < 0 || a >= k) {
      throw new RangeError('KAPPA_INVALID_RATING');
    }
    if (!Number.isInteger(b) || b < 0 || b >= k) {
      throw new RangeError('KAPPA_INVALID_RATING');
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    O[a]![b]! += 1;
  }

  // Convert counts to proportions
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      O[i]![j]! /= N;
    }
  }

  // Calculate marginals
  const r: number[] = Array(k).fill(0);
  const c: number[] = Array(k).fill(0);

  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      r[i]! += O[i]![j]!;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      c[j]! += O[i]![j]!;
    }
  }

  // Calculate kappa components
  let numeratorSum = 0; // Σ w_ij O_ij
  let denominatorSum = 0; // Σ w_ij E_ij

  const w_divisor = (k - 1) * (k - 1);

  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      const w = ((i - j) * (i - j)) / w_divisor;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const E = r[i]! * c[j]!;

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      numeratorSum += w * O[i]![j]!;
      denominatorSum += w * E;
    }
  }

  // Handle undefined case (G12)
  if (denominatorSum === 0) {
    return null;
  }

  // Return kappa value
  return 1 - numeratorSum / denominatorSum;
}
