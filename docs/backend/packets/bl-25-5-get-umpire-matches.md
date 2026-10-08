PACKET bl-25-5: GET /api/v1/umpire/matches (the umpire's own match list)

Assignee: Meredith (meredith-muxtbonw), after bl-25-4 · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
Slice 3, blocks the /umpire page (web is ready and calls this contract).

GOAL: an Umpire lists the matches they may report: assigned directly (Match.umpireId) or on a court of an event they
  are assigned to (EventUmpire; EMPTY courts = every court of that event). Optional ?status=.

STATE: branch dev/bl-25-umpire-matches from origin/develop (after bl-25-4 merges). matches.service has mapMatch +
  loadEntryMap + format resolution (bl-25-1/1b) and the court rule in the bl-25-3 result flow.
SOURCES (openapi, pasted): GET /umpire/matches  x-roles [Umpire]  query status? (scheduled|reported|confirmed)
  200 Match[] (same shape as GET /events/{eventId}/matches items, incl. format)
SPEC (files ONLY: a new UmpireController in apps/api/src/modules/matches/umpire.controller.ts registered in
  matches.module.ts, matches.service.ts, apps/api/test/umpire-matches.e2e-spec.ts new):
  - @Roles('Umpire') @Get('umpire/matches'); zod query; bad status -> 400 VALIDATION_FAILED.
  - where: draw.status 'published' AND (umpireId = caller OR (eventId in events where the caller has an EventUmpire row
    with courts [] ) OR (eventId + court in the caller's EventUmpire courts)) AND status? ; build the OR from the caller's
    EventUmpire rows in ONE query first. Exclude matches where the caller is one of the players (they may not report them).
    Order by eventId, stage, round, matchNo. Resolve formats once per event; no N+1.
  Test: umpire A with EventUmpire courts [] on event 1 sees all its published matches; umpire B with courts ['สนาม 2']
    sees only that court's matches; a match with umpireId = B on another court is also listed for B; a preview-draw
    match is never listed; ?status=reported filters; a Member -> 403; a match where A plays is not listed for A.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && pnpm test
DONE: push dev/bl-25-umpire-matches, verify on origin, done message to Kevin (sha + FULL pnpm test line).
