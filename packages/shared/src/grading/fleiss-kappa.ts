/**
 * Fleiss' kappa for a panel with multiple raters per case (grading.md G6, appendix B.7).
 * Pure: no Date, no Math.random, no I/O.
 */

/**
 * Result of Fleiss' kappa calculation: the kappa coefficient (or null if undefined) and case count.
 */
export interface FleissResult {
  kappa: number | null;
  cases: number;
}

/**
 * Fleiss' kappa coefficient for measuring agreement among multiple raters across a panel of cases.
 * Each case may have a different number of raters (>= 2). Cases with fewer than 2 ratings are skipped.
 * Returns null when mathematically undefined (G12: all ratings in one category).
 *
 * @param cases Array of cases, where each case is an array of category ratings (one per rater)
 * @param categories Number of categories (default 5 for tier 0..4); must be >= 2
 * @returns { kappa, cases } where kappa is the coefficient (or null), cases is the count used
 * @throws RangeError if categories < 2 or any rating outside [0, categories-1]
 *
 * Formula (grading.md appendix B.7):
 *   P_i = Σ_j n_ij (n_ij − 1) / (n_i (n_i − 1))  where n_ij = count in category j for case i
 *   P̄ = mean(P_i)                                 (mean agreement within cases)
 *   p_j = Σ_i n_ij / Σ_i n_i                     (total count for each category)
 *   P̄_e = Σ_j p_j²                              (expected agreement by chance)
 *   κ = (P̄ − P̄_e) / (1 − P̄_e)
 *   If 1 − P̄_e === 0, return null (all ratings in one category)
 */
export function fleissKappa(cases: readonly (readonly number[])[], categories = 5): FleissResult {
  // Validate categories
  if (!Number.isInteger(categories) || categories < 2) {
    throw new RangeError('KAPPA_INVALID_CATEGORIES');
  }

  const k = categories;

  // Filter cases with >= 2 ratings and validate all ratings
  const validCases: (readonly number[])[] = [];

  for (const caseRatings of cases) {
    // Skip cases with fewer than 2 ratings
    if (caseRatings.length < 2) {
      continue;
    }

    // Validate all ratings in this case
    for (const rating of caseRatings) {
      if (!Number.isInteger(rating) || rating < 0 || rating >= k) {
        throw new RangeError('KAPPA_INVALID_RATING');
      }
    }

    validCases.push(caseRatings);
  }

  // Handle no valid cases
  if (validCases.length === 0) {
    return { kappa: null, cases: 0 };
  }

  // Calculate P_i for each case (agreement within case)
  const P: number[] = [];

  for (const caseRatings of validCases) {
    const n_i = caseRatings.length;

    // Count ratings per category
    const n_ij = Array(k).fill(0);
    for (const rating of caseRatings) {
      n_ij[rating]!++;
    }

    // P_i = Σ_j n_ij (n_ij − 1) / (n_i (n_i − 1))
    let sum = 0;
    for (let j = 0; j < k; j++) {
      const count = n_ij[j]!;
      sum += count * (count - 1);
    }
    const P_i = sum / (n_i * (n_i - 1));
    P.push(P_i);
  }

  // Calculate P̄ (mean agreement)
  const P_bar = P.reduce((a, b) => a + b, 0) / P.length;

  // Calculate total counts per category across all valid cases
  const totalCounts = Array(k).fill(0);
  let totalRatings = 0;

  for (const caseRatings of validCases) {
    for (const rating of caseRatings) {
      totalCounts[rating]!++;
      totalRatings++;
    }
  }

  // Calculate p_j (proportion of each category across all ratings)
  const p: number[] = [];
  for (let j = 0; j < k; j++) {
    p.push(totalCounts[j]! / totalRatings);
  }

  // Calculate P̄_e (expected agreement by chance)
  let P_bar_e = 0;
  for (let j = 0; j < k; j++) {
    P_bar_e += p[j]! * p[j]!;
  }

  // Handle undefined case (G12)
  const denominator = 1 - P_bar_e;
  if (denominator === 0) {
    return { kappa: null, cases: validCases.length };
  }

  // Calculate kappa
  const kappa = (P_bar - P_bar_e) / denominator;

  return { kappa, cases: validCases.length };
}
