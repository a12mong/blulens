PACKET bl-18-2: planSeeding (shared, pure)

Assignee: Angela (angela-muxswccx) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)

GOAL:
  Given the active entries of one event and a seeded Rng, decide bracket size, number of seeds,
  which entries are seeds and which virtual rank each seed and each bye occupies.

STATE:
  Repo: D:/_work/SourceDev/_code/blulens  (work in your own worktree, not in that shared folder:
    git worktree add ../blulens-angela -b dev/bl-18-plan-seeding origin/be/bl-18-draw-foundation)
  Branch to create: dev/bl-18-plan-seeding — based on origin/be/bl-18-draw-foundation
  Already exists (do not rewrite): packages/shared/src/draw/types.ts (DrawEntry), prng.ts (Rng, shuffle), index.ts
  Depends on (merged): none (only the foundation branch above). Does NOT need bracketOrder.

SOURCES (everything you need is here; read nothing else):
  Already in the code (foundation):
    interface DrawEntry { id: string; teamIds: readonly string[]; seedScore: number }
    interface Rng { nextUint32(): number; int(n: number): number }
    function shuffle<T>(items: readonly T[], rng: Rng): T[]   // Fisher-Yates, returns a new array
  docs/specs/draw.md §3 (owner-approved D1), verbatim table:
    N entries | bracket size S | default seeds
    2         | 2              | 0
    3-4       | 4              | 2
    5-8       | 8              | 2
    9-16      | 16             | 4
    17-32     | 32             | 8
    33-64     | 64             | 16
    65-256    | 128-256        | 16
  draw.md §3 rules, verbatim:
    - "Sort seeds by seedScore descending; equal scores are decided by the PRNG."
    - "Seed 1 -> virtual rank 1, seed 2 -> rank 2, group 3-4 -> ranks 3-4 at random, group 5-8 -> ranks 5-8
       at random within the group, group 9-16 likewise."
    - "Number of byes = S - N, placed at virtual ranks N+1..S."
  draw.md §4 step 2: non-seeded entries are ordered by id before the solver shuffles them.
  Sibling pattern: packages/shared/src/draw/prng.ts (style, RangeError usage)

SPEC:
  Files to create/touch (ONLY these 3):
    - packages/shared/src/draw/plan-seeding.ts
    - packages/shared/src/draw/plan-seeding.test.ts
    - packages/shared/src/draw/index.ts   (add exactly one line: export * from './plan-seeding';)
  Types + signature (exact, export all of them):
    export interface SeedPlacement { entryId: string; seedNo: number; rank: number }
    export interface SeedingPlan {
      size: number;              // S, smallest power of two >= N (minimum 2)
      seedCount: number;         // from the table
      byeCount: number;          // S - N
      seeds: SeedPlacement[];    // ordered by seedNo 1..seedCount
      byeRanks: number[];        // N+1..S ascending (empty when S = N)
      unseededIds: string[];     // every non-seed entry id, sorted ascending (plain < string compare)
    }
    export function planSeeding(entries: readonly DrawEntry[], rng: Rng): SeedingPlan
  Behaviour (the Rng must be consumed in EXACTLY this order so every implementation gives the same result):
    1. N = entries.length. N < 2 -> throw new RangeError('DRAW_TOO_FEW_ENTRIES').
       N > 256 -> throw new RangeError('DRAW_TOO_MANY_ENTRIES').
       Duplicate id -> throw new RangeError('DRAW_DUPLICATE_ENTRY').
    2. size = smallest power of two >= N. seedCount from the table. byeCount = size - N.
    3. Ranking: copy entries, sort by id ascending, then stable-sort by seedScore descending.
       Then walk the ranking top to bottom; for every maximal run of 2+ entries with an identical seedScore,
       replace that run with shuffle(run, rng). Runs of length 1 consume no randomness.
    4. The first seedCount entries of the ranking are seeds 1..seedCount.
    5. Ranks: seed 1 -> 1, seed 2 -> 2. Then for each group [3..4], [5..8], [9..16] that lies within
       1..seedCount, in that order: r = shuffle(groupRanks, rng) where groupRanks = [lo..hi] ascending;
       seed lo+i gets r[i].
    6. byeRanks = [N+1, ..., size]. unseededIds = ids of the remaining entries sorted ascending.
  Edge cases (expected return):
    - appendix B (ids and scores): A1 8.2, B1 8.0, A2 7.6, C1 7.4, A3 7.1, B2 6.9 (any rng) ->
      { size: 8, seedCount: 2, byeCount: 2,
        seeds: [{entryId:'A1',seedNo:1,rank:1},{entryId:'B1',seedNo:2,rank:2}],
        byeRanks: [7, 8], unseededIds: ['A2','A3','B2','C1'] }
    - N = 2 -> size 2, seedCount 0, seeds [], byeRanks [], unseededIds = both ids sorted
    - N = 3 -> size 4, seedCount 2, byeRanks [4]
    - N = 9 -> size 16, seedCount 4, ranks of seeds 3 and 4 are {3,4} in some order
    - N = 65 -> size 128, seedCount 16, byeCount 63
    - 4 entries all seedScore 7.0 -> same output for the same seed string; seeds may differ for another seed
  Pure: no Date, no Math.random, no I/O.

CONSTRAINTS:
  - Touch only the 3 files listed. No new dependencies. No `any`.
  - Use the existing shuffle() and Rng from ./prng; do not write another shuffle.
  - Do not modify foundation files. Conventional commits (feat(shared): add planSeeding). Push your branch.

TOOLS (from your worktree root):
  pnpm install --frozen-lockfile
  pnpm --filter @blulens/shared exec vitest run src/draw/plan-seeding.test.ts
  pnpm --filter @blulens/shared exec vitest run
  pnpm --filter @blulens/shared lint

DONE (the single proving test):
  File: packages/shared/src/draw/plan-seeding.test.ts
  Test name: "plans the draw.md appendix B event exactly"
  Asserts: planSeeding(appendixB, createRng('appendix-b')) toEqual the appendix-B object above.
  (Put the other edge cases in further `it` blocks in the same file: table boundaries N = 2,3,4,5,8,9,16,17,
   32,33,64,65,256; RangeErrors; tie determinism with createRng('tie') called twice.)
  Report back (act=done to kevin-muxsqdkp): branch, paths changed, exact commands + real output
  (pass/fail counts), anything unverified, anything left open.
