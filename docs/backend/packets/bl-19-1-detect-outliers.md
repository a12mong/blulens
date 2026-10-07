PACKET bl-19-1: detectOutliers (shared, pure)

Assignee: Meredith (meredith-muxtbonw) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)

GOAL:
  Given the per-reviewer scores of one assessment (ladder units), report the median, MAD, each reviewer's
  robust z-score and which reviewers are outliers to exclude. Flags only: no averaging, no status.

STATE:
  Your worktree: D:/_work/SourceDev/_harness/blulens/worktrees/meredith-muxtbonw
  Branch to create (from origin/develop, which now has the draw foundation + your bracketOrder):
    git fetch origin && git switch -c dev/bl-19-detect-outliers origin/develop
  Already exists (do not rewrite): packages/shared/src/draw/** , packages/shared/src/index.ts
  Depends on (merged): none. There is no grading/ folder yet; you create it.

SOURCES (owner-approved grading.md v1, G8 + G14, appendix B.2, verbatim):
  - Applies to the valid reviews of one assessment, n >= 3.
  - M = median(v) · MAD = median(|v_j - M|)
  - z_j = 0.6745 × (v_j - M) / MAD   (if MAD = 0, z is undefined)
  - j is an outlier  <=>  |v_j - M| > 2.0  AND  (MAD = 0  OR  |z_j| > 3.5)
    ("> 2.0" is strict: a deviation of exactly 2.0 is NOT an outlier)
  - Exclude at most E_max = 1 when n < 8, otherwise floor(n/4), excluding in order of |v_j - M| descending.
  - Bipolar split (e.g. 2 vs 2): nobody is excluded (the case then usually becomes disputed elsewhere).
  Median of an even count = mean of the two middle values.
  Worked examples (grading.md appendix C), must reproduce exactly:
    C.1 v = 7.50, 7.50, 7.83          -> M 7.50, MAD 0,     no outlier
    C.3 v = 7.50, 7.83, 8.17, 11.00   -> M 8.00, MAD 0.335, z(11.00) = 6.04 -> exclude index 3
    C.4 v = 6.50, 7.50, 9.50          -> M 7.50, MAD 1,     no outlier (max deviation 2.0 is not > 2.0)
    C.5 v = 7.50, 7.50, 11.50         -> M 7.50, MAD 0,     exclude index 2
  Sibling pattern (style, JSDoc, RangeError): packages/shared/src/draw/prng.ts

SPEC:
  Files to create/touch (ONLY these 4):
    - packages/shared/src/grading/outliers.ts
    - packages/shared/src/grading/outliers.test.ts
    - packages/shared/src/grading/index.ts      (new file, exactly: export * from './outliers';)
    - packages/shared/src/index.ts              (append exactly one line: export * from './grading';)
  Types + signature (exact, export all):
    export const OUTLIER_MIN_DEVIATION = 2.0;
    export const OUTLIER_MIN_ROBUST_Z = 3.5;
    /** Float tolerance for the strict comparisons above (2-decimal inputs). */
    export const OUTLIER_EPSILON = 1e-9;
    export interface OutlierItem {
      index: number;            // position in the input array
      value: number;
      deviation: number;        // |value - median|
      robustZ: number | null;   // null when MAD = 0
      candidate: boolean;       // passes the outlier test before the E_max cap
      excluded: boolean;        // candidate AND within the E_max cap
    }
    export interface OutlierReport {
      n: number;
      median: number;
      mad: number;
      maxExclusions: number;    // E_max (0 when n < 3)
      items: OutlierItem[];     // same order as the input
      excludedIndexes: number[];// ascending
    }
    export function detectOutliers(values: readonly number[]): OutlierReport
  Behaviour:
    1. Any value not finite -> throw new RangeError('GRADING_INVALID_SCORE'). Empty array -> RangeError('GRADING_NO_SCORES').
    2. median and mad as defined (sort a COPY numerically; never mutate the input).
    3. robustZ = mad === 0 ? null : 0.6745 * (value - median) / mad.
    4. candidate = n >= 3
                   && deviation > OUTLIER_MIN_DEVIATION + OUTLIER_EPSILON
                   && (mad === 0 || Math.abs(robustZ) > OUTLIER_MIN_ROBUST_Z + OUTLIER_EPSILON)
       For n < 3 nothing is a candidate (few-reviewer rules are grading v2, not this packet).
    5. maxExclusions = n < 3 ? 0 : n < 8 ? 1 : Math.floor(n / 4).
    6. Sort candidates by deviation descending, ties by index ascending; the first maxExclusions are excluded.
  Edge cases (expected):
    - the 4 worked examples above (compare floats with toBeCloseTo(x, 3) for median/mad/robustZ)
    - [5.0, 7.0, 7.5, 8.0, 10.0] -> M 7.5, MAD 0.5, robustZ(5.0) = -3.3725: deviation 2.5 > 2 but |z| <= 3.5 -> nothing excluded
    - [7.5, 7.5, 7.5, 11.5, 3.0] -> MAD 0, candidates indexes 3 and 4, cap 1 -> excludedIndexes [4] (deviation 4.5 > 4.0)
    - [7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 12.0, 2.0] (n = 8, cap 2) -> excludedIndexes [6, 7]
    - [6.5, 6.5, 9.5, 9.5] (bipolar) -> nothing excluded
    - [7.3, 9.3, 7.3] -> nothing excluded (in floating point 9.3 - 7.3 = 2.000000000000001, which would wrongly pass a plain > 2.0 test; the epsilon fixes that)
    - [7.5, 11.5] (n = 2) -> no candidates, maxExclusions 0
    - [], [NaN, 1, 2] -> RangeError
  Pure: no Date, no Math.random, no I/O. Do not mutate the input array.

CONSTRAINTS:
  - Touch only the 4 files listed. No new dependencies. No `any`.
  - Conventional commits (feat(shared): add detectOutliers for grading v1). Push your branch to origin.

TOOLS (from your worktree root):
  pnpm install --frozen-lockfile
  pnpm --filter @blulens/shared exec vitest run src/grading/outliers.test.ts
  pnpm --filter @blulens/shared exec vitest run
  pnpm --filter @blulens/shared lint

DONE (the single proving test):
  File: packages/shared/src/grading/outliers.test.ts
  Test name: "reproduces grading.md appendix C outlier decisions exactly"
  Asserts: for C.1, C.3, C.4, C.5 -> excludedIndexes exactly [], [3], [], [2]; C.3 median 8.00, mad 0.335,
           robustZ of index 3 toBeCloseTo(6.04, 2). Other edge cases go in further `it` blocks in the same file.
  Report back (act=done to kevin-muxsqdkp): branch, commit hash, `git diff --stat origin/develop`, the exact
  commands run and their real output (pass/fail counts), anything unverified, anything left open.
