PACKET bl-19-7: reviewerScore (shared, pure) — one reviewer's v_j from rubric scores

Assignee: first free dev · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)

GOAL:
  Convert one submitted review (a ladder rung per rubric criterion, or "cannot assess") into the reviewer's overall score
  v_j, or mark the review as an abstention. aggregateAssessment (bl-19-6) consumes these v_j values.

STATE:
  Your worktree. Branch dev/bl-19-reviewer-score from origin/develop. Pure shared code, no DB.
  Already merged: grading/{outliers, cohen-kappa, fleiss-kappa, grades, project-grade, calibration}.ts.

SOURCES (owner-approved grading.md v1 §3 + appendix B.1, verbatim):
  - "A criterion that cannot be judged from the clip is marked 'cannot assess' -> not counted for that reviewer
     (the remaining weights are re-normalised)."
  - "If the 'cannot assess' criteria hold MORE than half of the total weight -> the review is an abstention and
     is not used; another reviewer is needed."
  - x_jc = idx(k_jc) + 0.5 for assessed criteria · A_j = assessed criteria ·
    if Σ_{c∈A_j} w_c < 0.5 × Σ_{c∈C} w_c -> abstention · v_j = Σ_{c∈A_j} w_c · x_jc / Σ_{c∈A_j} w_c
  (Exactly half assessed is NOT an abstention: the test is strictly less than half.)

SPEC:
  Files (ONLY these 3): packages/shared/src/grading/reviewer-score.ts, reviewer-score.test.ts,
    grading/index.ts (+ export * from './reviewer-score';)
  Exports (exact):
    export interface RubricCriterion { key: string; weight: number }
    export interface CriterionScore { criterion: string; gradeIndex: number | null }   // null = cannot assess
    export type ReviewerScore = { abstained: false; overall: number } | { abstained: true; overall: null };
    export function reviewerScore(scores: readonly CriterionScore[], rubric: readonly RubricCriterion[]): ReviewerScore
  Validation (RangeError with these messages):
    - rubric empty, a duplicate key, or a weight that is not finite and > 0 -> 'RUBRIC_INVALID'
    - a score for a key not in the rubric -> 'REVIEW_UNKNOWN_CRITERION'
    - a rubric key without a score, or a key scored twice -> 'REVIEW_MISSING_CRITERION' / 'REVIEW_DUPLICATE_CRITERION'
    - gradeIndex not null and not an integer 0..14 -> 'REVIEW_INVALID_GRADE'
  Edge cases (expected; equal weights = the six grading-v1 criteria footwork, overhead, net, defense, tactics, consistency, weight 1):
    - all six at 7 (S)                         -> { abstained: false, overall: 7.5 }
    - five at 7, one at 8                      -> overall toBeCloseTo((5 * 7.5 + 8.5) / 6, 10)   (= 7.6667)
    - three null, three at 9 (N-)              -> overall 9.5   (exactly half assessed: NOT an abstention)
    - four null, two at 9                      -> { abstained: true, overall: null }
    - weights footwork 2, others 1; footwork 9, others 7 -> overall toBeCloseTo((2 * 9.5 + 5 * 7.5) / 7, 10)  (= 8.0714)
    - weights footwork 2, others 1; footwork null, others 7 -> Σw(A) = 5 >= 0.5 × 7 = 3.5 -> overall 7.5
    - all null                                 -> abstained
    - order of `scores` does not matter (shuffle -> same result)
  Pure: no Date, no Math.random, no I/O.

CONSTRAINTS: only the 3 files; no new deps; no `any`; conventional commits (feat(shared): add reviewerScore); push.
TOOLS: pnpm --filter @blulens/shared exec vitest run src/grading/reviewer-score.test.ts · pnpm --filter @blulens/shared exec vitest run · pnpm --filter @blulens/shared lint
DONE (single proving test): reviewer-score.test.ts, test "computes v_j over assessed criteria and abstains when more than half the weight is missing",
  asserting the first four edge cases exactly. Report: branch, commit, `git diff --stat origin/develop...HEAD`, commands + real output.
