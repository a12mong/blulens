PACKET bl-33-2: POST /api/v1/draws/{drawId}/publish for KNOCKOUT draws (creates every knockout match)

Assignee: Meredith (meredith-muxtbonw), after bl-33-1 · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
Slice 4 step 2 (next: bl-33-3 GET bracket, bl-33-4 winner progression on confirm).
STATE: branch dev/bl-33-publish-knockout from origin/develop after bl-33-1 merges (else stacked on
  origin/dev/bl-33-knockout-preview, merge develop before done). draws.service publishDraw (bl-25-9) handles kind 'group'
  and returns 409 DRAW_KIND_NOT_SUPPORTED for knockout; createKnockoutPreview (bl-33-1) writes DrawSlot rows
  (position 1..size, entryId|null = bye). Prisma Match { eventId, drawId, stage group|knockout|third_place, round,
  matchNo (@@unique drawId+matchNo), topEntryId, bottomEntryId, status (scheduled|bye|...), winnerEntryId, result, court }.
  Event format thirdPlacePlayoff (eventFormatSchema, default true).
SOURCES: openapi b4261af /events/{eventId}/knockout/preview description: "Publish with POST /draws/{drawId}/publish
  (acknowledgeConflicts when conflicts is not empty): it creates every knockout match (round 1 with byes auto-advanced,
  later rounds empty, plus the third-place match when thirdPlacePlayoff)". draw.md §6 (one published draw per event+kind).
SPEC (files ONLY: draws.service.ts, apps/api/test/publish-knockout.e2e-spec.ts new; draws.controller.ts only if needed):
  - remove the knockout 409; keep every group-publish rule for knockout too: FOR UPDATE lock, status must be preview,
    no other published/locked knockout draw for the event (409 DRAW_ALREADY_LOCKED), conflicts need acknowledgeConflicts
    (409 DRAW_CONFLICTS_NOT_ACKNOWLEDGED), other knockout previews -> discarded, audit 'draw.publish'.
    Input check for knockout: the source group draw must still be 'locked' (else 409 DRAW_INPUT_CHANGED).
  - create matches in the SAME transaction. size S, rounds R = log2(S). matchNo runs 1.. over all knockout matches,
    round by round. Round 1: match i (0-based) = slots at positions 2i+1 (top) and 2i+2 (bottom). Rounds 2..R: S/2^r
    matches with both entries null, status scheduled.
    Bye: exactly one side null in round 1 -> status 'bye', winnerEntryId = the present entry, result null; put that entry
    into the next-round match: index floor(i/2), top side when i is even, bottom when odd (the same rule bl-33-4 uses
    for confirmed winners; write it as a small exported pure helper nextSlot(round, indexInRound) -> { round, index,
    side } inside draws.service or a new apps/api/src/modules/draws/bracket.ts, and unit-test it).
    Third place: if format.thirdPlacePlayoff and R >= 2, one extra match stage 'third_place', round R, both entries
    null, status scheduled, numbered after the final.
    court null, umpireId null everywhere.
  - Return the Draw shape (status published).
  Test: from the bl-33-1 fixture (Q = 4): publish -> 4 matches (2 semis with entries, final empty, third place empty),
    GET /events/{id}/matches?stage=knockout lists 3 + third_place 1; Q = 3 case (size 4, one bye): R1 has one 'bye'
    match whose entry already sits in the final; thirdPlacePlayoff false -> no third_place match; conflicts without
    acknowledgeConflicts -> 409; publish twice -> 409 DRAW_ALREADY_LOCKED; unit tests for nextSlot. Clean up.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && TEST_DATABASE_URL=<fresh *_test db> pnpm test
DONE: push, verify on origin, done message to Kevin (sha + FULL pnpm test line on a fresh test DB).
