import { cohenKappaQuadratic } from './cohen-kappa';
import { fleissKappa } from './fleiss-kappa';

export interface RaterCase {
  caseId: string;
  reviews: { reviewerId: string; value: number; excluded: boolean }[];
}

export type AgreementBand =
  'poor' | 'fair' | 'moderate' | 'substantial' | 'almost_perfect' | 'insufficient';

export interface AgreementValue {
  kappa: number | null;
  n: number;
  band: AgreementBand;
}

export interface RaterSummary {
  reviewerId: string;
  reviews: number;
  bias: number | null;
  kappaVsConsensus: AgreementValue;
  outlierRate: number | null;
  flagged: boolean;
}

export interface RaterPair {
  a: string;
  b: string;
  cohenKappaQuadratic: AgreementValue;
}

export interface RaterStatsCore {
  panel: {
    fleissKappaTier: AgreementValue;
  };
  raters: RaterSummary[];
  pairs: RaterPair[];
}

/**
 * Maps a Cohen or Fleiss kappa value into the Landis & Koch agreement band.
 * Below the minimum sample size or when kappa is null (mathematically undefined, G12),
 * returns band 'insufficient' with kappa = null. Never returns undefined kappa as 1.0.
 */
export function kappaBand(kappa: number | null, n: number, min: number): AgreementValue {
  if (kappa === null || Number.isNaN(kappa) || n < min) {
    return { kappa: null, n, band: 'insufficient' };
  }

  let band: AgreementBand;
  if (kappa < 0.21) {
    band = 'poor';
  } else if (kappa < 0.41) {
    band = 'fair';
  } else if (kappa < 0.61) {
    band = 'moderate';
  } else if (kappa <= 0.8) {
    band = 'substantial';
  } else {
    band = 'almost_perfect';
  }

  return { kappa, n, band };
}

/**
 * Pure function computing rater agreement statistics across a window of cases (grading.md §5, appendix B.6-B.8).
 *
 * - Panel: Fleiss' kappa on 5 tiers across every case with >= 2 valid reviews (shown when >= 20 cases).
 * - Raters: per-reviewer bias, Cohen's kappa vs leave-one-out consensus (15 categories), outlier rate, and flag.
 *           Shown when reviews >= 15.
 * - Pairs: pairwise Cohen's kappa quadratic (15 categories) for shared cases (shown when >= 10 shared cases).
 *
 * Pure: no Date, no I/O.
 */
export function computeRaterStats(cases: readonly RaterCase[]): RaterStatsCore {
  // 1. Filter out abstained/invalid reviews (overall null / non-numeric)
  interface ValidReview {
    reviewerId: string;
    value: number;
    excluded: boolean;
  }

  interface ProcessedCase {
    caseId: string;
    validReviews: ValidReview[];
  }

  const processedCases: ProcessedCase[] = [];
  const reviewerIdsSet = new Set<string>();

  for (const c of cases) {
    const validReviews: ValidReview[] = [];
    for (const r of c.reviews ?? []) {
      if (r != null && r.reviewerId && typeof r.value === 'number' && !Number.isNaN(r.value)) {
        validReviews.push({
          reviewerId: r.reviewerId,
          value: r.value,
          excluded: Boolean(r.excluded),
        });
        reviewerIdsSet.add(r.reviewerId);
      }
    }
    processedCases.push({
      caseId: c.caseId,
      validReviews,
    });
  }

  // 2. Panel Fleiss' kappa across cases with >= 2 valid reviews (5 tiers: 0..4)
  const panelCases: number[][] = [];
  for (const pc of processedCases) {
    if (pc.validReviews.length >= 2) {
      const tierRatings = pc.validReviews.map((r) =>
        Math.min(4, Math.max(0, Math.floor(Math.floor(r.value) / 3))),
      );
      panelCases.push(tierRatings);
    }
  }

  const fleissResult = fleissKappa(panelCases, 5);
  const fleissKappaTier = kappaBand(fleissResult.kappa, fleissResult.cases, 20);

  // 3. Raters summary
  const sortedReviewerIds = Array.from(reviewerIdsSet).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const raters: RaterSummary[] = [];

  for (const rId of sortedReviewerIds) {
    let reviewsCount = 0;
    let excludedCount = 0;
    const diffs: number[] = [];
    const consensusPairs: [number, number][] = [];

    for (const pc of processedCases) {
      const rReview = pc.validReviews.find((r) => r.reviewerId === rId);
      if (!rReview) continue;

      reviewsCount++;
      if (rReview.excluded) {
        excludedCount++;
      }

      const others = pc.validReviews.filter((r) => r.reviewerId !== rId);
      if (others.length >= 1) {
        const meanOthers = others.reduce((acc, o) => acc + o.value, 0) / others.length;
        diffs.push(rReview.value - meanOthers);

        if (others.length >= 2) {
          const catR = Math.min(14, Math.max(0, Math.floor(rReview.value)));
          const catConsensus = Math.min(14, Math.max(0, Math.floor(meanOthers)));
          consensusPairs.push([catR, catConsensus]);
        }
      }
    }

    const hasEnoughReviews = reviewsCount >= 15;
    const bias = hasEnoughReviews
      ? diffs.length > 0
        ? diffs.reduce((acc, d) => acc + d, 0) / diffs.length
        : 0
      : null;

    const outlierRate = hasEnoughReviews ? excludedCount / reviewsCount : null;

    const rawConsensusKappa =
      hasEnoughReviews && consensusPairs.length > 0
        ? cohenKappaQuadratic(consensusPairs, 15)
        : null;

    const kappaVsConsensus = kappaBand(
      hasEnoughReviews ? rawConsensusKappa : null,
      consensusPairs.length,
      15,
    );

    const flagged = hasEnoughReviews
      ? (kappaVsConsensus.kappa !== null && kappaVsConsensus.kappa < 0.4) ||
        (bias !== null && Math.abs(bias) > 1.0) ||
        (outlierRate !== null && outlierRate > 0.2)
      : false;

    raters.push({
      reviewerId: rId,
      reviews: reviewsCount,
      bias,
      kappaVsConsensus,
      outlierRate,
      flagged,
    });
  }

  // 4. Pairs summary (a < b, sorted by (a, b))
  const pairs: RaterPair[] = [];

  for (let i = 0; i < sortedReviewerIds.length; i++) {
    const a = sortedReviewerIds[i]!;
    for (let j = i + 1; j < sortedReviewerIds.length; j++) {
      const b = sortedReviewerIds[j]!;

      const sharedRatings: [number, number][] = [];
      for (const pc of processedCases) {
        const revA = pc.validReviews.find((r) => r.reviewerId === a);
        const revB = pc.validReviews.find((r) => r.reviewerId === b);
        if (revA && revB) {
          const catA = Math.min(14, Math.max(0, Math.floor(revA.value)));
          const catB = Math.min(14, Math.max(0, Math.floor(revB.value)));
          sharedRatings.push([catA, catB]);
        }
      }

      const nShared = sharedRatings.length;
      const rawPairKappa = nShared > 0 ? cohenKappaQuadratic(sharedRatings, 15) : null;
      const cohenKappaQuadraticVal = kappaBand(rawPairKappa, nShared, 10);

      pairs.push({
        a,
        b,
        cohenKappaQuadratic: cohenKappaQuadraticVal,
      });
    }
  }

  return {
    panel: {
      fleissKappaTier,
    },
    raters,
    pairs,
  };
}
