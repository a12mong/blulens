import { describe, expect, it } from 'vitest';
import { gradeIndex, tierOf } from './grades';
import { projectGrade } from './project-grade';

describe('projectGrade', () => {
  it('reproduces grading.md appendix C projections exactly', () => {
    // C.1 score 7.61, m 0.25 -> lower S, upper S, center S, kind exact, label "S"
    const c1 = projectGrade(7.61, 0.25);
    expect(c1).toEqual({
      score: 7.61,
      margin: 0.25,
      lower: 'S',
      upper: 'S',
      center: 'S',
      tier: 'Standard',
      kind: 'exact',
      label: 'S',
    });

    // C.2 score 7.83, m 0.63 -> lower S, upper S+, center S, kind straddle, label "S/S+"
    const c2 = projectGrade(7.83, 0.63);
    expect(c2).toEqual({
      score: 7.83,
      margin: 0.63,
      lower: 'S',
      upper: 'S+',
      center: 'S',
      tier: 'Standard',
      kind: 'straddle',
      label: 'S/S+',
    });

    // C.4 score 7.83, m 1.66 -> lower S-, upper N-, center S, kind wide, label "S-–N-"
    const c4 = projectGrade(7.83, 1.66);
    expect(c4).toEqual({
      score: 7.83,
      margin: 1.66,
      lower: 'S-',
      upper: 'N-',
      center: 'S',
      tier: 'Standard',
      kind: 'wide',
      label: 'S-\u2013N-',
    });
  });

  it('handles edge case projections and boundary clamping', () => {
    // (7.5, 0.5) -> interval [7.0, 8.0) -> lower S, upper S, exact, "S" (the reason for ceil - 1)
    const midHalf = projectGrade(7.5, 0.5);
    expect(midHalf.lower).toBe('S');
    expect(midHalf.upper).toBe('S');
    expect(midHalf.kind).toBe('exact');
    expect(midHalf.label).toBe('S');

    // (7.5, 0) -> lower S, upper S, exact (override results have margin 0)
    const zeroMargin = projectGrade(7.5, 0);
    expect(zeroMargin.lower).toBe('S');
    expect(zeroMargin.upper).toBe('S');
    expect(zeroMargin.kind).toBe('exact');
    expect(zeroMargin.label).toBe('S');

    // (0.2, 3.0) -> a = clamp(floor(-2.8)) = 0 -> lower RK1; b = ceil(3.2) - 1 = 3 -> upper BG1; center RK1; wide; label "RK1–BG1"
    const lowWide = projectGrade(0.2, 3.0);
    expect(lowWide.lower).toBe('RK1');
    expect(lowWide.upper).toBe('BG1');
    expect(lowWide.center).toBe('RK1');
    expect(lowWide.tier).toBe('Rookie');
    expect(lowWide.kind).toBe('wide');
    expect(lowWide.label).toBe('RK1\u2013BG1');

    // (14.9, 3.0) -> a = floor(11.9) = 11 -> lower N+; b = clamp(ceil(17.9) - 1) = 14 -> upper P+; center P+; wide; label "N+–P+"
    const highWide = projectGrade(14.9, 3.0);
    expect(highWide.lower).toBe('N+');
    expect(highWide.upper).toBe('P+');
    expect(highWide.center).toBe('P+');
    expect(highWide.tier).toBe('Professional');
    expect(highWide.kind).toBe('wide');
    expect(highWide.label).toBe('N+\u2013P+');
  });

  it('verifies ladder tiers and gradeIndex helpers', () => {
    expect(tierOf(0)).toBe('Rookie');
    expect(tierOf(8)).toBe('Standard');
    expect(tierOf(14)).toBe('Professional');

    expect(gradeIndex('P+')).toBe(14);
    expect(gradeIndex('S')).toBe(7);
    expect(gradeIndex('RK1')).toBe(0);

    // Invalid grade key
    expect(() => gradeIndex('UNKNOWN' as unknown as 'S')).toThrow(RangeError);
    expect(() => gradeIndex('UNKNOWN' as unknown as 'S')).toThrow('GRADE_UNKNOWN_KEY');

    // Invalid index for tierOf
    expect(() => tierOf(-1)).toThrow(RangeError);
    expect(() => tierOf(-1)).toThrow('GRADE_INVALID_INDEX');
    expect(() => tierOf(15)).toThrow(RangeError);
    expect(() => tierOf(15)).toThrow('GRADE_INVALID_INDEX');
    expect(() => tierOf(2.5)).toThrow(RangeError);
    expect(() => tierOf(2.5)).toThrow('GRADE_INVALID_INDEX');
  });

  it('validates invalid inputs with RangeError', () => {
    expect(() => projectGrade(15, 0)).toThrow(RangeError);
    expect(() => projectGrade(15, 0)).toThrow('GRADE_INVALID_INPUT');

    expect(() => projectGrade(-0.1, 0)).toThrow(RangeError);
    expect(() => projectGrade(-0.1, 0)).toThrow('GRADE_INVALID_INPUT');

    expect(() => projectGrade(7, -1)).toThrow(RangeError);
    expect(() => projectGrade(7, -1)).toThrow('GRADE_INVALID_INPUT');

    expect(() => projectGrade(NaN, 0)).toThrow(RangeError);
    expect(() => projectGrade(NaN, 0)).toThrow('GRADE_INVALID_INPUT');

    expect(() => projectGrade(7, NaN)).toThrow(RangeError);
    expect(() => projectGrade(7, NaN)).toThrow('GRADE_INVALID_INPUT');

    expect(() => projectGrade(Infinity, 0)).toThrow(RangeError);
    expect(() => projectGrade(Infinity, 0)).toThrow('GRADE_INVALID_INPUT');
  });

  it('never inverts the bounds for an integer score with zero margin (QA bl-12)', () => {
    expect(projectGrade(7, 0)).toMatchObject({ lower: 'S', upper: 'S', center: 'S', kind: 'exact', label: 'S' });
    expect(projectGrade(0, 0)).toMatchObject({ lower: 'RK1', upper: 'RK1', kind: 'exact' });
  });
});
