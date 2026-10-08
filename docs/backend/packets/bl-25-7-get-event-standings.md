PACKET bl-25-7: GET /api/v1/events/{eventId}/standings (live group standings, or the confirmed snapshot)

Assignee: Meredith (meredith-muxtbonw) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
Slice 3. Darryl's standings table reads this.

GOAL: per group of the event's PUBLISHED group draw, the ranked rows: from the GroupStanding snapshot when the group is
  confirmed, else computed live from confirmed/walkover matches with the shared computeGroupStandings.

STATE: branch dev/bl-25-event-standings from origin/develop (after bl-25-5 merges, else from origin/dev/bl-25-umpire-matches
  and merge develop before done). matches module: getEventMatches visibility rule (draft -> 404 EVENT_NOT_FOUND),
  loadEntryMap (EntryRef). Shared: computeGroupStandings(entryIds, matches: GroupMatch[{a,b,status,games:[a,b][]}],
  pointsCfg, seed) -> StandingRow[] { entryId, rank, played, won, drawn, lost, points, pointsFor, pointsAgainst, diff,
  decidedBy }; eventFormatSchema (advancePerGroup default 2, bestThirds default 0, points {win,draw,loss}).
  Prisma: Group { id, drawId, label }, GroupMember { groupId, entryId }, GroupStanding (snapshot, see schema), Draw.seed.

SOURCES (openapi, pasted):
  GET /events/{eventId}/standings  x-roles [Guest, Member, Reviewer, Committee, Admin] (@Public, optional user)
  200 GroupStanding[] = { groupId, entryId, entry: EntryRef, rank, played, won, drawn, lost, points, pointsFor,
    pointsAgainst, diff, tiebreakNote: string|null, qualification: qualified|best_third|best_third_contender|out,
    confirmed: boolean }

SPEC (files ONLY: matches.controller.ts, matches.service.ts, apps/api/test/event-standings.e2e-spec.ts new):
  - same event visibility as GET /events/{id}/matches; no published group draw -> 200 [].
  - per group (order by label), rows ordered by rank:
    snapshot exists (GroupStanding rows for the group) -> map them, confirmed true, tiebreakNote from the row.
    else live: members' entryIds + the group's matches (games Json [{a,b}] -> [a,b][]) -> computeGroupStandings(...,
    format.points, draw.seed) -> confirmed false, tiebreakNote = decidedBy (null when 'points' or null).
  - live qualification: rank <= advancePerGroup -> qualified; rank === advancePerGroup + 1 and bestThirds > 0 ->
    best_third_contender; else out. (Cross-group best thirds come with bl-20-7; do not compute them here.)
  - format parsed once (eventFormatSchema.safeParse, defaults on failure); EntryRef via loadEntryMap; no N+1.
  Test: published group of 3 with 1 confirmed match [15-11,15-9], 1 reported, 1 scheduled -> 3 rows, the winner rank 1
    with points 3, the reported match NOT counted, confirmed false; a group with GroupStanding rows -> those values with
    confirmed true; advancePerGroup 2 -> ranks 1-2 qualified, 3 out; draft tournament as Guest -> 404; preview draw -> [].
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && pnpm test
DONE: push dev/bl-25-event-standings, verify on origin, done message to Kevin (sha + FULL pnpm test line).
