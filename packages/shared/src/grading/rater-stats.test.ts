import { describe, expect, it } from 'vitest';
import { computeRaterStats, kappaBand, type RaterCase } from './rater-stats';

describe('rater-stats (bl-26-5 shared)', () => {
  describe('kappaBand', () => {
    it('returns insufficient with kappa null when below minimum sample size', () => {
      expect(kappaBand(0.95, 9, 10)).toEqual({
        kappa: null,
        n: 9,
        band: 'insufficient',
      });
      expect(kappaBand(0.85, 14, 15)).toEqual({
        kappa: null,
        n: 14,
        band: 'insufficient',
      });
      expect(kappaBand(0.75, 19, 20)).toEqual({
        kappa: null,
        n: 19,
        band: 'insufficient',
      });
    });

    it('returns insufficient with kappa null when kappa is null (G12)', () => {
      expect(kappaBand(null, 25, 20)).toEqual({
        kappa: null,
        n: 25,
        band: 'insufficient',
      });
    });

    it('classifies Landis & Koch bands correctly when sample meets minimum', () => {
      // poor: < 0.21
      expect(kappaBand(0.15, 20, 20)).toEqual({ kappa: 0.15, n: 20, band: 'poor' });
      expect(kappaBand(-0.1, 20, 20)).toEqual({ kappa: -0.1, n: 20, band: 'poor' });

      // fair: 0.21 - 0.40
      expect(kappaBand(0.21, 20, 20)).toEqual({ kappa: 0.21, n: 20, band: 'fair' });
      expect(kappaBand(0.4, 20, 20)).toEqual({ kappa: 0.4, n: 20, band: 'fair' });

      // moderate: 0.41 - 0.60
      expect(kappaBand(0.41, 20, 20)).toEqual({ kappa: 0.41, n: 20, band: 'moderate' });
      expect(kappaBand(0.6, 20, 20)).toEqual({ kappa: 0.6, n: 20, band: 'moderate' });

      // substantial: 0.61 - 0.80
      expect(kappaBand(0.61, 20, 20)).toEqual({ kappa: 0.61, n: 20, band: 'substantial' });
      expect(kappaBand(0.8, 20, 20)).toEqual({ kappa: 0.8, n: 20, band: 'substantial' });

      // almost_perfect: > 0.80
      expect(kappaBand(0.81, 20, 20)).toEqual({ kappa: 0.81, n: 20, band: 'almost_perfect' });
      expect(kappaBand(1.0, 20, 20)).toEqual({ kappa: 1.0, n: 20, band: 'almost_perfect' });
    });
  });

  describe('computeRaterStats', () => {
    /**
     * Hand-checked 3-reviewer fixture:
     * 20 cases with 3 reviewers: rA, rB, rC.
     *
     * Cases 0..9 (10 cases):
     *   rA: 7.2 (floor 7, tier 2)
     *   rB: 7.5 (floor 7, tier 2)
     *   rC: 7.8 (floor 7, tier 2)
     *   mean(rB, rC) = 7.65 -> floor = 7. diff rA = 7.2 - 7.65 = -0.45.
     *   mean(rA, rC) = 7.50 -> floor = 7. diff rB = 7.5 - 7.50 = 0.00.
     *   mean(rA, rB) = 7.35 -> floor = 7. diff rC = 7.8 - 7.35 = +0.45.
     *
     * Cases 10..19 (10 cases):
     *   rA: 10.2 (floor 10, tier 3)
     *   rB: 10.5 (floor 10, tier 3)
     *   rC: 10.8 (floor 10, tier 3)
     *   mean(rB, rC) = 10.65 -> floor = 10. diff rA = 10.2 - 10.65 = -0.45.
     *   mean(rA, rC) = 10.50 -> floor = 10. diff rB = 10.5 - 10.50 = 0.00.
     *   mean(rA, rB) = 10.35 -> floor = 10. diff rC = 10.8 - 10.35 = +0.45.
     *
     * Expected values:
     * - Panel Fleiss Kappa on 5 tiers:
     *   20 cases (>= 20 cases threshold met). All raters give tier 2 in cases 0..9 and tier 3 in cases 10..19.
     *   P_bar = 1.0, P_bar_e = 0.5 * 0.5 + 0.5 * 0.5 = 0.5.
     *   kappa = (1 - 0.5) / (1 - 0.5) = 1.0 -> almost_perfect, n = 20.
     * - Reviewer rA:
     *   reviews = 20, bias = -0.45, outlierRate = 0.0,
     *   consensus pairs: 10 of [7, 7] and 10 of [10, 10] -> Cohen kappa = 1.0, n = 20, almost_perfect.
     *   flagged = false.
     * - Reviewer rB:
     *   reviews = 20, bias = 0.0, outlierRate = 0.0,
     *   consensus pairs: 10 of [7, 7] and 10 of [10, 10] -> Cohen kappa = 1.0, n = 20, almost_perfect.
     *   flagged = false.
     * - Reviewer rC:
     *   reviews = 20, bias = +0.45, outlierRate = 0.0,
     *   consensus pairs: 10 of [7, 7] and 10 of [10, 10] -> Cohen kappa = 1.0, n = 20, almost_perfect.
     *   flagged = false.
     * - Pairs:
     *   (rA, rB), (rA, rC), (rB, rC) each with 20 shared cases (>= 10 threshold met).
     *   Ratings: 10 of [7, 7] and 10 of [10, 10] -> Cohen kappa = 1.0, n = 20, almost_perfect.
     */
    it('hand-checked 3-reviewer fixture yields exact expected agreement values and bias', () => {
      const cases: RaterCase[] = [];
      for (let i = 0; i < 20; i++) {
        const isHigh = i >= 10;
        cases.push({
          caseId: `case-${i}`,
          reviews: [
            { reviewerId: 'rA', value: isHigh ? 10.2 : 7.2, excluded: false },
            { reviewerId: 'rB', value: isHigh ? 10.5 : 7.5, excluded: false },
            { reviewerId: 'rC', value: isHigh ? 10.8 : 7.8, excluded: false },
          ],
        });
      }

      const stats = computeRaterStats(cases);

      // Panel assertions
      expect(stats.panel.fleissKappaTier.n).toBe(20);
      expect(stats.panel.fleissKappaTier.kappa).toBeCloseTo(1.0, 5);
      expect(stats.panel.fleissKappaTier.band).toBe('almost_perfect');

      // Raters assertions
      expect(stats.raters).toHaveLength(3);

      const rA = stats.raters.find((r) => r.reviewerId === 'rA')!;
      expect(rA.reviews).toBe(20);
      expect(rA.bias).toBeCloseTo(-0.45, 5);
      expect(rA.outlierRate).toBe(0);
      expect(rA.kappaVsConsensus.n).toBe(20);
      expect(rA.kappaVsConsensus.kappa).toBeCloseTo(1.0, 5);
      expect(rA.kappaVsConsensus.band).toBe('almost_perfect');
      expect(rA.flagged).toBe(false);

      const rB = stats.raters.find((r) => r.reviewerId === 'rB')!;
      expect(rB.reviews).toBe(20);
      expect(rB.bias).toBeCloseTo(0.0, 5);
      expect(rB.outlierRate).toBe(0);
      expect(rB.kappaVsConsensus.n).toBe(20);
      expect(rB.kappaVsConsensus.kappa).toBeCloseTo(1.0, 5);
      expect(rB.kappaVsConsensus.band).toBe('almost_perfect');
      expect(rB.flagged).toBe(false);

      const rC = stats.raters.find((r) => r.reviewerId === 'rC')!;
      expect(rC.reviews).toBe(20);
      expect(rC.bias).toBeCloseTo(0.45, 5);
      expect(rC.outlierRate).toBe(0);
      expect(rC.kappaVsConsensus.n).toBe(20);
      expect(rC.kappaVsConsensus.kappa).toBeCloseTo(1.0, 5);
      expect(rC.kappaVsConsensus.band).toBe('almost_perfect');
      expect(rC.flagged).toBe(false);

      // Pairs assertions (sorted a < b)
      expect(stats.pairs).toHaveLength(3);
      expect(stats.pairs.map((p) => `${p.a}-${p.b}`)).toEqual(['rA-rB', 'rA-rC', 'rB-rC']);

      for (const pair of stats.pairs) {
        expect(pair.cohenKappaQuadratic.n).toBe(20);
        expect(pair.cohenKappaQuadratic.kappa).toBeCloseTo(1.0, 5);
        expect(pair.cohenKappaQuadratic.band).toBe('almost_perfect');
      }
    });

    it('handles the minimum thresholds (14 vs 15 reviews, 9 vs 10 shared cases, 19 vs 20 cases)', () => {
      // 1) 14 vs 15 reviews
      const cases14: RaterCase[] = [];
      for (let i = 0; i < 14; i++) {
        const isHigh = i >= 7;
        cases14.push({
          caseId: `c-${i}`,
          reviews: [
            { reviewerId: 'r1', value: isHigh ? 10.0 : 7.0, excluded: false },
            { reviewerId: 'r2', value: isHigh ? 10.0 : 7.0, excluded: false },
            { reviewerId: 'r3', value: isHigh ? 10.0 : 7.0, excluded: false },
          ],
        });
      }
      const stats14 = computeRaterStats(cases14);
      const rater14 = stats14.raters.find((r) => r.reviewerId === 'r1')!;
      expect(rater14.reviews).toBe(14);
      expect(rater14.bias).toBeNull();
      expect(rater14.outlierRate).toBeNull();
      expect(rater14.flagged).toBe(false);
      expect(rater14.kappaVsConsensus).toEqual({
        kappa: null,
        n: 14,
        band: 'insufficient',
      });

      // Add 15th case
      const cases15 = [
        ...cases14,
        {
          caseId: 'c-14',
          reviews: [
            { reviewerId: 'r1', value: 10.0, excluded: false },
            { reviewerId: 'r2', value: 10.0, excluded: false },
            { reviewerId: 'r3', value: 10.0, excluded: false },
          ],
        },
      ];
      const stats15 = computeRaterStats(cases15);
      const rater15 = stats15.raters.find((r) => r.reviewerId === 'r1')!;
      expect(rater15.reviews).toBe(15);
      expect(rater15.bias).toBe(0.0);
      expect(rater15.outlierRate).toBe(0.0);
      expect(rater15.kappaVsConsensus.kappa).toBeCloseTo(1.0, 5);
      expect(rater15.kappaVsConsensus.n).toBe(15);
      expect(rater15.kappaVsConsensus.band).toBe('almost_perfect');

      // 2) 9 vs 10 shared cases for pair
      const pairCases9: RaterCase[] = [];
      for (let i = 0; i < 9; i++) {
        const isHigh = i >= 5;
        pairCases9.push({
          caseId: `p-${i}`,
          reviews: [
            { reviewerId: 'pA', value: isHigh ? 10.0 : 7.0, excluded: false },
            { reviewerId: 'pB', value: isHigh ? 10.0 : 7.0, excluded: false },
          ],
        });
      }
      const pairStats9 = computeRaterStats(pairCases9);
      expect(pairStats9.pairs[0]!.cohenKappaQuadratic).toEqual({
        kappa: null,
        n: 9,
        band: 'insufficient',
      });

      const pairCases10 = [
        ...pairCases9,
        {
          caseId: 'p-9',
          reviews: [
            { reviewerId: 'pA', value: 10.0, excluded: false },
            { reviewerId: 'pB', value: 10.0, excluded: false },
          ],
        },
      ];
      const pairStats10 = computeRaterStats(pairCases10);
      expect(pairStats10.pairs[0]!.cohenKappaQuadratic.n).toBe(10);
      expect(pairStats10.pairs[0]!.cohenKappaQuadratic.kappa).toBeCloseTo(1.0, 5);
      expect(pairStats10.pairs[0]!.cohenKappaQuadratic.band).toBe('almost_perfect');

      // 3) 19 vs 20 cases for panel
      const panelCases19: RaterCase[] = [];
      for (let i = 0; i < 19; i++) {
        const isHigh = i >= 10;
        panelCases19.push({
          caseId: `pan-${i}`,
          reviews: [
            { reviewerId: 'panA', value: isHigh ? 10.0 : 7.0, excluded: false },
            { reviewerId: 'panB', value: isHigh ? 10.0 : 7.0, excluded: false },
          ],
        });
      }
      const panelStats19 = computeRaterStats(panelCases19);
      expect(panelStats19.panel.fleissKappaTier).toEqual({
        kappa: null,
        n: 19,
        band: 'insufficient',
      });

      const panelCases20 = [
        ...panelCases19,
        {
          caseId: 'pan-19',
          reviews: [
            { reviewerId: 'panA', value: 10.0, excluded: false },
            { reviewerId: 'panB', value: 10.0, excluded: false },
          ],
        },
      ];
      const panelStats20 = computeRaterStats(panelCases20);
      expect(panelStats20.panel.fleissKappaTier.n).toBe(20);
      expect(panelStats20.panel.fleissKappaTier.kappa).toBeCloseTo(1.0, 5);
      expect(panelStats20.panel.fleissKappaTier.band).toBe('almost_perfect');
    });

    it('all-same category -> kappa null + insufficient (G12)', () => {
      // 20 cases where all reviewers give the exact same category (7.5 everywhere -> floor 7, tier 2)
      const cases: RaterCase[] = [];
      for (let i = 0; i < 20; i++) {
        cases.push({
          caseId: `same-${i}`,
          reviews: [
            { reviewerId: 'r1', value: 7.5, excluded: false },
            { reviewerId: 'r2', value: 7.5, excluded: false },
            { reviewerId: 'r3', value: 7.5, excluded: false },
          ],
        });
      }

      const stats = computeRaterStats(cases);

      // Panel kappa is null and insufficient (never 1.0)
      expect(stats.panel.fleissKappaTier).toEqual({
        kappa: null,
        n: 20,
        band: 'insufficient',
      });

      // Rater kappa vs consensus is null and insufficient
      for (const rater of stats.raters) {
        expect(rater.kappaVsConsensus).toEqual({
          kappa: null,
          n: 20,
          band: 'insufficient',
        });
        expect(rater.bias).toBe(0);
      }

      // Pairs kappa is null and insufficient
      for (const pair of stats.pairs) {
        expect(pair.cohenKappaQuadratic).toEqual({
          kappa: null,
          n: 20,
          band: 'insufficient',
        });
      }
    });

    it('an excluded review still counts towards reviews, outlierRate, bias, and kappa', () => {
      const cases: RaterCase[] = [];
      for (let i = 0; i < 20; i++) {
        const isHigh = i >= 10;
        cases.push({
          caseId: `ex-${i}`,
          reviews: [
            {
              reviewerId: 'rEx',
              value: isHigh ? 10.0 : 7.0,
              // rEx is excluded in 4 cases out of 20 -> outlierRate 4/20 = 0.20
              excluded: i < 4,
            },
            { reviewerId: 'rOther1', value: isHigh ? 10.0 : 7.0, excluded: false },
            { reviewerId: 'rOther2', value: isHigh ? 10.0 : 7.0, excluded: false },
          ],
        });
      }

      const stats = computeRaterStats(cases);
      const rEx = stats.raters.find((r) => r.reviewerId === 'rEx')!;

      expect(rEx.reviews).toBe(20);
      expect(rEx.outlierRate).toBe(4 / 20); // 0.20
      expect(rEx.bias).toBe(0.0);
      expect(rEx.kappaVsConsensus.kappa).toBeCloseTo(1.0, 5);
      expect(rEx.kappaVsConsensus.band).toBe('almost_perfect');
    });

    it('an abstained review (value null / NaN) is ignored everywhere', () => {
      const cases: RaterCase[] = [
        {
          caseId: 'abs-1',
          reviews: [
            { reviewerId: 'rActive', value: 7.5, excluded: false },
            { reviewerId: 'rAbstained', value: null as unknown as number, excluded: false },
          ],
        },
      ];

      const stats = computeRaterStats(cases);
      // rAbstained is ignored completely
      expect(stats.raters.some((r) => r.reviewerId === 'rAbstained')).toBe(false);
      expect(stats.raters.some((r) => r.reviewerId === 'rActive')).toBe(true);

      // Case abs-1 only had 1 valid review, so panel Fleiss has 0 cases with >= 2 reviews
      expect(stats.panel.fleissKappaTier.n).toBe(0);
      expect(stats.pairs).toHaveLength(0);
    });

    it('the flag fires for each of the 3 reasons (kappaVsConsensus < 0.40, |bias| > 1.0, outlierRate > 0.20)', () => {
      // Base: 20 cases with 3 reviewers
      // Reason 1: low kappaVsConsensus (< 0.40)
      const casesLowKappa: RaterCase[] = [];
      for (let i = 0; i < 20; i++) {
        // rTarget gives opposite or random category from others
        const rVal = i % 2 === 0 ? 0.0 : 14.0;
        const oVal = i % 2 === 0 ? 14.0 : 0.0;
        casesLowKappa.push({
          caseId: `lk-${i}`,
          reviews: [
            { reviewerId: 'rTarget', value: rVal, excluded: false },
            { reviewerId: 'rOther1', value: oVal, excluded: false },
            { reviewerId: 'rOther2', value: oVal, excluded: false },
          ],
        });
      }
      const statsLowKappa = computeRaterStats(casesLowKappa);
      const rTarget1 = statsLowKappa.raters.find((r) => r.reviewerId === 'rTarget')!;
      expect(rTarget1.reviews).toBe(20);
      expect(rTarget1.kappaVsConsensus.kappa).toBeLessThan(0.4);
      expect(rTarget1.bias).toBe(0.0);
      expect(rTarget1.outlierRate).toBe(0.0);
      expect(rTarget1.flagged).toBe(true);

      // Reason 2: high |bias| (> 1.0)
      const casesHighBias: RaterCase[] = [];
      for (let i = 0; i < 20; i++) {
        const isHigh = i >= 10;
        // rTarget gives 1.5 units higher consistently
        casesHighBias.push({
          caseId: `hb-${i}`,
          reviews: [
            { reviewerId: 'rTarget', value: isHigh ? 11.5 : 8.5, excluded: false },
            { reviewerId: 'rOther1', value: isHigh ? 10.0 : 7.0, excluded: false },
            { reviewerId: 'rOther2', value: isHigh ? 10.0 : 7.0, excluded: false },
          ],
        });
      }
      const statsHighBias = computeRaterStats(casesHighBias);
      const rTarget2 = statsHighBias.raters.find((r) => r.reviewerId === 'rTarget')!;
      expect(rTarget2.bias).toBeCloseTo(1.5, 5);
      expect(rTarget2.outlierRate).toBe(0.0);
      expect(rTarget2.flagged).toBe(true);

      // Reason 2b: negative bias (|bias| > 1.0)
      const casesNegBias: RaterCase[] = [];
      for (let i = 0; i < 20; i++) {
        const isHigh = i >= 10;
        casesNegBias.push({
          caseId: `nb-${i}`,
          reviews: [
            { reviewerId: 'rTarget', value: isHigh ? 8.5 : 5.5, excluded: false },
            { reviewerId: 'rOther1', value: isHigh ? 10.0 : 7.0, excluded: false },
            { reviewerId: 'rOther2', value: isHigh ? 10.0 : 7.0, excluded: false },
          ],
        });
      }
      const statsNegBias = computeRaterStats(casesNegBias);
      const rTarget2b = statsNegBias.raters.find((r) => r.reviewerId === 'rTarget')!;
      expect(rTarget2b.bias).toBeCloseTo(-1.5, 5);
      expect(rTarget2b.flagged).toBe(true);

      // Reason 3: high outlierRate (> 0.20)
      const casesHighOutlier: RaterCase[] = [];
      for (let i = 0; i < 20; i++) {
        const isHigh = i >= 10;
        // 5 excluded out of 20 = 0.25 > 0.20
        casesHighOutlier.push({
          caseId: `ho-${i}`,
          reviews: [
            {
              reviewerId: 'rTarget',
              value: isHigh ? 10.0 : 7.0,
              excluded: i < 5,
            },
            { reviewerId: 'rOther1', value: isHigh ? 10.0 : 7.0, excluded: false },
            { reviewerId: 'rOther2', value: isHigh ? 10.0 : 7.0, excluded: false },
          ],
        });
      }
      const statsHighOutlier = computeRaterStats(casesHighOutlier);
      const rTarget3 = statsHighOutlier.raters.find((r) => r.reviewerId === 'rTarget')!;
      expect(rTarget3.outlierRate).toBe(0.25);
      expect(rTarget3.bias).toBe(0.0);
      expect(rTarget3.flagged).toBe(true);

      // Below 15 reviews -> never flagged even with extreme bias/outlier
      const casesFewReviews: RaterCase[] = [];
      for (let i = 0; i < 14; i++) {
        casesFewReviews.push({
          caseId: `few-${i}`,
          reviews: [
            { reviewerId: 'rTarget', value: 14.0, excluded: true },
            { reviewerId: 'rOther1', value: 1.0, excluded: false },
            { reviewerId: 'rOther2', value: 1.0, excluded: false },
          ],
        });
      }
      const statsFew = computeRaterStats(casesFewReviews);
      const rTargetFew = statsFew.raters.find((r) => r.reviewerId === 'rTarget')!;
      expect(rTargetFew.reviews).toBe(14);
      expect(rTargetFew.flagged).toBe(false);
    });
  });
});
