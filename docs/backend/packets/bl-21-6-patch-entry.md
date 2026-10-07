PACKET bl-21-6: PATCH /api/v1/entries/{entryId} — edit a draft or rejected entry (DEMO SLICE follow-up)

Assignee: Meredith (meredith-muxtbonw) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)

GOAL:
  After the Committee rejects an entry, the Admin fixes it (players, clubs, pair name) and forwards it again
  (architecture §6.10: "rejected -> Admin edits -> draft").

STATE:
  Your worktree. Branch dev/bl-21-patch-entry from origin/develop (1c1ee27 or later).
  Already exists (Kevin's, merged): apps/api/src/modules/entries/{entries.controller.ts, entries.service.ts,
  entries.module.ts}; EntriesService has create(), get(), private load(), private present(), private transition();
  shared entryInputSchema (packages/shared/src/schemas/entries.ts); test/entries.e2e-spec.ts shows fixtures
  (player() helper creating graded users, team() helper, cookieFor()).

SOURCES (openapi, pasted):
  PATCH /entries/{entryId}   x-roles [Admin, Committee]   body EntryInput { name?, players: [{ userId, teamId? }] }
    -> 200 Entry  ·  409 ENTRY_NOT_EDITABLE (status not draft/rejected)
  Rules reused from POST /events/{eventId}/entries (same service, same codes): ENTRY_PLAYER_COUNT (doubles 2, singles 1),
  ENTRY_DUPLICATE_PLAYER (same player twice, or already in another entry of this event), USER_NOT_FOUND, TEAM_NOT_FOUND,
  ENTRIES_CLOSED (tournament not open); a picked club becomes a dated membership if new (audited team.member_add).

SPEC:
  Files (ONLY these 3):
    - apps/api/src/modules/entries/entries.controller.ts   (add one handler: @Roles('Admin','Committee') @Patch('entries/:entryId'))
    - apps/api/src/modules/entries/entries.service.ts      (add one public method update(); you MAY extract the player/team
                                                           validation + membership creation from create() into a private
                                                           helper that both use — no behaviour change for create())
    - apps/api/test/entry-edit.e2e-spec.ts                 (new file; copy the setup/teardown style of entries.e2e-spec.ts)
  update(entryId, input, actor, ip), in ONE transaction:
    1. load the entry (404 ENTRY_NOT_FOUND); status must be 'draft' or 'rejected' else 409 ENTRY_NOT_EDITABLE
       "แก้ไขได้เฉพาะรายการที่เป็นร่างหรือถูกปฏิเสธ".
    2. run the same validations as create() for the event of the entry.
    3. replace players: delete this entry's entry_players, create the new ones (gradeResultId = official result as in create()).
       A P2002 on (event_id, user_id) -> 409 ENTRY_DUPLICATE_PLAYER.
    4. update entry: name (null when not given), status 'draft', decidedBy/decidedAt/decisionReason = null when it was rejected.
       Use a conditional updateMany WHERE id AND status IN ('draft','rejected'); count 0 -> 409 ENTRY_NOT_EDITABLE.
    5. audit { action: 'entry.update', entityType: 'entry', entityId, before: { status, players }, after: { players, name } }.
    6. return this.get(entryId, actor).
  Edge cases (e2e):
    - draft entry: PATCH with a different second player -> 200, players replaced, status 'draft'
    - rejected entry: PATCH -> 200, status 'draft', decisionReason null; then POST /entries/{id}/forward -> 200
    - pending_committee entry -> 409 ENTRY_NOT_EDITABLE ; approved -> 409 ENTRY_NOT_EDITABLE
    - player already in ANOTHER entry of the event -> 409 ENTRY_DUPLICATE_PLAYER (and the original entry is unchanged)
    - Member cookie -> 403
  Test users: graded users cannot be deleted (append-only results) — give them NO roles and set status 'disabled' in afterAll,
  exactly like entries.e2e-spec.ts does.

CONSTRAINTS: only the 3 files; no new deps; no `any`; create() behaviour and its tests must stay green; conventional commits; push.
TOOLS: pnpm install --frozen-lockfile · pnpm --filter @blulens/shared build · pnpm --filter @blulens/api test · pnpm --filter @blulens/api lint
  (DB: localhost:5442, copy D:/_work/SourceDev/_code/blulens/.env into your worktree root; never print it.)
DONE (single proving test): apps/api/test/entry-edit.e2e-spec.ts, test "lets the Admin fix a rejected entry and forward it again",
  asserting the second edge case. Report: branch, commit, `git diff --stat origin/develop...HEAD`, commands + real output.
