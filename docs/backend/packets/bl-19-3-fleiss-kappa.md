PACKET bl-19-3: fleissKappa (shared, pure)

Assignee: Creed (creed-muxswjfu) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)

GOAL:
  Fleiss' kappa for a panel where each case may have a different number of raters, returning null when it is
  undefined (G12), plus the number of cases used.

STATE:
  Your own worktree only. Branch: dev/bl-19-fleiss-kappa from origin/develop (d7de1b9 or later; it already has
  grading/outliers.ts, grading/cohen-kappa.ts and grading/index.ts).
    git fetch origin && git switch -c dev/bl-19-fleiss-kappa origin/develop
  Already exists (do not rewrite): packages/shared/src/grading/{outliers,cohen-kappa,index}.ts
  Depends on (merged): bl-19-2 (merged d7de1b9)

SOURCES (owner-approved grading.md v1, G6 + G12, appendix B.7, verbatim):
  - Category of a review = its tier 0..4 (the caller maps ladder values; this function takes categories).
  - Case i has n_i >= 2 raters; n_ij = number of raters who gave category j.
  - P_i = Σ_j n_ij (n_ij − 1) / (n_i (n_i − 1))     · P̄ = mean(P_i)
  - p_j = Σ_i n_ij / Σ_i n_i                         · P̄_e = Σ_j p_j²
  - κ = (P̄ − P̄_e) / (1 − P̄_e)
  - 1 − P̄_e = 0 (everyone used one category) -> undefined -> null (G12, never 1.0).
  Sibling pattern: packages/shared/src/grading/cohen-kappa.ts (same validation style and RangeError codes).

SPEC:
  Files to create/touch (ONLY these 3):
    - packages/shared/src/grading/fleiss-kappa.ts
    - packages/shared/src/grading/fleiss-kappa.test.ts
    - packages/shared/src/grading/index.ts   (append exactly one line: export * from './fleiss-kappa';)
  Types + signature (exact, export both):
    export interface FleissResult { kappa: number | null; cases: number }
    /** Each case is the list of category ratings given to that case (one number per rater). */
    export function fleissKappa(cases: readonly (readonly number[])[], categories = 5): FleissResult
  Behaviour:
    1. categories must be an integer >= 2, else RangeError('KAPPA_INVALID_CATEGORIES').
    2. Every rating must be an integer in [0, categories - 1], else RangeError('KAPPA_INVALID_RATING').
    3. Cases with fewer than 2 ratings are skipped (not an error). cases = number of cases used.
    4. cases === 0 -> { kappa: null, cases: 0 }.
    5. Compute exactly the formula; if 1 − P̄_e === 0 -> kappa null. No rounding.
  Edge cases (expected; computed by Kevin by hand and with an independent script):
    - WIKI: the Wikipedia "Fleiss' kappa" worked example (10 cases × 14 raters, 5 categories). Counts per case
      (categories 0..4) — expand each row into a ratings list in the test with a small helper:
        [0,0,0,0,14] [0,2,6,4,2] [0,0,3,5,6] [0,3,9,2,0] [2,2,8,1,1]
        [7,7,0,0,0] [3,2,6,3,0] [2,5,3,2,2] [6,5,2,1,0] [0,2,2,3,7]
      -> kappa toBeCloseTo(0.20993070442195522, 10), cases 10
    - UNEQUAL: [[0,0,1],[2,2],[1,1,1,1]] -> kappa toBeCloseTo(0.625, 10) (= 5/8), cases 3
    - SKIP:    [[0,0,1],[3],[2,2],[1,1,1,1]] -> same as UNEQUAL, cases 3 (the 1-rating case is skipped)
    - ALLSAME: [[2,2],[2,2,2]] -> { kappa: null, cases: 2 }
    - PERFECT: [[0,0],[4,4,4],[2,2]] -> kappa 1, cases 3
    - NONE:    [[1],[2]] and [] -> { kappa: null, cases: 0 }
    - [[0,5]] with categories 5 / [[0.5,1]] / categories 1 -> RangeError
    - order independence: shuffling the cases or the ratings inside a case gives the same kappa (test on WIKI)
  Pure: no Date, no Math.random, no I/O.

CONSTRAINTS:
  - Touch only the 3 files listed. No new dependencies. No `any`.
  - Conventional commits (feat(shared): add Fleiss kappa for the rater panel). Push your branch.

TOOLS (from your worktree root):
  pnpm install --frozen-lockfile
  pnpm --filter @blulens/shared exec vitest run src/grading/fleiss-kappa.test.ts
  pnpm --filter @blulens/shared exec vitest run
  pnpm --filter @blulens/shared lint

DONE (the single proving test):
  File: packages/shared/src/grading/fleiss-kappa.test.ts
  Test name: "reproduces the Wikipedia example and the hand-computed panels, null when undefined"
  Asserts: WIKI, UNEQUAL, SKIP, ALLSAME, PERFECT, NONE exactly as listed. Others in further `it` blocks.
  Report back (act=done to kevin-muxsqdkp): branch, commit hash, `git diff --stat origin/develop...HEAD`,
  exact commands + real output (pass/fail counts), anything unverified, anything left open.
