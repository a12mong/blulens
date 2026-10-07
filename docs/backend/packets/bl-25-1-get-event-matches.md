PACKET bl-25-1: GET /api/v1/events/{eventId}/matches (schedule + results read)

Assignee: Meredith (meredith-muxtbonw) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
Slice 3 (docs/design/demo-slice-3.md). Darryl's results/bracket screens read this. Data comes from bl-25-2 (seed).

GOAL: list an event's matches with entry labels, filterable by status / stage / round, with the public rules of slice 3.

STATE: branch dev/bl-25-event-matches from origin/develop (9412bc1 or later). There is NO matches/draws module in
  apps/api yet: create apps/api/src/modules/matches/{matches.module.ts, matches.controller.ts, matches.service.ts} and
  register MatchesModule in app.module.ts (same pattern as reviews.module.ts). Prisma: Match { id, eventId, drawId, stage,
  groupId, round, matchNo, court, umpireId, topEntryId (a), bottomEntryId (b), games Json [{a,b}], result, status,
  reportedBy, reportedAt, confirmedBy, confirmedAt, flags String[] }, Draw { status preview|published|... }, Entry with
  players (user.displayName) and teamId (Team.name). Event visibility: tournaments.service eventDetail() (draft
  tournaments are hidden from non-staff -> 404 EVENT_NOT_FOUND).

SOURCES (openapi, pasted):
  GET /events/{eventId}/matches  x-roles [Guest, Member, Reviewer, Umpire, Committee, Admin]  (@Public, optional user)
    query: status? (scheduled|bye|reported|confirmed|walkover|void), stage? (group|knockout|third_place), round? int
    200 Match[]: { id, stage, groupId, round, a, b, aEntry: EntryRef|null, bEntry: EntryRef|null, games: [{a,b}],
      result, status, court, umpireId, reportedBy, reportedAt, confirmedBy, confirmedAt, flags }
    EntryRef = { entryId, displayName (entry name, or player names joined with ' / '), players [{userId, displayName}],
      teamNames (clubs picked for this entry, de-duplicated), gradeLabel: always null in this packet }
  Slice-3 rule: reported results are public but shown as awaiting confirmation (the web does that from status);
    only matches of PUBLISHED draws are listed (preview draws are never visible).

SPEC:
  Files: the 3 new module files, app.module.ts (+ import), apps/api/test/event-matches.e2e-spec.ts (new).
  - event not found or draft-hidden -> 404 EVENT_NOT_FOUND (reuse the same visibility rule)
  - where: { eventId, draw: { status: 'published' }, status?, stage?, round? }; order by stage, groupId, round, matchNo
  - map topEntryId -> a / aEntry, bottomEntryId -> b / bEntry; games null -> []; dates ISO or null
  - query DTO with zod (status/stage enums, round z.coerce.number().int().min(1)); a bad value -> 400 VALIDATION_FAILED
  Test: fixtures created with prisma (an open tournament + event, 3 approved entries, a PUBLISHED group Draw (fill the
    required Draw fields with test values), one Group, 3 Matches: one confirmed with games, one reported, one scheduled;
    plus a PREVIEW draw with one match):
    - Guest gets 3 matches (not the preview one), with aEntry.displayName and teamNames filled
    - ?status=reported -> 1; ?round=abc -> 400; unknown event -> 404; draft tournament as Guest -> 404
  Clean up everything you created in afterAll (children first).
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && pnpm test
DONE: push dev/bl-25-event-matches, verify on origin, done message to Kevin (sha + result lines).
