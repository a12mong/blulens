PACKET bl-19-6: aggregateAssessment (shared, pure) — grading v1 + v2 few-reviewer paths

Assignee: first free of Creed / Meredith · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)

GOAL:
  Turn the valid per-reviewer scores of one assessment into the stored result: status, score, margin, the bad8bit-shaped
  grade, flags. One pure function, covering n = 1 (provisional), n = 2 (pair rule) and n >= 3 (v1 pipeline).

STATE:
  Your worktree. Branch dev/bl-19-aggregate from origin/develop (8eceaab or later).
  Already MERGED (import, never re-implement): grading/outliers.ts (detectOutliers), grading/project-grade.ts
  (projectGrade -> GradeView), grading/grades.ts.

SOURCES (owner-approved grading.md v1 appendix B.2-B.5 + v2 §12.1, verbatim rules):
  Path by n = number of valid reviewer scores v (abstained reviews are already excluded by the caller):
    n < minReviewers           -> status 'needs_reviewers', grade null (G15: no numbers that do not exist)
    n = 1                      -> score = v1, margin = 1.0, status 'provisional', flag SINGLE_REVIEWER
    n = 2                      -> score = mean, NO outlier rule, margin = max(0.5, |v1 − v2| / 2 + 0.25);
                                  |v1 − v2| > 2.0 (strict; 2.0 exactly is NOT) -> 'disputed' + flag PAIR_DISAGREEMENT
                                  + suggestThirdReviewer true; else 'pending_approval'; spread = |v1 − v2|
    n >= 3 (v1, unchanged)     -> detectOutliers(v); K = not excluded;
                                  |K| < 3 -> 'needs_reviewers' (grade null; flag OUTLIER_EXCLUDED if any excluded)
                                  score = mean(K); s = sample SD (divide by n−1); m = clamp(t(0.90, |K|−1) × s / √|K|, 0.25, 3.0)
                                  spread = max(K) − min(K); disputed <=> spread > 3.0 or m > 1.5 (strict) else pending_approval
                                  flags: OUTLIER_EXCLUDED (>= 1 excluded), HIGH_DISAGREEMENT (disputed), LOW_RATER_COUNT (|K| = 3)
  t(0.90, df) two-sided 80% table (use exactly): df 1 3.078 · 2 1.886 · 3 1.638 · 4 1.533 · 5 1.476 · 6 1.440 · 7 1.415 ·
    8 1.397 · 9 1.383 · 10 1.372 · 11 1.363 · 12 1.356 · 13 1.350 · 14 1.345 · 15 1.341 · 16 1.337 · 17 1.333 · 18 1.330 ·
    19 1.328 · 20 1.325 · 21 1.323 · 22 1.321 · 23 1.319 · 24 1.318 · 25 1.316 · 26 1.315 · 27 1.314 · 28 1.313 · 29 1.311 · >= 30 1.310
  grade = projectGrade(score, margin) whenever there is a score.
  Use epsilon 1e-9 for the strict comparisons (> 2.0, > 3.0, > 1.5), same as OUTLIER_EPSILON.

SPEC:
  Files (ONLY these 3): packages/shared/src/grading/aggregate.ts, aggregate.test.ts, grading/index.ts (+ export * from './aggregate';)
  Exports (exact):
    export type AggregateStatus = 'needs_reviewers' | 'provisional' | 'pending_approval' | 'disputed';
    export type ResultFlag = 'SINGLE_REVIEWER' | 'PAIR_DISAGREEMENT' | 'OUTLIER_EXCLUDED' | 'HIGH_DISAGREEMENT' | 'LOW_RATER_COUNT';
    export interface AggregateResult {
      status: AggregateStatus;
      score: number | null; margin: number | null; grade: GradeView | null;
      nRaters: number;            // scores used (|K| for n >= 3, else n)
      nExcluded: number;          // outliers excluded (0 for n <= 2)
      excludedIndexes: number[];  // indexes into the input
      spread: number | null;
      flags: ResultFlag[];        // sorted alphabetically
      suggestThirdReviewer: boolean;
    }
    export function aggregateAssessment(scores: readonly number[], minReviewers: number): AggregateResult
  Validation: minReviewers integer 1..5 else RangeError('GRADING_INVALID_MIN_REVIEWERS'); scores finite in [0, 15) else
    RangeError('GRADING_INVALID_SCORE'). Empty scores -> needs_reviewers (not an error).
  Fixtures (grading.md appendix C and §12.5; must reproduce EXACTLY; Kevin re-derived every row by hand):
    v1, minReviewers 3:
      C.1 [7.50, 7.50, 7.83]        -> pending_approval, score ~7.61, margin 0.25, label 'S', flags ['LOW_RATER_COUNT']
      C.2 [7.50, 7.50, 8.50]        -> pending_approval, margin ~0.6287 (toBeCloseTo 3), label 'S/S+'
      C.3 [7.50, 7.83, 8.17, 11.00] -> pending_approval, excludedIndexes [3], score ~7.833, label 'S/S+', flags ['LOW_RATER_COUNT','OUTLIER_EXCLUDED']
      C.4 [6.50, 7.50, 9.50]        -> disputed, margin ~1.664, label 'S-–N-', flags ['HIGH_DISAGREEMENT','LOW_RATER_COUNT']
      C.5 [7.50, 7.50, 11.50]       -> needs_reviewers, grade null, excludedIndexes [2], flags ['OUTLIER_EXCLUDED']
    v2 §12.5 (minReviewers 1 for the first row, 2 for the rest):
      [7.83]        -> provisional, margin 1.0, label 'S-–S+', flags ['SINGLE_REVIEWER']
      [7.50, 7.50]  -> pending_approval, score 7.5,   margin 0.5,  label 'S'
      [7.50, 7.83]  -> pending_approval, score 7.665, margin 0.5,  label 'S/S+'
      [7.50, 8.50]  -> pending_approval, score 8.0,   margin 0.75, label 'S/S+'
      [6.50, 8.50]  -> pending_approval, score 7.5,   margin 1.25, label 'S-–S+'   (gap 2.0 is NOT > 2.0)
      [6.50, 9.00]  -> disputed, score 7.75, margin 1.5, label 'S-–N-', flags ['PAIR_DISAGREEMENT'], suggestThirdReviewer true
    Also: [7.5] with minReviewers 2 -> needs_reviewers; [] -> needs_reviewers; order independence (shuffle input -> same
    status/score/margin/label) for C.3; minReviewers 0 / 6 -> RangeError.
  OPEN QUESTION already sent to Jim (do not decide yourself): n >= 3 with an outlier leaving |K| = 2 when minReviewers = 2.
    Implement the v1 rule above (needs_reviewers); Kevin will tell you if Jim changes it.
  Pure: no Date, no Math.random, no I/O.

CONSTRAINTS: only the 3 files; no new deps; no `any`; call detectOutliers and projectGrade (no copies); conventional commits; push.
TOOLS: pnpm --filter @blulens/shared exec vitest run src/grading/aggregate.test.ts · pnpm --filter @blulens/shared exec vitest run · pnpm --filter @blulens/shared lint
DONE (single proving test): aggregate.test.ts, test "reproduces grading.md appendix C and §12.5 exactly", asserting all 11 fixture rows.
  Report: branch, commit, `git diff --stat origin/develop...HEAD`, commands + real output.
