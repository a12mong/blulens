PACKET bl-25-11: POST /api/v1/events/{eventId}/groups/confirm (snapshot the group standings, lock the group stage)

Assignee: Meredith (meredith-muxtbonw) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
Slice 3 write chain, last step. DEPENDS ON bl-20-7 rankBestThirds (Angela) ONLY when format.bestThirds > 0: if it is not
  on develop when you start, implement bestThirds > 0 as 409 BEST_THIRDS_NOT_AVAILABLE and tell me; the rest is independent.

GOAL: when every match of the published group draw is final, the Committee confirms the group stage: GroupStanding rows
  are written per group (the snapshot GET /events/{id}/standings then serves with confirmed true), qualification is
  fixed, and the draw becomes 'locked' so results can no longer change (PUT result already maps the snapshot to 409
  STAGE_CONFIRMED). Audited.

STATE: branch dev/bl-25-confirm-groups from origin/develop (after bl-25-10 merges). matches.service getEventStandings
  (bl-25-7) computes live rows with computeGroupStandings(entryIds, matches, format.points, draw.seed): REUSE that code
  path (extract a private helper returning rows per group) so the snapshot equals what the live view showed.
  Prisma GroupStanding { groupId, entryId, rank, played, won, drawn, lost, points, pointsFor, pointsAgainst, diff,
  tiebreakNote, qualification qualified|best_third|out, confirmedBy, confirmedAt } (@@id groupId+entryId).

SOURCES (openapi, pasted):
  POST /events/{eventId}/groups/confirm  x-roles [Committee]  200 GroupStanding[] (same shape as GET standings, confirmed
  true); 409 GROUP_MATCHES_INCOMPLETE

SPEC (files ONLY: matches.controller.ts, matches.service.ts, apps/api/test/confirm-groups.e2e-spec.ts new):
  - @Roles('Committee','Admin'). Event missing -> 404 EVENT_NOT_FOUND. No published group draw -> 409 NO_PUBLISHED_GROUP_DRAW;
    draw already locked -> 409 DRAW_ALREADY_LOCKED.
  - ONE $transaction, lock the draw row FOR UPDATE. Any match of the draw with status scheduled or reported -> 409
    GROUP_MATCHES_INCOMPLETE (details: the count). (confirmed, walkover, void, bye are final.)
  - rows per group via the shared helper. qualification: rank <= advancePerGroup -> qualified; if bestThirds > 0:
    rankBestThirds(groups as GroupInput[{groupIndex, entryIds, matches}], format.points, draw.seed), the top bestThirds
    entries -> best_third; everyone else -> out. tiebreakNote = decidedBy unless null/'points'.
  - createMany GroupStanding (confirmedBy = caller); draw status -> 'locked'; audit 'groups.confirm'.
  - Return the rows mapped like GET standings (with EntryRef, confirmed true).
  Test: publish a group draw (draws endpoints), report+approve or Committee-enter every match -> confirm -> 200 rows,
    GroupStanding rows in DB, draw locked; GET standings then returns confirmed true with the same ranks; PUT result on a
    match afterwards -> 409 STAGE_CONFIRMED; one match still scheduled -> 409 GROUP_MATCHES_INCOMPLETE; confirm twice ->
    409 DRAW_ALREADY_LOCKED; Member -> 403. Clean up (GroupStanding before groups).
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && pnpm test
DONE: push dev/bl-25-confirm-groups, verify on origin, done message to Kevin (sha + FULL pnpm test line).
