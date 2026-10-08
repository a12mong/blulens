PACKET bl-33-1: POST /api/v1/events/{eventId}/knockout/preview (knockout draw preview from the confirmed groups)

Assignee: Meredith (meredith-muxtbonw), after bl-25-16 · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
Slice 4 step 1 (next: bl-33-2 publish knockout + create matches, bl-33-3 GET bracket, bl-33-4 winner progression).
STATE: branch dev/bl-33-knockout-preview from origin/develop. draws module: createGroupPreview (bl-25-8/14: version,
  seed, reason rule D5, inputHash helper, P2002 -> 409 DRAW_VERSION_CONFLICT, toDrawResponse). Shared: seedKnockout(
  qualifiers: Qualifier[{ entryId, teamIds, groupIndex, tier 1|2|3, tierRank }], seed) -> { size, slots (entryId|null),
  teamClashes, groupClashes }. Prisma: GroupStanding snapshot (rank, points, diff, pointsFor, qualification
  qualified|best_third|out) of the LOCKED group draw; DrawSlot { drawId, position 1..size, entryId|null, seedNo };
  Draw.sourceGroupDrawId; Draw.conflicts Json.
SOURCES: openapi b4261af /events/{eventId}/knockout/preview (read its description: F8 tiered seeding, byes to top seeds,
  appendix-A order, cost lexicographic (team, group), body { seed?, reason? (D5) }); 409 GROUP_STAGE_NOT_CONFIRMED |
  KNOCKOUT_TOO_FEW_QUALIFIERS | DRAW_ALREADY_LOCKED. Draw.slots[] = { position, entryId|null, seedNo|null,
  entry: EntryRef|null, source: { groupLabel, place 1..3 } | null }; Draw.conflicts[] = { matchNo, kind: team|group,
  teamId|null, groupLabel|null }.
SPEC (files ONLY: draws.controller.ts, draws.service.ts, apps/api/test/knockout-preview.e2e-spec.ts new):
  - @Roles('Committee','Admin'). The event's group draw must have status 'locked' (groups confirmed) else 409
    GROUP_STAGE_NOT_CONFIRMED. A published or locked knockout draw exists -> 409 DRAW_ALREADY_LOCKED.
  - qualifiers from GroupStanding: rank 1 -> tier 1; rank 2 -> tier 2 (only when advancePerGroup >= 2); qualification
    best_third -> tier 3. tierRank inside a tier: points desc, diff desc, pointsFor desc, entryId asc. groupIndex = the
    group's label order (A = 0). teamIds = the entry players' active team ids (same helper as groups preview).
    Q < 2 -> 409 KNOCKOUT_TOO_FEW_QUALIFIERS.
  - seed / reason / version / P2002 exactly like createGroupPreview (version counted per event + kind 'knockout'; reuse
    the helpers, do not copy).
  - plan = seedKnockout(...). ONE transaction: Draw { kind 'knockout', status preview, size = plan.size, seedsCount = Q,
    sourceGroupDrawId = the locked group draw id, sameTeamR1Count = plan.teamClashes, conflicts = the R1 pairs that
    clash as [{ matchNo: pairIndex + 1, kind, teamId (a shared team id or null), groupLabel (or null) }] }, and DrawSlot
    rows for every position (seedNo = 1-based index in the tier order, null for byes). NO matches in a preview.
    Audit 'draw.preview'.
  - Response: the Draw shape with slots[] including entry (EntryRef via the matches module loadEntryMap; export it from
    a provider and inject it, do not copy) and source { groupLabel, place }.
  Test: groups_knockout event with 2 groups of 3 (advancePerGroup 2); publish, confirm every match, confirm groups
    (reuse the existing endpoints) -> knockout preview 201: size 4, 4 slots, no byes, winners on seeds 1-2, each R1 pair
    = a winner vs the other group's runner-up (no group clash); 409 before groups confirm; a second preview without
    reason -> 400, with reason -> version 2; Member -> 403. Clean up.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && pnpm test
DONE: push, verify on origin, done message to Kevin (sha + FULL pnpm test line).
