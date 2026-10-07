export interface RubricCriterion {
  key: string;
  weight: number;
}

export interface CriterionScore {
  criterion: string;
  gradeIndex: number | null; // null = cannot assess
}

export type ReviewerScore = { abstained: false; overall: number } | { abstained: true; overall: null };

export function reviewerScore(scores: readonly CriterionScore[], rubric: readonly RubricCriterion[]): ReviewerScore {
  // Validate rubric
  if (rubric.length === 0) {
    throw new RangeError('RUBRIC_INVALID');
  }

  const keys = new Set<string>();
  let totalWeight = 0;
  for (const crit of rubric) {
    if (keys.has(crit.key)) {
      throw new RangeError('RUBRIC_INVALID');
    }
    if (!Number.isFinite(crit.weight) || crit.weight <= 0) {
      throw new RangeError('RUBRIC_INVALID');
    }
    keys.add(crit.key);
    totalWeight += crit.weight;
  }

  // Validate scores
  const scoreMap = new Map<string, number | null>();
  for (const score of scores) {
    if (!keys.has(score.criterion)) {
      throw new RangeError('REVIEW_UNKNOWN_CRITERION');
    }
    if (scoreMap.has(score.criterion)) {
      throw new RangeError('REVIEW_DUPLICATE_CRITERION');
    }
    if (score.gradeIndex !== null) {
      if (!Number.isInteger(score.gradeIndex) || score.gradeIndex < 0 || score.gradeIndex > 14) {
        throw new RangeError('REVIEW_INVALID_GRADE');
      }
    }
    scoreMap.set(score.criterion, score.gradeIndex);
  }

  // Check all rubric keys are scored
  for (const key of keys) {
    if (!scoreMap.has(key)) {
      throw new RangeError('REVIEW_MISSING_CRITERION');
    }
  }

  // Calculate assessed weight and overall score
  let assessedWeight = 0;
  let weightedSum = 0;

  for (const crit of rubric) {
    const gradeIndex = scoreMap.get(crit.key);
    if (gradeIndex !== null) {
      const x_jc = gradeIndex! + 0.5;
      assessedWeight += crit.weight;
      weightedSum += crit.weight * x_jc;
    }
  }

  // Check if abstention (assessed weight < 0.5 * total weight, strictly less than)
  if (assessedWeight < 0.5 * totalWeight) {
    return { abstained: true, overall: null };
  }

  // Calculate overall score
  const overall = weightedSum / assessedWeight;
  return { abstained: false, overall };
}
