import { describe, it, expect } from 'vitest';
import { reviewerScore } from './reviewer-score';

describe('reviewerScore', () => {
  const sixCriteria = [
    { key: 'footwork', weight: 1 },
    { key: 'overhead', weight: 1 },
    { key: 'net', weight: 1 },
    { key: 'defense', weight: 1 },
    { key: 'tactics', weight: 1 },
    { key: 'consistency', weight: 1 },
  ];

  it('computes v_j over assessed criteria and abstains when more than half the weight is missing', () => {
    // Case 1: all six at 7 (S = grade index 7)
    const case1 = reviewerScore(
      [
        { criterion: 'footwork', gradeIndex: 7 },
        { criterion: 'overhead', gradeIndex: 7 },
        { criterion: 'net', gradeIndex: 7 },
        { criterion: 'defense', gradeIndex: 7 },
        { criterion: 'tactics', gradeIndex: 7 },
        { criterion: 'consistency', gradeIndex: 7 },
      ],
      sixCriteria,
    );
    expect(case1).toEqual({ abstained: false, overall: 7.5 });

    // Case 2: five at 7 (S), one at 8 (S+ = grade index 8)
    const case2 = reviewerScore(
      [
        { criterion: 'footwork', gradeIndex: 7 },
        { criterion: 'overhead', gradeIndex: 7 },
        { criterion: 'net', gradeIndex: 7 },
        { criterion: 'defense', gradeIndex: 7 },
        { criterion: 'tactics', gradeIndex: 7 },
        { criterion: 'consistency', gradeIndex: 8 },
      ],
      sixCriteria,
    );
    expect(case2.abstained).toBe(false);
    expect(case2.overall).toBeCloseTo((5 * 7.5 + 8.5) / 6, 10); // = 7.6667

    // Case 3: three null, three at 9 (N- = grade index 9)
    // Exactly half assessed: NOT an abstention (strictly less than required)
    const case3 = reviewerScore(
      [
        { criterion: 'footwork', gradeIndex: null },
        { criterion: 'overhead', gradeIndex: null },
        { criterion: 'net', gradeIndex: null },
        { criterion: 'defense', gradeIndex: 9 },
        { criterion: 'tactics', gradeIndex: 9 },
        { criterion: 'consistency', gradeIndex: 9 },
      ],
      sixCriteria,
    );
    expect(case3).toEqual({ abstained: false, overall: 9.5 });

    // Case 4: four null, two at 9 (N- = grade index 9) (more than half missing)
    const case4 = reviewerScore(
      [
        { criterion: 'footwork', gradeIndex: null },
        { criterion: 'overhead', gradeIndex: null },
        { criterion: 'net', gradeIndex: null },
        { criterion: 'defense', gradeIndex: null },
        { criterion: 'tactics', gradeIndex: 9 },
        { criterion: 'consistency', gradeIndex: 9 },
      ],
      sixCriteria,
    );
    expect(case4).toEqual({ abstained: true, overall: null });
  });

  it('handles weighted criteria', () => {
    const weightedRubric = [
      { key: 'footwork', weight: 2 },
      { key: 'overhead', weight: 1 },
      { key: 'net', weight: 1 },
      { key: 'defense', weight: 1 },
      { key: 'tactics', weight: 1 },
      { key: 'consistency', weight: 1 },
    ]; // total = 7

    // footwork N- (grade index 9), others S (grade index 7)
    const case1 = reviewerScore(
      [
        { criterion: 'footwork', gradeIndex: 9 },
        { criterion: 'overhead', gradeIndex: 7 },
        { criterion: 'net', gradeIndex: 7 },
        { criterion: 'defense', gradeIndex: 7 },
        { criterion: 'tactics', gradeIndex: 7 },
        { criterion: 'consistency', gradeIndex: 7 },
      ],
      weightedRubric,
    );
    expect(case1.abstained).toBe(false);
    expect(case1.overall).toBeCloseTo((2 * 9.5 + 5 * 7.5) / 7, 10); // = 8.0714

    // footwork null, others S (grade index 7) (weight 5 >= 0.5 * 7 = 3.5, not an abstention)
    const case2 = reviewerScore(
      [
        { criterion: 'footwork', gradeIndex: null },
        { criterion: 'overhead', gradeIndex: 7 },
        { criterion: 'net', gradeIndex: 7 },
        { criterion: 'defense', gradeIndex: 7 },
        { criterion: 'tactics', gradeIndex: 7 },
        { criterion: 'consistency', gradeIndex: 7 },
      ],
      weightedRubric,
    );
    expect(case2).toEqual({ abstained: false, overall: 7.5 });
  });

  it('handles order independence', () => {
    const scores = [
      { criterion: 'footwork', gradeIndex: 7 },
      { criterion: 'overhead', gradeIndex: 8 },
      { criterion: 'net', gradeIndex: 6 },
      { criterion: 'defense', gradeIndex: null },
      { criterion: 'tactics', gradeIndex: 7 },
      { criterion: 'consistency', gradeIndex: 9 },
    ];

    // Original order
    const r1 = reviewerScore(scores, sixCriteria);

    // Shuffled order
    const shuffled = [scores[4]!, scores[1]!, scores[5]!, scores[0]!, scores[2]!, scores[3]!];
    const r2 = reviewerScore(shuffled, sixCriteria);

    expect(r1.abstained).toBe(r2.abstained);
    expect(r1.overall).toBeCloseTo(r2.overall!, 10);
  });

  it('handles all null (abstention)', () => {
    const allNull = reviewerScore(
      [
        { criterion: 'footwork', gradeIndex: null },
        { criterion: 'overhead', gradeIndex: null },
        { criterion: 'net', gradeIndex: null },
        { criterion: 'defense', gradeIndex: null },
        { criterion: 'tactics', gradeIndex: null },
        { criterion: 'consistency', gradeIndex: null },
      ],
      sixCriteria,
    );
    expect(allNull).toEqual({ abstained: true, overall: null });
  });

  it('validates rubric', () => {
    expect(() => reviewerScore([], [])).toThrow('RUBRIC_INVALID');
    expect(() =>
      reviewerScore([], [
        { key: 'a', weight: 1 },
        { key: 'a', weight: 1 },
      ]),
    ).toThrow('RUBRIC_INVALID');
    expect(() => reviewerScore([], [{ key: 'a', weight: 0 }])).toThrow('RUBRIC_INVALID');
    expect(() => reviewerScore([], [{ key: 'a', weight: NaN }])).toThrow('RUBRIC_INVALID');
  });

  it('validates scores', () => {
    expect(() =>
      reviewerScore(
        [{ criterion: 'unknown', gradeIndex: 6 }],
        [{ key: 'footwork', weight: 1 }],
      ),
    ).toThrow('REVIEW_UNKNOWN_CRITERION');

    expect(() =>
      reviewerScore(
        [{ criterion: 'footwork', gradeIndex: 6 }],
        [{ key: 'footwork', weight: 1 }],
      ),
    ).not.toThrow(); // valid

    expect(() =>
      reviewerScore(
        [
          { criterion: 'footwork', gradeIndex: 6 },
          { criterion: 'footwork', gradeIndex: 7 },
        ],
        [{ key: 'footwork', weight: 1 }],
      ),
    ).toThrow('REVIEW_DUPLICATE_CRITERION');

    expect(() =>
      reviewerScore(
        [{ criterion: 'footwork', gradeIndex: 15 }],
        [{ key: 'footwork', weight: 1 }],
      ),
    ).toThrow('REVIEW_INVALID_GRADE');

    expect(() =>
      reviewerScore([{ criterion: 'footwork', gradeIndex: -1 }], [{ key: 'footwork', weight: 1 }]),
    ).toThrow('REVIEW_INVALID_GRADE');

    expect(() =>
      reviewerScore([], [
        { key: 'footwork', weight: 1 },
        { key: 'overhead', weight: 1 },
      ]),
    ).toThrow('REVIEW_MISSING_CRITERION');
  });
});
