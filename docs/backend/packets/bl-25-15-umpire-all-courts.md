PACKET bl-25-15: an umpire assigned to every court can report matches with no court (P1, Dwight full-loop gate)

Assignee: Creed (creed-muxswjfu) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
GOAL: matches created by publishing a draw have court = null. An umpire whose EventUmpire row has courts [] (= every court
  of that event, schema comment) must be able to report them; today PUT /matches/{id}/result returns 403
  UMPIRE_NOT_ASSIGNED because the shared transition only accepts `umpireId === caller` or `court in actor.courts`.
STATE: branch dev/bl-25-umpire-all-courts from origin/develop. apps/api/src/modules/matches/matches.service.ts
  ~line 1094 (applyResultAction, umpire actor): `courts = eventUmpire.courts.length > 0 ? eventUmpire.courts :
  (match.court ? [match.court] : [])`. The ResultMatch passed to matchResultTransition is built in the same function.
  Do NOT change packages/shared (the pure transition stays as is).
SPEC (files ONLY: matches.service.ts, apps/api/test/match-result.e2e-spec.ts (+ tests)):
  - when the caller has an EventUmpire row for the match's event with courts [] (all courts), treat them as assigned:
    build the ResultMatch with umpireId = caller.id if match.umpireId is null (only in the object passed to the
    transition; never write it to the DB). Keep every other check (UMPIRE_IS_PLAYER, team conflict flag, status).
  - an umpire with a non-empty courts list still cannot report a court-null match (403 UMPIRE_NOT_ASSIGNED).
  - GET /umpire/matches already lists court-null matches for courts [] umpires: add no change there.
  Test: published-draw style match with court null + EventUmpire courts [] -> umpire PUT 200 reported; umpire with
    courts ['สนาม 2'] -> 403 on the court-null match; the umpire who plays in the match -> still 403 UMPIRE_OWN_MATCH;
    the stored match.umpireId stays null after the report.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && pnpm test
DONE: push dev/bl-25-umpire-all-courts, verify on origin, done message to Kevin: sha + the new tests' names + the WHOLE
  suite line (`cd apps/api && pnpm test`, no file filter). No placeholder tests.
