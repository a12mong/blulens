PACKET bl-18-1: bracketOrder (shared, pure)

Assignee: Meredith (meredith-muxtbonw) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)

GOAL:
  Given a bracket size S, return the virtual rank of every bracket position so that
  rank r meets rank S+1-r in round 1 and top ranks are spread across halves/quarters/eighths.

STATE:
  AMENDED 2026-10-07: origin/be/bl-18-draw-foundation now holds a stub of your file with the final signature (commit 6d74a21).
  If you already branched: git fetch origin && git rebase origin/be/bl-18-draw-foundation
  Repo: D:/_work/SourceDev/_code/blulens  (do your work in your own worktree, not in that shared folder)
  Branch to create: dev/bl-18-bracket-order  — base it on origin/be/bl-18-draw-foundation
    git fetch origin && git switch -c dev/bl-18-bracket-order origin/be/bl-18-draw-foundation
  Already exists (do not rewrite): packages/shared/src/draw/{types.ts, conflict.ts, prng.ts, index.ts}
  Depends on (merged): none (only the foundation branch above)

SOURCES (everything you need is here; read nothing else):
  docs/specs/draw.md appendix A, verbatim (owner-approved, ruleset draw-v1):
    - start L = [1, 2]
    - repeat until length = S: build L' by replacing each value r in L with the pair [r, (2*|L|) + 1 - r], in order
    - examples: [1,2] -> [1,4,2,3] -> [1,8,4,5,2,7,3,6] (S = 8)
      -> S = 16: [1,16,8,9,4,13,5,12,2,15,7,10,3,14,6,11]
    - required properties: (1) r meets S+1-r in round 1 (2) ranks 1 and 2 are in different halves
      (3) ranks 1-4 in different quarters, 1-8 in different eighths (4) rank 1 is at position 1
  Valid sizes: 2, 4, 8, 16, 32, 64, 128, 256 (draw.md §3; max 256 entries).
  "Position" = 1-based slot in the bracket from top to bottom. Round-1 matches are positions (1,2), (3,4), (5,6), ...
  Sibling pattern to copy (style, JSDoc, RangeError usage): packages/shared/src/draw/prng.ts

SPEC:
  Files to touch (ONLY these 2):
    - packages/shared/src/draw/bracket-order.ts   (EXISTS as a stub since 6d74a21: keep the exact exported names/types, replace the body)
    - packages/shared/src/draw/bracket-order.test.ts
  Signature (exact):
    /** Virtual rank at each position: result[p - 1] = rank of position p (1-based). */
    export function bracketOrder(size: number): number[]
  Behaviour:
    1. If size is not one of 2,4,8,16,32,64,128,256 -> throw new RangeError(`bracketOrder: invalid size ${size}`)
    2. Build L exactly as the formula above and return it (a new array each call).
  Edge cases (expected return):
    - bracketOrder(2)  -> [1, 2]
    - bracketOrder(4)  -> [1, 4, 2, 3]
    - bracketOrder(8)  -> [1, 8, 4, 5, 2, 7, 3, 6]
    - bracketOrder(16) -> [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]
    - bracketOrder(0), (3), (6), (512), (2.5), (-4) -> RangeError
  Pure: no Date, no Math.random, no I/O, no imports except vitest in the test file.

CONSTRAINTS:
  - Touch only the 2 files listed. index.ts already exports this module: do not edit it, stub.ts or stubs.test.ts. No new dependencies. No `any`.
  - Do not modify types.ts, prng.ts, conflict.ts or any test you did not create.
  - Conventional commits, e.g. feat(shared): add bracketOrder for draw-v1. Push your branch to origin.
  - No secrets, no .env printing.

TOOLS (run from the repo root of your worktree):
  pnpm install --frozen-lockfile
  pnpm --filter @blulens/shared exec vitest run src/draw/bracket-order.test.ts
  pnpm --filter @blulens/shared exec vitest run
  pnpm --filter @blulens/shared lint

DONE (the single proving test):
  File: packages/shared/src/draw/bracket-order.test.ts
  Test name: "matches appendix A and satisfies the draw-v1 properties for every size"
  Asserts:
    - the 4 edge-case arrays above, exactly (toEqual)
    - for every size in [2,4,8,16,32,64,128,256]:
        * result is a permutation of 1..size
        * result[0] === 1
        * for every round-1 pair (positions 2k-1, 2k): rank_a + rank_b === size + 1
        * for every block width w in {size/2, size/4, size/8} with w >= 1, the ranks 1..(size/w) each fall
          in a different block of w consecutive positions (halves, quarters, eighths)
  (The RangeError cases may go in a second `it` in the same file.)
  Report back (act=done to kevin-muxsqdkp): branch name, paths changed, the exact commands run and their real
  output (pass/fail counts), anything unverified, anything left open. "Tests pass" alone is not accepted.
