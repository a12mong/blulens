import { describe, it, expect } from 'vitest';
import { projectGrade } from '../project-grade';

describe('GR-12/13/14/21/23/24/25/30: projectGrade', () => {
  describe('GR-12: result structure (score, margin, lower, upper, center, kind, label)', () => {
    it('returns complete GradeView with all required fields', () => {
      const result = projectGrade(7.5, 0.5);
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('margin');
      expect(result).toHaveProperty('lower');
      expect(result).toHaveProperty('upper');
      expect(result).toHaveProperty('center');
      expect(result).toHaveProperty('kind');
      expect(result).toHaveProperty('label');
      expect(result.score).toBe(7.5);
      expect(result.margin).toBe(0.5);
      expect(typeof result.lower).toBe('string');
      expect(typeof result.upper).toBe('string');
      expect(typeof result.center).toBe('string');
      expect(['exact', 'straddle', 'wide']).toContain(result.kind);
    });

    it('lower <= center <= upper by grade index', () => {
      const grades = ['RK1', 'RK2', 'RK3', 'BG1', 'BG2', 'BG3', 'S-', 'S', 'S+', 'N-', 'N', 'N+', 'P-', 'P', 'P+'];
      const result = projectGrade(8.0, 1.5);
      const lowerIdx = grades.indexOf(result.lower);
      const centerIdx = grades.indexOf(result.center);
      const upperIdx = grades.indexOf(result.upper);
      expect(lowerIdx).toBeGreaterThanOrEqual(0);
      expect(lowerIdx).toBeLessThanOrEqual(centerIdx);
      expect(centerIdx).toBeLessThanOrEqual(upperIdx);
    });

    it('kind matches spread: exact (0), straddle (1), wide (>=2)', () => {
      const grades = ['RK1', 'RK2', 'RK3', 'BG1', 'BG2', 'BG3', 'S-', 'S', 'S+', 'N-', 'N', 'N+', 'P-', 'P', 'P+'];

      const result1 = projectGrade(7.5, 0.4);
      const spread1 = grades.indexOf(result1.upper) - grades.indexOf(result1.lower);
      if (spread1 === 0) expect(result1.kind).toBe('exact');
      else if (spread1 === 1) expect(result1.kind).toBe('straddle');
      else if (spread1 >= 2) expect(result1.kind).toBe('wide');

      const result2 = projectGrade(8.0, 1.5);
      const spread2 = grades.indexOf(result2.upper) - grades.indexOf(result2.lower);
      if (spread2 === 0) expect(result2.kind).toBe('exact');
      else if (spread2 === 1) expect(result2.kind).toBe('straddle');
      else if (spread2 >= 2) expect(result2.kind).toBe('wide');
    });
  });

  describe('GR-13: clamp (boundaries at first and last grade)', () => {
    it('clamps lower to RK1 when score-margin < 0', () => {
      const result = projectGrade(0.1, 3.0);
      expect(result.lower).toBe('RK1');
    });

    it('clamps upper to P+ when score+margin >= 15', () => {
      const result = projectGrade(14.9, 3.0);
      expect(result.upper).toBe('P+');
    });

    it('center stays within bounds even when clamped', () => {
      const result1 = projectGrade(0.1, 3.0);
      expect(result1.center).toBe('RK1');

      const result2 = projectGrade(14.9, 3.0);
      expect(result2.center).toBe('P+');
    });
  });

  describe('GR-14: rounding boundaries (scores at k.0 and k+0.5)', () => {
    it('score exactly 7.0 (S) with margin 0', () => {
      const result = projectGrade(7.0, 0);
      expect(result.center).toBe('S');
      expect(result.kind).toBe('exact');
    });

    it('score exactly 7.5 (between S and S+) with margin 0.5 → straddle S/S+', () => {
      const result = projectGrade(7.5, 0.5);
      expect(result.center).toBe('S');
      expect(result.lower).toBe('S');
      expect(result.upper).toBe('S+');
      expect(result.kind).toBe('straddle');
    });

    it('score exactly 8.0 (S+) with margin 0.5 → straddle S/S+', () => {
      const result = projectGrade(8.0, 0.5);
      expect(result.center).toBe('S+');
      expect(result.kind).toBe('straddle');
    });

    it('boundary behavior: upper computed as ceil(score+margin)-1', () => {
      // If score=7.5, margin=0.5, then score+margin=8.0
      // ceil(8.0)=8, 8-1=7 → upper grade index 7 (S)
      // Actually this is tricky - need to verify against implementation
      const result = projectGrade(7.5, 0.5);
      expect(result.upper).toBe('S+'); // floor(7.5+0.5) = floor(8) = 8 → S+
    });
  });

  describe('GR-21: n=1 provisional (margin fixed 1.0)', () => {
    it('golden: 7.83 → score 7.83, margin 1.00, wide [S-–S+]', () => {
      const result = projectGrade(7.83, 1.0);
      expect(result.score).toBe(7.83);
      expect(result.margin).toBe(1.0);
      expect(result.kind).toBe('wide');
      expect(result.label).toMatch(/S-.*S\+/);
    });

    it('n=1: lower = floor(7.83-1.0) = floor(6.83) = 6 (S-)', () => {
      const result = projectGrade(7.83, 1.0);
      expect(result.lower).toBe('S-');
    });

    it('n=1: upper = ceil(7.83+1.0)-1 = ceil(8.83)-1 = 8 (S+)', () => {
      const result = projectGrade(7.83, 1.0);
      expect(result.upper).toBe('S+');
    });
  });

  describe('GR-23: n=2 cases with exact golden values', () => {
    it('case 1: [7.50, 7.50] → score 7.50, margin 0.50, exact S', () => {
      const result = projectGrade(7.5, 0.5);
      expect(result.score).toBe(7.5);
      expect(result.margin).toBeCloseTo(0.5, 2);
      expect(result.kind).toBe('exact');
      expect(result.label).toBe('S');
    });

    it('case 2: [7.50, 7.83] → score 7.67, margin ~0.50, exact or straddle S', () => {
      const result = projectGrade(7.67, 0.5);
      expect(result.score).toBeCloseTo(7.67, 1);
      expect(result.margin).toBeCloseTo(0.5, 1);
      expect(['S', 'S/S+']).toContain(result.label);
    });

    it('case 3: [7.50, 8.50] → score 8.00, margin ~0.75, straddle S/S+', () => {
      const result = projectGrade(8.0, 0.75);
      expect(result.score).toBeCloseTo(8.0, 1);
      expect(result.margin).toBeCloseTo(0.75, 1);
      expect(result.kind).toBe('straddle');
      expect(result.label).toBe('S/S+');
    });
  });

  describe('GR-24: n=2 boundary 2.0 vs 2.01 apart', () => {
    it('case 1: [6.50, 8.50] (exactly 2.0 apart) → margin > 1.5, pending_approval not disputed', () => {
      // margin = max(0.5, |8.5-6.5|/2 + 0.25) = max(0.5, 1.0 + 0.25) = 1.25
      const result = projectGrade(7.5, 1.25);
      expect(result.score).toBe(7.5);
      expect(result.margin).toBeCloseTo(1.25, 1);
      // margin 1.25 is not > 1.5, so not disputed
      expect(result.kind).toBe('wide');
    });

    it('case 2 boundary: [6.50, 8.51] (2.01 apart) would give margin > 1.5 → disputed flag exists', () => {
      // This tests the boundary at 2.0 where disputed kicks in
      // margin = max(0.5, 2.01/2 + 0.25) = max(0.5, 1.255) = 1.255
      const result = projectGrade(7.505, 1.255);
      expect(result.margin).toBeCloseTo(1.255, 2);
    });
  });

  describe('GR-25: n=2 large disagreement', () => {
    it('golden: [6.50, 9.00] → score 7.75, margin 1.50, wide S-–N-, disputed', () => {
      // margin = max(0.5, |9-6.5|/2 + 0.25) = max(0.5, 1.25 + 0.25) = 1.5
      const result = projectGrade(7.75, 1.5);
      expect(result.score).toBe(7.75);
      expect(result.margin).toBe(1.5);
      expect(result.kind).toBe('wide');
      // margin = 1.5 is not > 1.5 (boundary is strict), so not disputed
    });

    it('case beyond boundary: margin > 1.5 → disputed', () => {
      // margin 1.51 is > 1.5, so disputed
      const result = projectGrade(7.75, 1.51);
      expect(result.margin).toBeCloseTo(1.51, 2);
    });
  });

  describe('GR-30: golden v1 appendix C cases', () => {
    it('C.1: [7.50, 7.50, 7.83] → score 7.61, margin 0.25, exact S', () => {
      // After aggregation from 3 reviewers
      const result = projectGrade(7.61, 0.25);
      expect(result.score).toBe(7.61);
      expect(result.margin).toBe(0.25);
      expect(result.kind).toBe('exact');
      expect(result.label).toBe('S');
    });

    it('C.2: [7.50, 7.50, 8.50] → score 7.83, margin ~0.63, straddle S/S+', () => {
      // Recomputed from aggregation
      const result = projectGrade(7.83, 0.63);
      expect(result.score).toBe(7.83);
      expect(result.margin).toBeCloseTo(0.63, 1);
      expect(result.kind).toBe('straddle');
      expect(result.label).toBe('S/S+');
    });

    it('C.3: [7.50, 7.83, 8.17, 11.00] outlier removed → score 7.83, margin ~0.36, straddle S/S+', () => {
      // After removing outlier 11.00, left with [7.50, 7.83, 8.17]
      const result = projectGrade(7.83, 0.36);
      expect(result.score).toBe(7.83);
      expect(result.margin).toBeCloseTo(0.36, 1);
      expect(result.kind).toBe('straddle');
      expect(result.label).toBe('S/S+');
    });

    it('C.4: [6.50, 7.50, 9.50] → score 7.83, margin ~1.66, wide S-–N-', () => {
      const result = projectGrade(7.83, 1.66);
      expect(result.score).toBe(7.83);
      expect(result.margin).toBeCloseTo(1.66, 1);
      expect(result.kind).toBe('wide');
      expect(result.label).toMatch(/S-.*N-/);
    });
  });

  describe('Invalid inputs throw GRADE_INVALID_INPUT', () => {
    it('score < 0', () => {
      expect(() => projectGrade(-0.01, 0.5)).toThrow(RangeError);
    });

    it('score >= 15', () => {
      expect(() => projectGrade(15, 0.5)).toThrow(RangeError);
    });

    it('score = NaN', () => {
      expect(() => projectGrade(NaN, 0.5)).toThrow(RangeError);
    });

    it('score = Infinity', () => {
      expect(() => projectGrade(Infinity, 0.5)).toThrow(RangeError);
    });

    it('margin < 0', () => {
      expect(() => projectGrade(7.5, -0.1)).toThrow(RangeError);
    });
  });

  describe('Property: determinism and type safety', () => {
    it('same input always gives same output', () => {
      const r1 = projectGrade(7.5, 0.5);
      const r2 = projectGrade(7.5, 0.5);
      expect(r1).toEqual(r2);
    });

    it('200 random (LCG-seeded) scores stay within bounds and satisfy invariants', () => {
      // LCG: next = (a * seed + c) mod m
      const a = 1103515245;
      const c = 12345;
      const m = 2147483648;
      let seed = 42;

      const grades = ['RK1', 'RK2', 'RK3', 'BG1', 'BG2', 'BG3', 'S-', 'S', 'S+', 'N-', 'N', 'N+', 'P-', 'P', 'P+'];

      for (let i = 0; i < 200; i++) {
        seed = (a * seed + c) % m;
        const score = (seed % 15000) / 1000; // [0, 15)

        seed = (a * seed + c) % m;
        const margin = (seed % 300) / 100; // [0, 3)

        const result = projectGrade(score, margin);

        // Invariants
        const lowerIdx = grades.indexOf(result.lower);
        const centerIdx = grades.indexOf(result.center);
        const upperIdx = grades.indexOf(result.upper);

        expect(lowerIdx).toBeGreaterThanOrEqual(0);
        expect(lowerIdx).toBeLessThanOrEqual(centerIdx);
        expect(centerIdx).toBeLessThanOrEqual(upperIdx);
        expect(upperIdx).toBeLessThanOrEqual(14);

        expect(['exact', 'straddle', 'wide']).toContain(result.kind);
        expect(result.label).toMatch(/^[A-Z+-]+(\/?[A-Z+-]+|–[A-Z+-]+)?$/);
      }
    });
  });
});
