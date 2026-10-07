PACKET bl-18-6: drawBracket — full knockout draw (shared, pure)

Assignee: Meredith (meredith-muxtbonw) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)

GOAL:
  Compose the merged draw pieces into the one entry point the API and QA call: same entries (any order) + same
  seed string = the identical bracket (draw.md §1 item 5, "verify" button).

STATE:
  Your worktree. Branch dev/bl-18-draw-bracket from origin/develop (b8862d7 or later).
    git fetch origin && git switch -c dev/bl-18-draw-bracket origin/develop
  Already exists and MERGED (do not change them): draw/prng.ts (createRng), plan-seeding.ts (planSeeding),
    bracket-order.ts (bracketOrder), solver.ts (solvePlacement, PlacementProblem), types.ts (DRAW_RULESET_VERSION,
    DRAW_PRNG_ID, DrawEntry, SlotValue). draw-bracket.ts is a STUB with the final types (DrawConflict, DrawResult)
    and signature drawBracket(entries, seed): replace its body only. stub.ts still exists only for this stub.

SOURCES (owner-approved draw.md §3-§5, verbatim where quoted):
  - "Seed 1 -> virtual rank 1, seed 2 -> rank 2, groups at random within the group"; "byes at virtual ranks N+1..S";
    "the remaining slots are for non-seeded entries -> constraint solver (§4)".
  - Position p (1-based) has virtual rank bracketOrder(S)[p - 1]. Round-1 match k = positions (2k-1, 2k).
  - One Rng for the whole draw, created once from the seed string and passed through planSeeding THEN solvePlacement.

SPEC:
  Files to touch (ONLY these 3):
    - packages/shared/src/draw/draw-bracket.ts        (replace the stub body; keep the exported types/signature)
    - packages/shared/src/draw/draw-bracket.test.ts   (new)
    - packages/shared/src/draw/stub.ts                (DELETE it: this is the last stub; remove the import from draw-bracket.ts)
  Behaviour of drawBracket(entries, seed):
    1. rng = createRng(seed); plan = planSeeding(entries, rng)   (its RangeErrors propagate unchanged)
    2. order = bracketOrder(plan.size); positionOfRank = rank -> p (1-based) from order
    3. fixed = new Map<number, DrawEntry | null>(): every seed at slot positionOfRank(seed.rank) - 1 (the DrawEntry object,
       found by id), every bye rank r at slot positionOfRank(r) - 1 with null
    4. pool = plan.unseededIds mapped to their DrawEntry objects (in that order)
    5. units = [[0,1],[2,3],...,[S-2,S-1]]
    6. res = solvePlacement({ slotCount: plan.size, units, fixed, pool }, rng)   (SAME rng object)
    7. return { rulesetVersion: DRAW_RULESET_VERSION, prngId: DRAW_PRNG_ID, seed, size: plan.size, seedCount: plan.seedCount,
                seeds: plan.seeds, slots: res.slots,
                conflicts: res.conflicts.map(c => ({ matchNo: c.unitIndex + 1, entryIds: [c.entryIds[0], c.entryIds[1]], teamIds: c.teamIds })),
                minimumPossibleConflicts: res.minimumPossibleConflicts, provenMinimal: res.provenMinimal, searchSteps: res.steps }
  Edge cases (expected):
    - APPENDIX B: A1 (team A, 8.2), B1 (B, 8.0), A2 (A, 7.6), C1 (C, 7.4), A3 (A, 7.1), B2 (B, 6.9)
      -> size 8, seedCount 2, slots[0] 'A1', slots[1] null, slots[4] 'B1', slots[5] null (positions 1, 2, 5, 6),
         A2 and A3 never in the same round-1 pair, conflicts [], minimumPossibleConflicts 0, for seeds 'b0'..'b199'.
    - DETERMINISM: for 5 seeds, drawBracket(appendixB, s) deep-equals drawBracket(appendixB reversed, s).
    - UNAVOIDABLE: A1 (A, 8), A2 (A, 7), A3 (A, 6), B1 (B, 5) -> size 4; conflicts.length 1; minimumPossibleConflicts 1.
    - GOLDEN: freeze ONE full result for seed 'golden-1' on APPENDIX B: run the function once, then paste the exact `slots`
      array and `seeds` array into the test as literals (toEqual). This locks draw-v1 against silent changes. Say in
      your report that you generated it this way.
    - N = 2 -> size 2, no seeds, both entries placed, no byes.
    - A 2-entry input with a duplicate id -> RangeError('DRAW_DUPLICATE_ENTRY') (from planSeeding).
  Pure: no Date, no Math.random, no I/O.

CONSTRAINTS: only those 3 files (one deleted); no new deps; no `any`; stubs.test.ts must still pass (it only checks
  exports); conventional commits (feat(shared): implement drawBracket); push.
TOOLS: pnpm --filter @blulens/shared exec vitest run src/draw · pnpm --filter @blulens/shared exec vitest run · pnpm --filter @blulens/shared lint

DONE (the single proving test):
  File: packages/shared/src/draw/draw-bracket.test.ts
  Test name: "draws draw.md appendix B with seeds and byes in place and no same-team round-1 pair"
  Asserts: the APPENDIX B expectations for seeds b0..b199. Others in further `it` blocks.
  Report back (act=done to kevin-muxsqdkp): branch, commit, `git diff --stat origin/develop...HEAD`, commands + real output.
