PACKET bl-19-2: cohenKappaQuadratic (shared, pure)

Assignee: Creed (creed-muxswjfu) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)

GOAL:
  Quadratic-weighted Cohen's kappa for two raters over a set of shared cases, returning null when it is
  mathematically undefined (owner decision G12: never show 1.0 for "everyone gave the same category").

STATE:
  Worktree: create your own (never use the shared folder D:/_work/SourceDev/_code/blulens):
    git -C D:/_work/SourceDev/_code/blulens fetch origin
    git -C D:/_work/SourceDev/_code/blulens worktree add D:/_work/SourceDev/_code/blulens-creed-bl19 -b dev/bl-19-cohen-kappa origin/develop
    (or reuse your existing worktree: git fetch origin && git switch -c dev/bl-19-cohen-kappa origin/develop)
  Branch: dev/bl-19-cohen-kappa from origin/develop
  Already exists (do not rewrite): packages/shared/src/draw/**. Meredith is creating packages/shared/src/grading/
    (outliers.ts + grading/index.ts) on another branch at the same time; see SPEC for how to avoid a clash.
  Depends on (merged): none

SOURCES (owner-approved grading.md v1, G6 + G12, appendix B.6, verbatim):
  - Categories 0..k-1 (k = 15 for the grade ladder).
  - N shared cases; O_ij = proportion of cases where rater A gave category i and rater B gave category j.
  - r_i = Σ_j O_ij,  c_j = Σ_i O_ij,  E_ij = r_i × c_j
  - w_ij = (i − j)² / (k − 1)²
  - κ_w = 1 − (Σ_ij w_ij O_ij) / (Σ_ij w_ij E_ij)
  - If the denominator is 0 (e.g. every rating in one category) -> "undefined" -> return null (G12).
  (Choosing which cases, minimum counts and labels such as "moderate" happen in the stats layer, NOT in this packet.)
  Sibling pattern: packages/shared/src/draw/conflict.ts (small pure function + JSDoc)

SPEC:
  Files to create/touch (ONLY these 2; do NOT create grading/index.ts or edit src/index.ts, Kevin wires the export at merge):
    - packages/shared/src/grading/cohen-kappa.ts
    - packages/shared/src/grading/cohen-kappa.test.ts
  Signature (exact):
    /** Pairs are [categoryByRaterA, categoryByRaterB] for each shared case. */
    export function cohenKappaQuadratic(pairs: readonly (readonly [number, number])[], categories = 15): number | null
  Behaviour:
    1. categories must be an integer >= 2, else throw new RangeError('KAPPA_INVALID_CATEGORIES').
    2. Every rating must be an integer in [0, categories - 1], else throw new RangeError('KAPPA_INVALID_RATING').
    3. pairs.length === 0 -> return null.
    4. Compute exactly the formula above (use counts / N; an O(k²) loop is fine for k = 15).
    5. If Σ w E === 0 -> return null. Otherwise return κ_w (a plain number, no rounding).
  Edge cases (expected; computed by Kevin twice, by hand and with an independent script):
    - A: [[0,0],[1,1],[2,2],[0,1]], categories 3            -> 0.8      (toBeCloseTo(0.8, 10))
    - B: [[7,7],[7,8],[8,8],[6,7],[9,9],[7,7]], 15           -> 11/14 = 0.7857142857142857 (toBeCloseTo(11/14, 10))
    - C: [[7,7],[7,7],[7,7]], 15                             -> null   (all one category: undefined, G12)
    - D: [[0,14],[14,0]], 15                                 -> -1     (perfect disagreement)
    - E: [[3,3],[5,5],[9,9]], 15                             -> 1      (perfect agreement with variety)
    - []                                                     -> null
    - [[0,15]] with categories 15 / [[0.5,1]] / categories 1 -> RangeError
    - symmetry: swapping A and B in every pair gives the same value (test on B)
  Pure: no Date, no Math.random, no I/O.

CONSTRAINTS:
  - Touch only the 2 files listed. No new dependencies. No `any`. Import the function in the test
    directly from './cohen-kappa'.
  - Conventional commits (feat(shared): add quadratic-weighted Cohen kappa). Push your branch.

TOOLS (from your worktree root):
  pnpm install --frozen-lockfile
  pnpm --filter @blulens/shared exec vitest run src/grading/cohen-kappa.test.ts
  pnpm --filter @blulens/shared exec vitest run
  pnpm --filter @blulens/shared lint

DONE (the single proving test):
  File: packages/shared/src/grading/cohen-kappa.test.ts
  Test name: "matches the hand-computed quadratic kappa fixtures and returns null when undefined"
  Asserts: fixtures A-E and [] exactly as listed. RangeErrors and symmetry go in further `it` blocks.
  Report back (act=done to kevin-muxsqdkp): branch, commit hash, `git diff --stat origin/develop...HEAD`,
  exact commands + real output (pass/fail counts), anything unverified, anything left open.
