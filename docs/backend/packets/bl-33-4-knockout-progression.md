PACKET bl-33-4: a confirmed knockout result moves the winner (and the semi-final loser) forward

Assignee: Angela (angela-muxswccx) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
Slice 4 step 4. openapi b4261af: "confirming a knockout result must fill the winner into nextMatchNo/nextSide".
STATE: branch dev/bl-33-knockout-progression from origin/develop after bl-33-2 merges. matches.service applyResultAction
  (bl-25-3/4/15) runs report / enter / correct / approve / reject in ONE transaction with the match row FOR UPDATE and
  writes status, games, result, winnerEntryId. bl-33-2 added apps/api/src/modules/draws/bracket.ts nextSlot(round,
  indexInRound) -> { round, index, side: 'top'|'bottom' } and creates knockout matches round by round with matchNo running
  in that order (round r, index i = position of the match among that round's matches ordered by matchNo).
SPEC (files ONLY: matches.service.ts, apps/api/test/knockout-progression.e2e-spec.ts new):
  - after a knockout (stage 'knockout') match becomes status 'confirmed' (Committee approve, Committee enter) inside the
    same transaction: compute { round, index } of the match, next = nextSlot(...); if a next-round match exists, lock
    it FOR UPDATE and set its topEntryId (side top) or bottomEntryId (bottom) to winnerEntryId.
  - semi-finals (round R-1, where the final is round R) also place the LOSER into the third_place match (if it exists),
    same side rule (index even -> top, odd -> bottom).
  - correction of a confirmed result (Committee correct, reason) that CHANGES the winner: if the next match is still
    'scheduled' replace the entry there (and the third-place loser); if the next match is already reported/confirmed ->
    409 NEXT_MATCH_ALREADY_PLAYED (nothing changes). Same winner -> no change downstream.
  - reject (reported -> scheduled) and umpire report (-> reported) do NOT move anyone (only confirmed results advance).
  - group-stage matches are untouched by this logic.
  Test: published Q = 4 knockout (bl-33-2 fixture): Committee enters semi 1 -> final top = winner, third place top =
    loser; semi 2 via umpire report + approve -> final bottom filled only after approve (not after report); correction
    of semi 1 changing the winner while the final is scheduled -> final top updated; after the final is confirmed, a
    winner-changing correction of semi 1 -> 409 NEXT_MATCH_ALREADY_PLAYED; final confirmed -> GET bracket champion (if
    bl-33-3 is merged; else assert final.winnerEntryId). Clean up.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && TEST_DATABASE_URL=<fresh *_test db> pnpm test
DONE: push, verify on origin, done message to Kevin (sha + test names + FULL pnpm test line on a fresh test DB).
