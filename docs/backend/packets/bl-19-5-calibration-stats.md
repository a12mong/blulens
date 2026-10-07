PACKET bl-19-5: calibrationStats (shared, pure)

Assignee: Meredith (meredith-muxtbonw) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)

GOAL:
  Measure one reviewer's bias against the Committee's reference grades on calibration clips (grading v2, G19b):
  mean signed error and mean absolute error, in ladder units.

STATE:
  Your worktree: D:/_work/SourceDev/_harness/blulens/worktrees/meredith-muxtbonw
  Branch: dev/bl-19-calibration-stats from origin/develop
    git fetch origin && git switch -c dev/bl-19-calibration-stats origin/develop
  Already exists: packages/shared/src/grading/{outliers,cohen-kappa,index}.ts (your projectGrade branch is in review;
  this packet does NOT need it).
  Depends on (merged): none

SOURCES (owner-approved grading.md v2 §12.4 + G19 option (b); openapi /calibration-sets/{setId}/results):
  - "The Committee fixes reference grades for a set of clips; every reviewer rates the set (e.g. 5 clips per quarter)
     -> bias against the central standard, even with few shared cases."
  - biasVsReference = mean(overall − (idx(ref) + 0.5))      (a chosen rung i counts as i + 0.5 — grading §2)
  - meanAbsError    = mean(|overall − (idx(ref) + 0.5)|)
  - overall = the reviewer's per-review score v_j in ladder units [0, 15); ref = Committee reference rung index 0..14.
  - Bias never changes player scores automatically (G5/G19): this is reporting only.

SPEC:
  Files to create/touch (ONLY these 3):
    - packages/shared/src/grading/calibration.ts
    - packages/shared/src/grading/calibration.test.ts
    - packages/shared/src/grading/index.ts   (append exactly one line: export * from './calibration';)
  Types + signature (exact, export both):
    export interface CalibrationItem { overall: number; referenceIndex: number }
    export interface CalibrationStats { n: number; bias: number | null; meanAbsError: number | null }
    export function calibrationStats(items: readonly CalibrationItem[]): CalibrationStats
  Behaviour:
    1. Each item: overall finite and in [0, 15); referenceIndex an integer 0..14 — else RangeError('CALIBRATION_INVALID_ITEM').
    2. n = items.length; n === 0 -> { n: 0, bias: null, meanAbsError: null }.
    3. d_k = overall_k − (referenceIndex_k + 0.5); bias = mean(d); meanAbsError = mean(|d|). No rounding.
  Edge cases (expected):
    - [{overall 7.5, ref 7}, {9.0, 7}, {6.5, 7}] -> d = 0, 1.5, -1 -> n 3, bias toBeCloseTo(0.5/3, 10), meanAbsError toBeCloseTo(2.5/3, 10)
    - [{10.5, 7}]                               -> n 1, bias 3, meanAbsError 3
    - [{7.5, 7}, {8.5, 8}]                       -> bias 0, meanAbsError 0 (perfectly calibrated)
    - [{5.5, 7}, {9.5, 7}]                       -> bias 0, meanAbsError 2 (unbiased but noisy: the two numbers must differ)
    - []                                         -> { n: 0, bias: null, meanAbsError: null }
    - {15, 7}, {7.5, 15}, {7.5, 2.5}, {NaN, 7}   -> RangeError
  Pure: no Date, no Math.random, no I/O. Do not mutate the input.

CONSTRAINTS: only the 3 files; no new deps; no `any`; conventional commits (feat(shared): add calibrationStats); push.
TOOLS: pnpm --filter @blulens/shared exec vitest run src/grading/calibration.test.ts · pnpm --filter @blulens/shared exec vitest run · pnpm --filter @blulens/shared lint

DONE (the single proving test):
  File: packages/shared/src/grading/calibration.test.ts
  Test name: "computes bias and mean absolute error against the reference rung centre"
  Asserts: the first four edge cases exactly. Empty input and RangeErrors in further `it` blocks.
  Report back (act=done to kevin-muxsqdkp): branch, commit, `git diff --stat origin/develop...HEAD`, commands + real output.
  Merge note: Creed's fleiss and your projectGrade also append to grading/index.ts — Kevin resolves that at merge.
