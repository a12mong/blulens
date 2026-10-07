import { describe, it, expect } from 'vitest';
import { projectGrade } from '../project-grade';

const GRADES = ['RK1', 'RK2', 'RK3', 'BG1', 'BG2', 'BG3', 'S-', 'S', 'S+', 'N-', 'N', 'N+', 'P-', 'P', 'P+'];

describe('GR-12/13/14/21/23/24/25/30: projectGrade', () => {
  describe('GR-12: complete structure with all fields', () => {
    it('returns {score, margin, lower, upper, center, kind, label, tier}', () => {
      const result = projectGrade(7.5, 0.5);
      expect(result.score).toBe(7.5);
      expect(result.margin).toBe(0.5);
      expect(typeof result.lower).toBe('string');
      expect(typeof result.upper).toBe('string');
      expect(typeof result.center).toBe('string');
      expect(['exact', 'straddle', 'wide']).toContain(result.kind);
      expect(typeof result.label).toBe('string');
      expect(typeof result.tier).toBe('string');
    });

    it('invariant: lower ≤ center ≤ upper by index', () => {
      const test = (score: number, margin: number) => {
        const r = projectGrade(score, margin);
        const li = GRADES.indexOf(r.lower);
        const ci = GRADES.indexOf(r.center);
        const ui = GRADES.indexOf(r.upper);
        expect(li).toBeLessThanOrEqual(ci);
        expect(ci).toBeLessThanOrEqual(ui);
      };
      test(7.5, 0.5);
      test(8.0, 1.5);
      test(10.0, 2.0);
    });
  });

  describe('GR-13: clamp boundaries (RK1 min, P+ max)', () => {
    it('score 0.1 margin 3.0: lower clamped to RK1', () => {
      const r = projectGrade(0.1, 3.0);
      expect(r.lower).toBe('RK1');
    });

    it('score 14.9 margin 3.0: upper clamped to P+', () => {
      const r = projectGrade(14.9, 3.0);
      expect(r.upper).toBe('P+');
    });
  });

  describe('GR-14: formula exact (a=floor(score-margin), b=ceil(score+margin)-1, center=floor(score), kind by diff)', () => {
    it('spec-reachable: 7.5 margin 0.25: a=floor(7.25)=7, b=ceil(7.75)-1=7, center=7 → exact S', () => {
      const r = projectGrade(7.5, 0.25);
      expect(r.lower).toBe('S');
      expect(r.upper).toBe('S');
      expect(r.center).toBe('S');
      expect(r.kind).toBe('exact');
      expect(r.label).toBe('S');
    });

    it('edge: integer score with zero margin (7,0) has inverted range, expected red until projectGrade guards b>=a', () => {
      // margin 0 with integer score is unreachable in spec (min margin 0.25)
      // This test tracks a code quirk: upper=ceil(7+0)-1=6 < lower=floor(7-0)=7
      const r = projectGrade(7, 0);
      // Expected: RED today because lower > upper (code does not guard this yet)
      // This is expected failure until Kevin fixes projectGrade
      expect(r.lower).toBe('S');
      expect(r.upper).toBe('S');
    });

    it('7.5 margin 0.5: a=floor(7.0)=7, b=ceil(8.0)-1=7, center=7 → exact S', () => {
      const r = projectGrade(7.5, 0.5);
      expect(r.lower).toBe('S');
      expect(r.upper).toBe('S');
      expect(r.center).toBe('S');
      expect(r.kind).toBe('exact');
      expect(r.label).toBe('S');
    });

    it('7.67 margin 0.5: a=floor(7.17)=7, b=ceil(8.17)-1=8, center=7 → straddle S/S+', () => {
      const r = projectGrade(7.67, 0.5);
      expect(r.lower).toBe('S');
      expect(r.upper).toBe('S+');
      expect(r.center).toBe('S');
      expect(r.kind).toBe('straddle');
      expect(r.label).toBe('S/S+');
    });

    it('8.0 margin 0.75: a=floor(7.25)=7, b=ceil(8.75)-1=8, center=8 → straddle S/S+', () => {
      const r = projectGrade(8.0, 0.75);
      expect(r.lower).toBe('S');
      expect(r.upper).toBe('S+');
      expect(r.center).toBe('S+');
      expect(r.kind).toBe('straddle');
      expect(r.label).toBe('S/S+');
    });
  });

  describe('GR-21: n=1 provisional (margin 1.0 fixed)', () => {
    it('7.83 margin 1.0: a=floor(6.83)=6(S-), b=ceil(8.83)-1=8(S+), center=7(S) → wide S-–S+', () => {
      const r = projectGrade(7.83, 1.0);
      expect(r.score).toBe(7.83);
      expect(r.margin).toBe(1.0);
      expect(r.lower).toBe('S-');
      expect(r.upper).toBe('S+');
      expect(r.center).toBe('S');
      expect(r.kind).toBe('wide');
      expect(r.label).toBe('S-–S+');
    });
  });

  describe('GR-23: n=2 (margin formula: max(0.5, |v₁−v₂|/2 + 0.25))', () => {
    it('case 1: [7.50, 7.50] score 7.50 margin 0.50 → exact S', () => {
      const r = projectGrade(7.5, 0.5);
      expect(r.score).toBe(7.5);
      expect(r.margin).toBe(0.5);
      expect(r.lower).toBe('S');
      expect(r.upper).toBe('S');
      expect(r.kind).toBe('exact');
      expect(r.label).toBe('S');
    });

    it('case 2: [7.50, 7.83] score 7.67 margin 0.50 → straddle S/S+', () => {
      const r = projectGrade(7.67, 0.5);
      expect(r.lower).toBe('S');
      expect(r.upper).toBe('S+');
      expect(r.kind).toBe('straddle');
      expect(r.label).toBe('S/S+');
    });

    it('case 3: [7.50, 8.50] score 8.00 margin 0.75 → straddle S/S+', () => {
      const r = projectGrade(8.0, 0.75);
      expect(r.lower).toBe('S');
      expect(r.upper).toBe('S+');
      expect(r.kind).toBe('straddle');
      expect(r.label).toBe('S/S+');
    });
  });

  describe('GR-25: n=2 large disagreement', () => {
    it('[6.50, 9.00] score 7.75 margin 1.50 → wide S-–N-', () => {
      const r = projectGrade(7.75, 1.5);
      expect(r.score).toBe(7.75);
      expect(r.margin).toBe(1.5);
      expect(r.lower).toBe('S-');
      expect(r.upper).toBe('N-');
      expect(r.center).toBe('S');
      expect(r.kind).toBe('wide');
      expect(r.label).toBe('S-–N-');
    });
  });

  describe('GR-30: golden C.1-C.4 from appendix', () => {
    it('C.1: [7.50, 7.50, 7.83] → 7.61 margin 0.25 exact S', () => {
      const r = projectGrade(7.61, 0.25);
      expect(r.score).toBe(7.61);
      expect(r.margin).toBe(0.25);
      expect(r.lower).toBe('S');
      expect(r.upper).toBe('S');
      expect(r.center).toBe('S');
      expect(r.kind).toBe('exact');
      expect(r.label).toBe('S');
    });

    it('C.2: [7.50, 7.50, 8.50] → 7.83 margin 0.63 straddle S/S+', () => {
      const r = projectGrade(7.83, 0.63);
      expect(r.lower).toBe('S');
      expect(r.upper).toBe('S+');
      expect(r.kind).toBe('straddle');
      expect(r.label).toBe('S/S+');
    });

    it('C.3: [7.50, 7.83, 8.17] (outlier removed) → 7.83 margin 0.36 straddle S/S+', () => {
      const r = projectGrade(7.83, 0.36);
      expect(r.lower).toBe('S');
      expect(r.upper).toBe('S+');
      expect(r.kind).toBe('straddle');
      expect(r.label).toBe('S/S+');
    });

    it('C.4: [6.50, 7.50, 9.50] → 7.83 margin 1.66 wide S-–N-', () => {
      const r = projectGrade(7.83, 1.66);
      expect(r.lower).toBe('S-');
      expect(r.upper).toBe('N-');
      expect(r.kind).toBe('wide');
      expect(r.label).toBe('S-–N-');
    });
  });

  describe('Invalid inputs → GRADE_INVALID_INPUT', () => {
    it('score < 0', () => expect(() => projectGrade(-0.01, 0.5)).toThrow(RangeError));
    it('score >= 15', () => expect(() => projectGrade(15, 0.5)).toThrow(RangeError));
    it('score NaN', () => expect(() => projectGrade(NaN, 0.5)).toThrow(RangeError));
    it('score Infinity', () => expect(() => projectGrade(Infinity, 0.5)).toThrow(RangeError));
    it('margin < 0', () => expect(() => projectGrade(7.5, -0.1)).toThrow(RangeError));
  });

  describe('Determinism & properties', () => {
    it('same input always same output', () => {
      const r1 = projectGrade(7.5, 0.5);
      const r2 = projectGrade(7.5, 0.5);
      expect(r1).toEqual(r2);
    });

    it('200 LCG-seeded deterministic scores maintain invariants', () => {
      const a = 1103515245;
      const c = 12345;
      const m = 2147483648;
      let seed = 42;

      for (let i = 0; i < 200; i++) {
        seed = (a * seed + c) % m;
        const score = (seed % 15000) / 1000;
        seed = (a * seed + c) % m;
        const margin = (seed % 300) / 100;

        const r = projectGrade(score, margin);
        const li = GRADES.indexOf(r.lower);
        const ci = GRADES.indexOf(r.center);
        const ui = GRADES.indexOf(r.upper);

        expect(li).toBeLessThanOrEqual(ci);
        expect(ci).toBeLessThanOrEqual(ui);
        expect(['exact', 'straddle', 'wide']).toContain(r.kind);
      }
    });
  });
});
