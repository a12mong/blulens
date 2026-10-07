PACKET bl-18-5: applyWithdrawal (shared, pure)

Assignee: Creed (creed-muxswjfu) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)

GOAL:
  When an entry withdraws after the draw is published, never redraw: put the first reserve into the same slot, or,
  with no reserve left, give the round-1 opponent a walkover (draw.md §7, decision D6).

STATE:
  Your own worktree. Branch: dev/bl-18-apply-withdrawal from origin/develop.
    git fetch origin && git switch -c dev/bl-18-apply-withdrawal origin/develop
  Already exists: packages/shared/src/draw/withdrawal.ts is a STUB with the final types (WithdrawalOutcome,
  WithdrawalResult) and signature. Keep every exported name/type exactly; replace the body. index.ts already exports it.
  Depends on (merged): foundation (types.ts: SlotValue = string | null).

SOURCES (owner-approved draw.md §7 + D6, verbatim):
  - "Withdrawal after publishing: NO redraw — if there is a reserve, the reserve takes the same slot; if not, the
     opponent gets a walkover."
  - Slots: slots[p - 1] = position p (1-based); null = bye. Round-1 opponent of position p is p + 1 when p is odd,
    p − 1 when p is even.
  Types in the stub (do not change):
    type WithdrawalOutcome =
      | { kind: 'reserve'; position: number; reserveId: string }
      | { kind: 'walkover'; position: number; opponentId: string | null };
    interface WithdrawalResult { slots: SlotValue[]; remainingReserveIds: string[]; outcome: WithdrawalOutcome }
    function applyWithdrawal(slots: readonly SlotValue[], entryId: string, reserveIds: readonly string[]): WithdrawalResult

SPEC:
  Files to touch (ONLY these 2):
    - packages/shared/src/draw/withdrawal.ts        (replace the stub body)
    - packages/shared/src/draw/withdrawal.test.ts   (new)
  Behaviour:
    1. slots.length must be a power of two >= 2, else RangeError('DRAW_INVALID_SLOTS').
    2. p = 1-based position of entryId in slots; absent -> RangeError('DRAW_ENTRY_NOT_IN_DRAW').
    3. If reserveIds is non-empty: r = reserveIds[0]. If r already appears in slots -> RangeError('DRAW_DUPLICATE_ENTRY').
       Return slots copy with slot p = r; remainingReserveIds = reserveIds.slice(1);
       outcome { kind: 'reserve', position: p, reserveId: r }.
    4. Else: the withdrawn slot becomes null (a bye) so the opponent advances; opponentId = the value at the
       opponent position (null if that is a bye too).
       outcome { kind: 'walkover', position: p, opponentId }; remainingReserveIds = [].
    5. Never mutate the inputs (return new arrays).
  Edge cases (expected), slots8 = ['A1', null, 'A2', 'C1', 'B1', null, 'B2', 'A3']:
    - applyWithdrawal(slots8, 'C1', ['R1','R2']) -> slots[3] 'R1', remaining ['R2'], outcome reserve position 4 'R1'
    - applyWithdrawal(slots8, 'A2', [])          -> slots[2] null, outcome walkover position 3 opponentId 'C1'
    - applyWithdrawal(slots8, 'A3', [])          -> slots[7] null, outcome walkover position 8 opponentId 'B2'
    - applyWithdrawal(slots8, 'A1', [])          -> slots[0] null, outcome walkover position 1 opponentId null
    - applyWithdrawal(slots8, 'ZZ', [])          -> RangeError('DRAW_ENTRY_NOT_IN_DRAW')
    - applyWithdrawal(slots8, 'C1', ['B2'])      -> RangeError('DRAW_DUPLICATE_ENTRY')
    - applyWithdrawal(['A','B','C'], 'A', [])    -> RangeError('DRAW_INVALID_SLOTS')
    - input arrays are unchanged after every call (compare to a copy)
  Pure: no Date, no Math.random, no I/O.

CONSTRAINTS: only the 2 files; no new deps; no `any`; conventional commits (feat(shared): implement applyWithdrawal); push.
TOOLS: pnpm --filter @blulens/shared exec vitest run src/draw/withdrawal.test.ts · pnpm --filter @blulens/shared exec vitest run · pnpm --filter @blulens/shared lint

DONE (the single proving test):
  File: packages/shared/src/draw/withdrawal.test.ts
  Test name: "uses the first reserve, else gives the round-1 opponent a walkover, never redraws"
  Asserts: the first 4 edge cases exactly (toEqual on the whole result). Errors and immutability in further `it`s.
  Report back (act=done to kevin-muxsqdkp): branch, commit, `git diff --stat origin/develop...HEAD`, commands + real output.
