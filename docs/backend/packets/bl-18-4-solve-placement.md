PACKET bl-18-4: solvePlacement — zero-clash search (shared, pure)

Assignee: Angela (angela-muxswccx) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)

GOAL:
  Fill the empty slots of a draw with the pool entries so that no "unit" (a round-1 pair, or a group) holds two
  entries from the same team, using the seeded Rng only once, deterministically. When that is impossible or the
  search budget runs out, return a complete placement anyway (simple fallback) with its clashes reported.
  (The smarter min-clash fallback is the NEXT packet, bl-18-4b. Keep the fallback here simple.)

STATE:
  Your own worktree only. Branch: dev/bl-18-solve-placement from origin/develop (d7de1b9 or later).
    git fetch origin && git switch -c dev/bl-18-solve-placement origin/develop
  Already exists (do not rewrite): packages/shared/src/draw/solver.ts is a STUB with the final types and signature
  (PlacementProblem, UnitConflict, PlacementResult, solvePlacement). Keep every exported name and type exactly;
  replace the body. Also exists: types.ts (DrawEntry, SlotValue, DRAW_MAX_SEARCH_STEPS = 200_000),
  conflict.ts (sharesTeam), prng.ts (Rng, shuffle), your plan-seeding.ts, bracket-order.ts.
  Depends on (merged): foundation, planSeeding.

SOURCES (owner-approved draw.md §4/§5 + D3/D7, verbatim where quoted):
  - "Iron rule: number of round-1 pairs from the same team = 0 (if possible)."
  - "Order the non-seeded entries by id, then shuffle with the PRNG (Fisher–Yates)."
  - "Place slot by slot with backtracking: pick the empty slot with the FEWEST candidates first; try entries in the
     shuffled order; skip an entry whose team clashes with the occupant(s) of the slot's unit; on a dead end, backtrack."
  - "Limit: at most 200,000 steps (ruleset value); if exhausted, use the best placement found and record that
     minimality is not proven."
  - "If the largest team has t entries and t > S/2 the clash is unavoidable; minimum clashes = t − S/2."
  - Same team (D7) = sharesTeam(a, b): the team-id sets intersect. Entries without teams never clash.
  - "Every loop has a fixed order (sorted by id) so the result is identical on every machine."
  Types already in solver.ts (do not change):
    interface PlacementProblem { slotCount: number; units: readonly (readonly number[])[];
      fixed: ReadonlyMap<number, DrawEntry | null>; pool: readonly DrawEntry[]; maxSteps?: number }
    interface UnitConflict { unitIndex: number; entryIds: string[]; teamIds: string[] }
    interface PlacementResult { slots: SlotValue[]; conflicts: UnitConflict[];
      minimumPossibleConflicts: number; provenMinimal: boolean; steps: number }
  Generic on purpose: knockout round 1 uses units [[0,1],[2,3],...]; the group stage (bl-20) will pass one unit per
  group (e.g. [[0,1,2,3],[4,5,6,7]]). Nothing in the code may assume units have size 2.

SPEC:
  Files to touch (ONLY these 2):
    - packages/shared/src/draw/solver.ts        (stub exists: replace the body, keep the exports)
    - packages/shared/src/draw/solver.test.ts   (new)
  Behaviour:
    1. Validate (throw RangeError with these exact messages):
       - any unit index outside 0..slotCount-1, or a slot appearing in two units -> 'DRAW_INVALID_UNITS'
       - a fixed key outside 0..slotCount-1 -> 'DRAW_INVALID_UNITS'
       - pool.length !== number of slots not in `fixed` -> 'DRAW_POOL_MISMATCH'
       - an entry id appearing twice across fixed values and pool -> 'DRAW_DUPLICATE_ENTRY'
       Slots that belong to no unit are allowed (they can never clash).
    2. order = shuffle(pool sorted by id ascending with plain < compare, rng). This is the ONLY use of rng.
    3. Zero-clash search (DFS with backtracking) over the empty slots:
       - candidates(slot) = unused entries in `order` that do not clash (sharesTeam) with any entry already in the
         slot's unit (fixed entries included; null = bye never clashes). A slot in no unit accepts every entry.
       - at each depth pick the empty slot with the fewest candidates; ties -> lowest slot index.
       - try its candidates in `order` sequence; each tentative placement = 1 step.
       - stop when all slots are filled (success), when the search space is exhausted, or when steps reach
         maxSteps (default DRAW_MAX_SEARCH_STEPS).
    4. On success: conflicts [], minimumPossibleConflicts = lower bound (step 6, will be 0), provenMinimal true.
    5. Otherwise (simple fallback for now): fill the empty slots in ascending index with the entries of `order`
       in sequence (first empty slot gets order[0], ...). Compute conflicts on that placement.
       provenMinimal = (conflicts.length === lower bound). steps = steps spent in step 3.
    6. Lower bound: for every team id T, c_T = number of entries (fixed + pool) carrying T; U = units.length.
       minimumPossibleConflicts = max over T of max(0, c_T − U). (For knockout with S slots this is t − S/2.)
    7. Conflicts of a full placement: for every unit (in index order), every pair of entries in it (in slot order)
       that sharesTeam -> { unitIndex, entryIds: [the two ids ascending], teamIds: shared ids ascending }.
    8. slots: SlotValue[] of length slotCount: entry id, null for a bye.
  Edge cases (expected):
    - APPENDIX B (draw.md): slotCount 8, units [[0,1],[2,3],[4,5],[6,7]],
      fixed {0: A1(team A), 1: null, 4: B1(team B), 5: null},
      pool [A2(A), C1(C), A3(A), B2(B)] (seedScore values do not matter here)
      -> slots[0] 'A1', slots[1] null, slots[4] 'B1', slots[5] null; A2 and A3 in different units; conflicts [];
         minimumPossibleConflicts 0; provenMinimal true. Check this for createRng('b0') .. createRng('b199').
    - INFEASIBLE: slotCount 4, units [[0,1],[2,3]], no fixed, pool A1,A2,A3 (team A) + B1 (team B)
      -> conflicts.length 1 (the two A's sharing a unit), minimumPossibleConflicts 1, provenMinimal true.
    - DR-01: 16 entries, 4 teams × 4, no fixed, 8 pair units -> 0 conflicts for createRng('d0') .. createRng('d999').
    - DOUBLES (D7): pair units, entries with teamIds ['A','B'], ['B'], ['C'], ['C','D'] -> no unit holds two entries
      that share any id; with 4 slots and 2 units this is satisfiable -> 0 conflicts.
    - GROUPS (reuse): slotCount 8, units [[0,1,2,3],[4,5,6,7]], pool 8 entries teams A,A,B,B,C,C,D,D -> 0 conflicts.
    - TEAMLESS: entries with teamIds [] never clash (all-teamless pool -> 0 conflicts, proven).
    - DETERMINISM: same problem + same seed string -> deep-equal results; the same pool passed in reversed order ->
      deep-equal results.
    - PERF: 256 entries, 32 teams × 8, 128 pair units, no fixed: finishes in < 1000 ms with 0 conflicts
      (measure with performance.now() inside the test; the purity rule applies to src, not tests).
    - BUDGET: the INFEASIBLE case with maxSteps 1 still returns a complete placement (4 slots filled, no duplicates).
    - Validation: each RangeError above.
  Pure: no Date, no Math.random, no I/O in solver.ts.

CONSTRAINTS:
  - Touch only the 2 files listed. No new dependencies. No `any`. Use sharesTeam and shuffle from the foundation.
  - Keep it readable: one exported function plus small private helpers; target well under 200 lines.
  - Do not implement the min-clash optimisation (bl-18-4b) here.
  - Conventional commits (feat(shared): implement solvePlacement zero-clash search). Push your branch.

TOOLS (from your worktree root):
  pnpm install --frozen-lockfile
  pnpm --filter @blulens/shared exec vitest run src/draw/solver.test.ts
  pnpm --filter @blulens/shared exec vitest run
  pnpm --filter @blulens/shared lint

DONE (the single proving test):
  File: packages/shared/src/draw/solver.test.ts
  Test name: "places draw.md appendix B with no same-team round-1 pair for 200 seeds"
  Asserts: the APPENDIX B expectations above for every seed b0..b199. Other cases in further `it` blocks.
  Report back (act=done to kevin-muxsqdkp): branch, commit hash, `git diff --stat origin/develop...HEAD`,
  exact commands + real output (pass/fail counts, the PERF timing), anything unverified, anything left open.
