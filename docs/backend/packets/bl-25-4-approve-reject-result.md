PACKET bl-25-4: POST /api/v1/matches/{matchId}/result/approve and /reject (Committee results queue)

Assignee: Meredith (meredith-muxtbonw) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
Slice 3. Builds on bl-25-3 (PUT result). Two tiny routes on the same transaction helper, so one packet.

GOAL: the Committee confirms a reported result (reported -> confirmed) or sends it back to the umpire
  (reported -> scheduled, reason required). Audited, one transaction, row locked.

STATE: branch dev/bl-25-approve-reject from origin/develop AFTER bl-25-3 merges (if it is not merged yet, branch from
  origin/dev/bl-25-match-result and merge origin/develop before your done message). matches.service.ts has the bl-25-3
  flow: lock (FOR UPDATE), load format/entries/lock state, build ResultMatch, matchResultTransition, map codes, write
  back, audit, return mapMatch. Shared actions: { type: 'confirm' } and { type: 'reject', reason } (committee only;
  MATCH_NOT_REPORTED when status !== 'reported'; REASON_REQUIRED).

SOURCES (openapi, pasted):
  POST /matches/{matchId}/result/approve  x-roles [Committee]  200 Match; 409 MATCH_NOT_REPORTED
  POST /matches/{matchId}/result/reject   x-roles [Committee]  body ReasonInput { reason: string 5..2000 }  200 Match

SPEC (files ONLY: matches.controller.ts, matches.service.ts, apps/api/test/match-result-approve.e2e-spec.ts new):
  - @Roles('Committee','Admin') on both, uuid pipe. Reuse the bl-25-3 transaction flow: refactor it into one private
    helper applyResultAction(matchId, actor, buildAction) instead of copying it (keep PUT behaviour identical).
  - Map: MATCH_NOT_REPORTED -> 409; MATCH_LOCKED -> 409 STAGE_CONFIRMED; REASON_REQUIRED or reason shorter than 5 ->
    400 VALIDATION_FAILED; missing match -> 404 MATCH_NOT_FOUND.
  - approve writes status confirmed, confirmedBy/At; reject writes status scheduled and clears games, result,
    winnerEntryId, reportedBy/At (keep the rejected values in the audit `before`). Audit actions
    'match.result.approve' / 'match.result.reject' (with reason).
  Test: umpire reports (via PUT) -> Committee approve -> confirmed + confirmedBy; approve again -> 409 MATCH_NOT_REPORTED;
    report -> reject with reason -> scheduled, games [] in the response, audit row with reason; reject without reason
    -> 400; Umpire calling approve -> 403; GroupStanding for the group -> 409 STAGE_CONFIRMED. Clean up.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && pnpm test
DONE: push dev/bl-25-approve-reject, verify on origin, done message to Kevin (sha + FULL `pnpm test` result line).
