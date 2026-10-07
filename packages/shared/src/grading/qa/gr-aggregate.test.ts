import { describe, it, expect } from 'vitest';
import { aggregateAssessment, type AggregateResult } from '../aggregate';
import { GRADES } from '../grades';

describe('GR-05/06/07/12/21/23/24/25/28/29/30: aggregateAssessment', () => {
  // Helper to verify result structure and constraints (INV-2)
  const verifyGradeInvariant = (r: AggregateResult) => {
    if (r.grade && r.grade.lower && r.grade.center && r.grade.upper) {
      const lIdx = GRADES.indexOf(r.grade.lower);
      const cIdx = GRADES.indexOf(r.grade.center);
      const uIdx = GRADES.indexOf(r.grade.upper);
      expect(lIdx >= 0).toBe(true);
      expect(cIdx >= 0).toBe(true);
      expect(uIdx >= 0).toBe(true);
      expect(lIdx).toBeLessThanOrEqual(cIdx);
      expect(cIdx).toBeLessThanOrEqual(uIdx);
    }
  };

  describe('GR-05: latestResult-null when no results available', () => {
    it('empty scores → needs_reviewers with all nulls', () => {
      const r = aggregateAssessment([], 2);
      expect(r.status).toBe('needs_reviewers');
      expect(r.score).toBeNull();
      expect(r.margin).toBeNull();
      expect(r.grade).toBeNull();
      expect(r.nRaters).toBe(0);
    });

    it('< minReviewers after outlier exclusion → needs_reviewers', () => {
      const r = aggregateAssessment([7.5, 7.5, 11.5], 3);
      expect(r.status).toBe('needs_reviewers');
      expect(r.score).toBeNull();
      expect(r.grade).toBeNull();
      expect(r.nExcluded).toBe(1);
      expect(r.flags).toContain('OUTLIER_EXCLUDED');
    });
  });

  describe('GR-06: minReviewers parametrize (1–5)', () => {
    it('minReviewers=1 allows n=1 to compute', () => {
      const r = aggregateAssessment([7.83], 1);
      expect(r.status).toBe('provisional');
      expect(r.nRaters).toBe(1);
      expect(r.score).toBe(7.83);
    });

    it('minReviewers=2 rejects n=1', () => {
      const r = aggregateAssessment([7.83], 2);
      expect(r.status).toBe('needs_reviewers');
      expect(r.score).toBeNull();
    });

    it('minReviewers=3 requires n≥3 after exclusion', () => {
      const r = aggregateAssessment([7.5, 7.5, 8.5], 3);
      expect(r.nRaters).toBe(3);
      expect(r.score).not.toBeNull();
    });

    it('invalid minReviewers (0, 6, non-integer) throws', () => {
      expect(() => aggregateAssessment([7.5], 0)).toThrow('GRADING_INVALID_MIN_REVIEWERS');
      expect(() => aggregateAssessment([7.5], 6)).toThrow('GRADING_INVALID_MIN_REVIEWERS');
      expect(() => aggregateAssessment([7.5], 2.5)).toThrow('GRADING_INVALID_MIN_REVIEWERS');
    });
  });

  describe('GR-07: single rater (n=1 → no outlier detection, no kappa)', () => {
    it('n=1 has SINGLE_REVIEWER flag, no outlier detection', () => {
      const r = aggregateAssessment([7.83], 1);
      expect(r.nRaters).toBe(1);
      expect(r.nExcluded).toBe(0);
      expect(r.flags).toContain('SINGLE_REVIEWER');
      expect(r.flags).not.toContain('OUTLIER_EXCLUDED');
    });
  });

  describe('GR-12: result shape when computation succeeds', () => {
    it('returns complete shape with all required fields (pending_approval)', () => {
      const r = aggregateAssessment([7.5, 7.5, 7.83], 2);
      expect(r.status).toBe('pending_approval');
      expect(typeof r.score).toBe('number');
      expect(typeof r.margin).toBe('number');
      expect(r.grade).toBeTruthy();
      expect(r.grade?.lower).toBeTruthy();
      expect(r.grade?.upper).toBeTruthy();
      expect(r.grade?.center).toBeTruthy();
      expect(r.grade?.kind).toMatch(/exact|straddle|wide/);
      expect(r.grade?.label).toBeTruthy();
      expect(typeof r.nRaters).toBe('number');
      expect(Array.isArray(r.excludedIndexes)).toBe(true);
      expect(Array.isArray(r.flags)).toBe(true);
      verifyGradeInvariant(r);
    });

    it('disputed result has all fields including spread', () => {
      const r = aggregateAssessment([6.5, 7.5, 9.5], 2);
      expect(r.status).toBe('disputed');
      expect(r.spread).not.toBeNull();
      expect(r.grade?.kind).toBe('wide');
      expect(r.flags).toContain('HIGH_DISAGREEMENT');
    });
  });

  describe('GR-21: n=1 provisional (7.83 → S-–S+ wide)', () => {
    it('single rater v=7.83, minReviewers=1: score 7.83, margin 1.0, provisional', () => {
      // ค.5 row 1 (n=1): score = 7.83, margin = 1.0 fixed
      // range [7.83-1.0, 7.83+1.0) = [6.83, 8.83)
      // a=floor(6.83)=6 (S-), b=ceil(8.83)-1=8 (S+), center=7 (S)
      const r = aggregateAssessment([7.83], 1);
      expect(r.status).toBe('provisional');
      expect(r.score).toBe(7.83);
      expect(r.margin).toBe(1.0);
      expect(r.grade?.lower).toBe('S-');
      expect(r.grade?.upper).toBe('S+');
      expect(r.grade?.center).toBe('S');
      expect(r.grade?.kind).toBe('wide');
      expect(r.grade?.label).toBe('S-–S+');
      expect(r.flags).toContain('SINGLE_REVIEWER');
    });
  });

  describe('GR-23: n=2 exact / straddle cases', () => {
    it('case 1: [7.50, 7.50] → 7.50 / 0.50 exact S', () => {
      // §12.5 row "2 คน ตรงกัน": gap=0, margin=max(0.5, 0/2+0.25)=0.5
      // range [7.0, 8.0), a=7, b=7 → exact S
      const r = aggregateAssessment([7.5, 7.5], 2);
      expect(r.status).toBe('pending_approval');
      expect(r.score).toBe(7.5);
      expect(r.margin).toBe(0.5);
      expect(r.grade?.lower).toBe('S');
      expect(r.grade?.upper).toBe('S');
      expect(r.grade?.center).toBe('S');
      expect(r.grade?.kind).toBe('exact');
      expect(r.grade?.label).toBe('S');
    });

    it('case 2: [7.50, 7.83] → 7.665 / 0.50 straddle S/S+', () => {
      // gap=0.33, margin=max(0.5, 0.33/2+0.25)=0.5
      // range [7.165, 8.165), a=7 (S), b=ceil(8.165)-1=8 (S+), center=7
      const r = aggregateAssessment([7.5, 7.83], 2);
      expect(r.status).toBe('pending_approval');
      expect(r.score).toBeCloseTo(7.665, 2);
      expect(r.margin).toBe(0.5);
      expect(r.grade?.lower).toBe('S');
      expect(r.grade?.upper).toBe('S+');
      expect(r.grade?.kind).toBe('straddle');
      expect(r.grade?.label).toBe('S/S+');
    });

    it('case 3: [7.50, 8.50] → 8.00 / 0.75 straddle S/S+', () => {
      // gap=1.0, margin=max(0.5, 1.0/2+0.25)=0.75
      // range [7.25, 8.75), a=7 (S), b=ceil(8.75)-1=8 (S+), center=8 (S+)
      const r = aggregateAssessment([7.5, 8.5], 2);
      expect(r.status).toBe('pending_approval');
      expect(r.score).toBe(8.0);
      expect(r.margin).toBe(0.75);
      expect(r.grade?.lower).toBe('S');
      expect(r.grade?.upper).toBe('S+');
      expect(r.grade?.center).toBe('S+');
      expect(r.grade?.kind).toBe('straddle');
    });
  });

  describe('GR-24: n=2 boundary ≤2.0 vs >2.0', () => {
    it('gap exactly 2.0 → pending_approval (not disputed)', () => {
      // §12.5 "2 คน ต่าง 2.0 พอดี": gap=2.0, score=7.50, margin=1.25
      // range [6.25, 8.75), a=6 (S-), b=8 (S+) wide
      const r = aggregateAssessment([6.5, 8.5], 2);
      expect(r.status).toBe('pending_approval');
      expect(r.spread).toBe(2.0);
      expect(r.margin).toBe(1.25);
      expect(r.suggestThirdReviewer).toBe(false);
    });

    it('gap > 2.0 (2.01+) → disputed with PAIR_DISAGREEMENT', () => {
      // gap=2.01, margin>2.0 threshold → disputed
      const r = aggregateAssessment([6.495, 8.505], 2);
      expect(r.status).toBe('disputed');
      expect(r.spread).toBeGreaterThan(2.0);
      expect(r.flags).toContain('PAIR_DISAGREEMENT');
      expect(r.suggestThirdReviewer).toBe(true);
    });
  });

  describe('GR-25: n=2 large disagreement', () => {
    it('[6.50, 9.00] → 7.75 / 1.50 wide S-–N-, disputed', () => {
      // gap=2.5, margin=max(0.5, 2.5/2+0.25)=1.5
      // range [6.25, 9.25), a=6 (S-), b=9 (N-), center=7 (S)
      const r = aggregateAssessment([6.5, 9.0], 2);
      expect(r.status).toBe('disputed');
      expect(r.score).toBe(7.75);
      expect(r.margin).toBe(1.5);
      expect(r.grade?.lower).toBe('S-');
      expect(r.grade?.upper).toBe('N-');
      expect(r.grade?.kind).toBe('wide');
      expect(r.flags).toContain('PAIR_DISAGREEMENT');
      expect(r.flags).not.toContain('OUTLIER_EXCLUDED');
    });
  });

  describe('GR-28: table-driven n × minReviewers routing', () => {
    it('n=0 any minReviewers → needs_reviewers, no computation', () => {
      const r1 = aggregateAssessment([], 1);
      const r2 = aggregateAssessment([], 2);
      const r3 = aggregateAssessment([], 3);
      expect(r1.status).toBe('needs_reviewers');
      expect(r2.status).toBe('needs_reviewers');
      expect(r3.status).toBe('needs_reviewers');
      expect(r1.score).toBeNull();
    });

    it('n=1 minReviewers=1 → provisional; minReviewers>1 → needs_reviewers', () => {
      const r1 = aggregateAssessment([7.5], 1);
      const r2 = aggregateAssessment([7.5], 2);
      expect(r1.status).toBe('provisional');
      expect(r2.status).toBe('needs_reviewers');
    });

    it('n=2 minReviewers≤2 → pair rule; minReviewers>2 → needs_reviewers', () => {
      const r1 = aggregateAssessment([7.5, 7.5], 1);
      const r2 = aggregateAssessment([7.5, 7.5], 2);
      const r3 = aggregateAssessment([7.5, 7.5], 3);
      expect(r1.status).toMatch(/provisional|pending_approval/);
      expect(r2.status).toBe('pending_approval');
      expect(r3.status).toBe('needs_reviewers');
    });

    it('n≥3 uses v1 route with outlier detection, minReviewers gate', () => {
      const r = aggregateAssessment([7.5, 7.5, 7.83], 2);
      expect(r.status).toBe('pending_approval');
      expect(r.nRaters).toBe(3);
      expect(r.score).not.toBeNull();
    });
  });

  describe('GR-29: 3 scores with 1 outlier → needs_reviewers (ค.5)', () => {
    it('[7.50, 7.50, 11.50] excludes 11.50, leaves 2 < 3 → needs_reviewers', () => {
      // ค.5 (ส่วน 12.5): 3 คน โดด 1 → needs_reviewers
      // v=[7.50,7.50,11.50], M=7.50, MAD=0, 11.50 ห่าง 4 > 2 → ตัด
      // เหลือ 2 < 3 → needs_reviewers (ไม่เข้า pair route)
      // **PINNED: ตรวจด้วย Jim ว่า "เหลือ < 3 ใน n≥3" ไม่ตกไปใช้ pair เส้นทาง**
      const r = aggregateAssessment([7.5, 7.5, 11.5], 3);
      expect(r.status).toBe('needs_reviewers');
      expect(r.nRaters).toBe(2);
      expect(r.nExcluded).toBe(1);
      expect(r.excludedIndexes).toEqual([2]);
      expect(r.score).toBeNull();
      expect(r.grade).toBeNull();
      expect(r.flags).toContain('OUTLIER_EXCLUDED');
    });

    it('same with minReviewers=2: n=2 == minReviewers so uses pair route', () => {
      // After excluding outlier 11.5, we have [7.5, 7.5], n=2 == minReviewers
      // So it computes using pair route: score=7.5, margin=0.5, pending_approval
      const r = aggregateAssessment([7.5, 7.5, 11.5], 2);
      expect(r.status).toBe('pending_approval');
      expect(r.nRaters).toBe(2);
      expect(r.nExcluded).toBe(1);
      expect(r.score).toBe(7.5);
      expect(r.grade?.kind).toBe('exact');
      expect(r.flags).toContain('OUTLIER_EXCLUDED');
    });
  });

  describe('GR-30: golden ค.1–ค.4 (appendix)', () => {
    it('ค.1 [7.50, 7.50, 7.83] → 7.61 / 0.25 exact S', () => {
      // M=7.50, MAD=0.33, no outlier
      // score=7.61, s=0.19, t=1.886, m=0.21→0.25 (min)
      // range [7.36, 7.86), a=7, b=7 → exact S
      const r = aggregateAssessment([7.5, 7.5, 7.83], 2);
      expect(r.status).toBe('pending_approval');
      expect(r.score).toBeCloseTo(7.61, 1);
      expect(r.margin).toBeCloseTo(0.25, 2);
      expect(r.grade?.lower).toBe('S');
      expect(r.grade?.upper).toBe('S');
      expect(r.grade?.kind).toBe('exact');
      expect(r.grade?.label).toBe('S');
      expect(r.nRaters).toBe(3);
      expect(r.nExcluded).toBe(0);
    });

    it('ค.2 [7.50, 7.50, 8.50] → 7.83 / 0.63 straddle S/S+', () => {
      // score≈7.83, s≈0.577, t=1.886, m≈0.63
      // range [7.21, 8.46), a=7, b=8 → straddle S/S+, center S
      const r = aggregateAssessment([7.5, 7.5, 8.5], 2);
      expect(r.status).toBe('pending_approval');
      expect(r.score).toBeCloseTo(7.833, 1);
      expect(r.margin).toBeCloseTo(0.63, 1);
      expect(r.grade?.lower).toBe('S');
      expect(r.grade?.upper).toBe('S+');
      expect(r.grade?.center).toBe('S');
      expect(r.grade?.kind).toBe('straddle');
      expect(r.grade?.label).toBe('S/S+');
    });

    it('ค.3 (outlier path) [7.50, 7.83, 8.17, 11.00] → excludes 11.00 → 7.83 / 0.36 S/S+', () => {
      // M=8.00, MAD=0.335, z(11.00)=6.04 > 3.5 → exclude
      // K=[7.50,7.83,8.17], score=7.83, m≈0.36
      // range [7.47, 8.20), a=7, b=8 → straddle S/S+
      const r = aggregateAssessment([7.5, 7.83, 8.17, 11.0], 2);
      expect(r.status).toBe('pending_approval');
      expect(r.nExcluded).toBe(1);
      expect(r.excludedIndexes).toEqual([3]);
      expect(r.score).toBeCloseTo(7.833, 1);
      expect(r.margin).toBeCloseTo(0.36, 1);
      expect(r.grade?.lower).toBe('S');
      expect(r.grade?.upper).toBe('S+');
      expect(r.grade?.kind).toBe('straddle');
      expect(r.flags).toContain('OUTLIER_EXCLUDED');
    });

    it('ค.4 [6.50, 7.50, 9.50] → 7.83 / 1.66 wide S-–N-, disputed (margin > 1.5)', () => {
      // score=7.833, s=1.528, m≈1.66, spread=3.0
      // range [6.17, 9.50), a=6 (S-), b=9 (N-), center=7 (S)
      const r = aggregateAssessment([6.5, 7.5, 9.5], 2);
      expect(r.status).toBe('disputed');
      expect(r.score).toBeCloseTo(7.833, 1);
      expect(r.margin).toBeCloseTo(1.66, 1);
      expect(r.spread).toBe(3.0);
      expect(r.grade?.lower).toBe('S-');
      expect(r.grade?.upper).toBe('N-');
      expect(r.grade?.center).toBe('S');
      expect(r.grade?.kind).toBe('wide');
      expect(r.grade?.label).toBe('S-–N-');
      expect(r.flags).toContain('HIGH_DISAGREEMENT');
    });
  });

  describe('Invalid inputs → GRADING_INVALID_SCORE', () => {
    it('score < 0 throws', () => {
      expect(() => aggregateAssessment([-0.1], 1)).toThrow('GRADING_INVALID_SCORE');
    });

    it('score >= 15 throws', () => {
      expect(() => aggregateAssessment([15.0], 1)).toThrow('GRADING_INVALID_SCORE');
    });

    it('score NaN throws', () => {
      expect(() => aggregateAssessment([NaN], 1)).toThrow('GRADING_INVALID_SCORE');
    });

    it('score Infinity throws', () => {
      expect(() => aggregateAssessment([Infinity], 1)).toThrow('GRADING_INVALID_SCORE');
    });

    it('score -Infinity throws', () => {
      expect(() => aggregateAssessment([-Infinity], 1)).toThrow('GRADING_INVALID_SCORE');
    });
  });

  describe('Determinism and order independence', () => {
    it('same input always same output', () => {
      const r1 = aggregateAssessment([7.5, 7.83, 8.17], 2);
      const r2 = aggregateAssessment([7.5, 7.83, 8.17], 2);
      expect(r1).toEqual(r2);
    });

    it('different order same result (order independence)', () => {
      const r1 = aggregateAssessment([7.5, 7.83, 8.17], 2);
      const r2 = aggregateAssessment([8.17, 7.5, 7.83], 2);
      const r3 = aggregateAssessment([7.83, 8.17, 7.5], 2);
      expect(r1.score).toBe(r2.score);
      expect(r1.score).toBe(r3.score);
      expect(r1.margin).toBe(r2.margin);
      expect(r1.grade?.kind).toBe(r2.grade?.kind);
      // excludedIndexes will differ due to position change, but set should be same
      expect(new Set(r1.excludedIndexes)).toEqual(new Set(r2.excludedIndexes));
    });
  });

  describe('Invariant: lower ≤ center ≤ upper (INV-2)', () => {
    it('maintained across all routes', () => {
      const cases = [
        [7.5, 7.5, 7.83],
        [6.5, 7.5, 9.5],
        [7.5],
        [7.5, 8.5],
        [6.5, 8.5],
      ];
      cases.forEach(scores => {
        const r = aggregateAssessment(scores, 1);
        if (r.grade) verifyGradeInvariant(r);
      });
    });
  });
});
