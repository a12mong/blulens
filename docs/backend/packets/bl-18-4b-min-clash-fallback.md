PACKET bl-18-4b: solvePlacement — minimum-clash fallback (shared, pure)

Assignee: Meredith (meredith-muxtbonw) (reassigned from Angela) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)

GOAL:
  When no zero-clash placement exists (or the zero-clash search runs out of budget), return the placement with
  the FEWEST clashes, preferring clashes between non-seeded, low-score entries (draw.md §5, D3), instead of the
  current first-fit fallback.

STATE:
  Your worktree. Branch dev/bl-18-min-clash from origin/develop (bl-18-4 solvePlacement is MERGED there):
    git fetch origin && git switch -c dev/bl-18-min-clash origin/develop
  Already exists: packages/shared/src/draw/solver.ts (Angela's zero-clash DFS + first-fit fallback) and solver.test.ts.
  Depends on: bl-18-4 (merged).
  CORRECTNESS BUG TO FIX FIRST (Jim's priority 1): in the merged solver.ts the last lines compute
    provenMinimal = foundSolution || (stepsUsed >= maxSteps ? conflicts.length === minimumPossible : true)
  so when the zero-clash search is EXHAUSTED (not budget-cut) and the first-fit fallback is used, it claims
  'proven minimal' even when the first-fit clash count is above the lower bound. draw.md §4 step 4: report
  'best found, not proven' unless minimality is actually established. After this packet: provenMinimal is true only
  when (a) a zero-clash placement was found, (b) the branch-and-bound below finished without hitting the budget, or
  (c) the best clash count equals the lower bound. Add a test that fails on the old code: a problem where first-fit
  yields MORE clashes than the minimum and maxSteps is large -> the old code returned provenMinimal true with a
  non-minimal placement; the new code returns the minimal placement (and provenMinimal true because B&B finished).
SOURCES (owner-approved draw.md §5 + D3, verbatim):
  - "Minimum clashes > 0: build the draw with the FEWEST clashes, making the clashing pairs non-seeded entries
     with the LOWEST seedScore first."
  - Step 4 budget: "at most 200,000 steps; if exhausted, use the best placement found and record that minimality is
     not proven."
  - Seeds and byes are the `fixed` map in PlacementProblem; pool entries are the non-seeded ones.

SPEC:
  Files to touch (ONLY these 2): packages/shared/src/draw/solver.ts, packages/shared/src/draw/solver.test.ts
  0. Refactor first (no behaviour change): build ONE `const byId = new Map<string, DrawEntry>()` from fixed + pool and
     use it for every occupant/conflict lookup (replaces the repeated `[...order, ...fixed.values()].find(...)`).
  1. Keep the zero-clash DFS exactly as it is (same Rng use, same step counting). Its steps count toward the budget.
  2. If it finds no solution, run a branch-and-bound over the same empty slots, same slot choice rule (fewest
     candidates, ties lowest index; here "candidates" = all unused entries) and the same `order`, with the steps
     left in the budget (maxSteps minus the steps already used; each tentative placement = 1 step).
     Cost of a COMPLETE placement, compared lexicographically (smaller is better):
       (a) number of clashing pairs (as in the conflicts list),
       (b) number of clashing pairs that include a FIXED entry (a seed),
       (c) sum of seedScore over the entries appearing in clashing pairs (lower = clash among weaker entries).
     Prune a branch when its clash count so far (a) is already greater than the best complete (a).
     Keep the first placement found with the best cost (strictly-better replaces it).
     Stop early when (a) of the best equals the lower bound AND (b) is 0 (cannot improve a or b).
  3. Result: the best placement found. provenMinimal = true if the branch-and-bound finished without hitting the
     budget, or if best (a) equals the lower bound. steps = total steps of both phases.
     If the budget is so small that branch-and-bound completes no placement at all, fall back to the existing
     first-fit placement (keep that code path) with provenMinimal = (clashes === lower bound).
  Edge cases (expected):
    - SEED-PROTECTED: slotCount 4, units [[0,1],[2,3]], fixed {0: A1 (team A, seedScore 9)},
      pool A2 (A, 8), A3 (A, 7), B1 (B, 6)
      -> slots ['A1','B1', A2/A3 in slots 2-3 in either order]; conflicts = [{unitIndex 1, entryIds ['A2','A3'], teamIds ['A']}];
         minimumPossibleConflicts 1; provenMinimal true. (Pairing A1 with an A would make a seed clash: worse on (b).)
    - LOWEST-SCORES-CLASH: slotCount 6, units [[0,1],[2,3],[4,5]], no fixed,
      pool A1 (A,9), A2 (A,8), A3 (A,7), A4 (A,6), B1 (B,5), C1 (C,4)
      -> exactly 1 conflict and its entryIds are ['A3','A4'] (sum 13 is the smallest possible); provenMinimal true.
    - The appendix-B and DR-01 tests from bl-18-4 still pass unchanged (zero-clash path untouched).
    - INFEASIBLE from bl-18-4 still gives 1 conflict, proven.
    - Determinism: same input and seed -> deep-equal result, for both fixtures above, over seeds 'f0'..'f49'.
    - Budget: LOWEST-SCORES-CLASH with maxSteps 3 -> still a complete placement with no duplicate ids.
  Pure: no Date, no Math.random, no I/O.

CONSTRAINTS:
  - Touch only the 2 files. No new dependencies. No `any`. Keep solver.ts readable (target < 260 lines total).
  - Conventional commits (feat(shared): minimum-clash fallback for solvePlacement). Push your branch.

TOOLS (+ ENGINE NOTE: reply JSON into your own outbox; work only in your worktree): pnpm --filter @blulens/shared exec vitest run src/draw/solver.test.ts · pnpm --filter @blulens/shared exec vitest run · pnpm --filter @blulens/shared lint

DONE (the single proving test):
  File: packages/shared/src/draw/solver.test.ts
  Test name: "keeps unavoidable clashes away from seeds and on the lowest scores"
  Asserts: SEED-PROTECTED and LOWEST-SCORES-CLASH exactly as listed, for seeds f0..f49.
  Report back (act=done to kevin-muxsqdkp): branch, commit, `git diff --stat origin/develop...HEAD`,
  exact commands + real output, anything unverified or open.
