PACKET bl-19-4: grade ladder + projectGrade (shared, pure)

Assignee: Meredith (meredith-muxtbonw) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)

GOAL:
  The 15-rung grade ladder as constants, and projectGrade(score, margin) that turns a numeric result into the
  bad8bit-shaped grade view { score, margin, lower, upper, center, tier, kind, label } every client renders.

STATE:
  Your worktree: D:/_work/SourceDev/_harness/blulens/worktrees/meredith-muxtbonw
  Branch: dev/bl-19-project-grade from origin/develop (d7de1b9 or later)
    git fetch origin && git switch -c dev/bl-19-project-grade origin/develop
  Already exists (do not rewrite): packages/shared/src/grading/{outliers,cohen-kappa,index}.ts (your outliers.ts is merged)
  Depends on (merged): none

SOURCES (owner-approved grading.md v1 §2, §6, appendix B.4, G2/G9/G10; openapi GradeView; verbatim):
  Ladder (index: key), ASCII hyphen:
    0 RK1 · 1 RK2 · 2 RK3 · 3 BG1 · 4 BG2 · 5 BG3 · 6 S- · 7 S · 8 S+ · 9 N- · 10 N · 11 N+ · 12 P- · 13 P · 14 P+
  Tiers: Rookie (0-2) · Beginner (3-5) · Standard (6-8) · Neutral (9-11) · Professional (12-14)  = floor(index / 3)
  score is continuous in ladder units [0, 15); a reviewer's chosen rung i counts as i + 0.5.
  Projection over the half-open interval [score − m, score + m):
    a = clamp(floor(score − m), 0, 14)         -> lower  = GRADES[a]
    b = clamp(ceil(score + m) − 1, 0, 14)      -> upper  = GRADES[b]
    center = GRADES[clamp(floor(score), 0, 14)]
    kind = exact if b − a = 0 · straddle if 1 · wide if >= 2
    label = lower if exact · "lower/upper" if straddle · "lower–upper" (U+2013 EN DASH) if wide
  Why ceil − 1 (not floor): a score exactly mid-rung with m = 0.5 touches the next rung's edge but must stay exact.
  Worked examples (grading.md appendix C), must reproduce exactly:
    C.1 score 7.61, m 0.25 -> lower S,  upper S,  center S, kind exact,    label "S"
    C.2 score 7.83, m 0.63 -> lower S,  upper S+, center S, kind straddle, label "S/S+"
    C.4 score 7.83, m 1.66 -> lower S-, upper N-, center S, kind wide,     label "S-–N-"
  Sibling pattern: packages/shared/src/grading/outliers.ts (your own style).

SPEC:
  Files to create/touch (ONLY these 4):
    - packages/shared/src/grading/grades.ts         (ladder constants + helpers)
    - packages/shared/src/grading/project-grade.ts
    - packages/shared/src/grading/project-grade.test.ts
    - packages/shared/src/grading/index.ts          (append exactly two lines: export * from './grades'; and export * from './project-grade';)
  grades.ts (exact exports):
    export const GRADES = ['RK1','RK2','RK3','BG1','BG2','BG3','S-','S','S+','N-','N','N+','P-','P','P+'] as const;
    export type GradeKey = (typeof GRADES)[number];
    export const TIERS = ['Rookie','Beginner','Standard','Neutral','Professional'] as const;
    export type Tier = (typeof TIERS)[number];
    export function gradeIndex(key: GradeKey): number            // 'S' -> 7; unknown string -> RangeError('GRADE_UNKNOWN_KEY')
    export function tierOf(index: number): Tier                  // integer 0..14 else RangeError('GRADE_INVALID_INDEX')
  project-grade.ts (exact exports):
    export type GradeKind = 'exact' | 'straddle' | 'wide';
    export interface GradeView {
      score: number; margin: number;
      lower: GradeKey; upper: GradeKey; center: GradeKey;
      tier: Tier;            // tier of center
      kind: GradeKind; label: string;
    }
    export function projectGrade(score: number, margin: number): GradeView
  Behaviour:
    1. score must be finite and in [0, 15), margin finite and >= 0, else RangeError('GRADE_INVALID_INPUT').
    2. Apply the projection exactly; return score and margin unchanged (no rounding).
    3. Floating point: compute a and b on (score − margin) and (score + margin) directly, then clamp. Do not add epsilons.
  Edge cases (expected):
    - C.1, C.2, C.4 above (toEqual on the whole object except score/margin which are passed through)
    - (7.5, 0.5)   -> interval [7.0, 8.0) -> lower S, upper S, exact, "S"    (the reason for ceil − 1)
    - (7.5, 0)     -> lower S, upper S, exact       (override results have margin 0)
    - (0.2, 3.0)   -> a = clamp(floor(-2.8)) = 0 -> lower RK1; b = ceil(3.2) - 1 = 3 -> upper BG1; center RK1; wide; label "RK1–BG1"
    - (14.9, 3.0)  -> a = floor(11.9) = 11 -> lower N+; b = clamp(ceil(17.9) - 1) = 14 -> upper P+; center P+; wide; label "N+–P+"
    - tiers: tierOf(0) Rookie, tierOf(8) Standard, tierOf(14) Professional; gradeIndex('P+') 14
    - (15, 0), (-0.1, 0), (7, -1), (NaN, 0) -> RangeError
  Pure: no Date, no Math.random, no I/O.

CONSTRAINTS:
  - Touch only the 4 files listed. No new dependencies. No `any`. The label must use U+2013 (–), not a hyphen.
  - Conventional commits (feat(shared): add grade ladder and projectGrade). Push your branch.

TOOLS (from your worktree root):
  pnpm install --frozen-lockfile
  pnpm --filter @blulens/shared exec vitest run src/grading/project-grade.test.ts
  pnpm --filter @blulens/shared exec vitest run
  pnpm --filter @blulens/shared lint

DONE (the single proving test):
  File: packages/shared/src/grading/project-grade.test.ts
  Test name: "reproduces grading.md appendix C projections exactly"
  Asserts: C.1, C.2, C.4 exact lower/upper/center/tier/kind/label. Other edge cases in further `it` blocks.
  Report back (act=done to kevin-muxsqdkp): branch, commit hash, `git diff --stat origin/develop...HEAD`,
  exact commands + real output (pass/fail counts), anything unverified, anything left open.
