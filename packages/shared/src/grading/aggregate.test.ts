import { describe, it, expect } from 'vitest';
import { aggregateAssessment } from './aggregate';

describe('aggregateAssessment', () => {
  it('reproduces grading.md appendix C and §12.5 exactly', () => {
    // v1, minReviewers 3

    // C.1: [7.50, 7.50, 7.83]
    const c1 = aggregateAssessment([7.5, 7.5, 7.83], 3);
    expect(c1.status).toBe('pending_approval');
    expect(c1.score).toBeCloseTo(7.61, 1);
    expect(c1.margin).toBe(0.25);
    expect(c1.grade?.label).toBe('S');
    expect(c1.flags).toEqual(['LOW_RATER_COUNT']);

    // C.2: [7.50, 7.50, 8.50]
    const c2 = aggregateAssessment([7.5, 7.5, 8.5], 3);
    expect(c2.status).toBe('pending_approval');
    expect(c2.score).toBeCloseTo(7.833, 2);
    expect(c2.margin).toBeCloseTo(0.6287, 3);
    expect(c2.grade?.label).toBe('S/S+');
    expect(c2.flags).toEqual(['LOW_RATER_COUNT']);

    // C.3: [7.50, 7.83, 8.17, 11.00]
    const c3 = aggregateAssessment([7.5, 7.83, 8.17, 11.0], 3);
    expect(c3.status).toBe('pending_approval');
    expect(c3.excludedIndexes).toEqual([3]);
    expect(c3.score).toBeCloseTo(7.833, 2);
    expect(c3.grade?.label).toBe('S/S+');
    expect(c3.flags).toEqual(['LOW_RATER_COUNT', 'OUTLIER_EXCLUDED']);

    // C.4: [6.50, 7.50, 9.50]
    const c4 = aggregateAssessment([6.5, 7.5, 9.5], 3);
    expect(c4.status).toBe('disputed');
    expect(c4.margin).toBeCloseTo(1.664, 2);
    expect(c4.grade?.label).toBe('S-–N-');
    expect(c4.flags).toEqual(['HIGH_DISAGREEMENT', 'LOW_RATER_COUNT']);

    // C.5: [7.50, 7.50, 11.50]
    const c5 = aggregateAssessment([7.5, 7.5, 11.5], 3);
    expect(c5.status).toBe('needs_reviewers');
    expect(c5.grade).toBeNull();
    expect(c5.excludedIndexes).toEqual([2]);
    expect(c5.flags).toEqual(['OUTLIER_EXCLUDED']);

    // Jim's routing fixture: [7.50, 7.50, 11.50] with minReviewers 2
    const jim2 = aggregateAssessment([7.5, 7.5, 11.5], 2);
    expect(jim2.status).toBe('pending_approval');
    expect(jim2.score).toBe(7.5);
    expect(jim2.margin).toBe(0.5);
    expect(jim2.grade?.label).toBe('S');
    expect(jim2.nRaters).toBe(2);
    expect(jim2.nExcluded).toBe(1);
    expect(jim2.excludedIndexes).toEqual([2]);
    expect(jim2.flags).toEqual(['OUTLIER_EXCLUDED']);

    // v2, §12.5

    // [7.83] with minReviewers 1
    const v2_1 = aggregateAssessment([7.83], 1);
    expect(v2_1.status).toBe('provisional');
    expect(v2_1.margin).toBe(1.0);
    expect(v2_1.grade?.label).toBe('S-–S+');
    expect(v2_1.flags).toEqual(['SINGLE_REVIEWER']);

    // [7.50, 7.50] with minReviewers 2
    const v2_2 = aggregateAssessment([7.5, 7.5], 2);
    expect(v2_2.status).toBe('pending_approval');
    expect(v2_2.score).toBe(7.5);
    expect(v2_2.margin).toBe(0.5);
    expect(v2_2.grade?.label).toBe('S');

    // [7.50, 7.83] with minReviewers 2
    const v2_3 = aggregateAssessment([7.5, 7.83], 2);
    expect(v2_3.status).toBe('pending_approval');
    expect(v2_3.score).toBeCloseTo(7.665, 2);
    expect(v2_3.margin).toBe(0.5);
    expect(v2_3.grade?.label).toBe('S/S+');

    // [7.50, 8.50] with minReviewers 2
    const v2_4 = aggregateAssessment([7.5, 8.5], 2);
    expect(v2_4.status).toBe('pending_approval');
    expect(v2_4.score).toBe(8.0);
    expect(v2_4.margin).toBe(0.75);
    expect(v2_4.grade?.label).toBe('S/S+');

    // [6.50, 8.50] with minReviewers 2 (gap 2.0 is NOT > 2.0)
    const v2_5 = aggregateAssessment([6.5, 8.5], 2);
    expect(v2_5.status).toBe('pending_approval');
    expect(v2_5.score).toBe(7.5);
    expect(v2_5.margin).toBe(1.25);
    expect(v2_5.grade?.label).toBe('S-–S+');

    // [6.50, 9.00] with minReviewers 2
    const v2_6 = aggregateAssessment([6.5, 9.0], 2);
    expect(v2_6.status).toBe('disputed');
    expect(v2_6.score).toBe(7.75);
    expect(v2_6.margin).toBe(1.5);
    expect(v2_6.grade?.label).toBe('S-–N-');
    expect(v2_6.flags).toEqual(['PAIR_DISAGREEMENT']);
    expect(v2_6.suggestThirdReviewer).toBe(true);
  });

  it('validates minReviewers and scores', () => {
    expect(() => aggregateAssessment([7.5], 0)).toThrow('GRADING_INVALID_MIN_REVIEWERS');
    expect(() => aggregateAssessment([7.5], 6)).toThrow('GRADING_INVALID_MIN_REVIEWERS');
    expect(() => aggregateAssessment([7.5, 15], 2)).toThrow('GRADING_INVALID_SCORE');
    expect(() => aggregateAssessment([7.5, NaN], 2)).toThrow('GRADING_INVALID_SCORE');
  });

  it('handles edge cases', () => {
    // [7.5] with minReviewers 2 -> needs_reviewers
    const e1 = aggregateAssessment([7.5], 2);
    expect(e1.status).toBe('needs_reviewers');
    expect(e1.grade).toBeNull();

    // [] -> needs_reviewers
    const e2 = aggregateAssessment([], 2);
    expect(e2.status).toBe('needs_reviewers');
    expect(e2.nRaters).toBe(0);

    // Order independence: shuffle C.3 [7.50, 7.83, 8.17, 11.00]
    const shuffled = aggregateAssessment([11.0, 7.5, 8.17, 7.83], 3);
    expect(shuffled.status).toBe('pending_approval');
    expect(shuffled.score).toBeCloseTo(7.833, 2);
    expect(shuffled.excludedIndexes).toEqual([0]); // position of 11.0 in shuffled order
  });
});
