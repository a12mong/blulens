# PACKET bl-21-5-registration-form: AdminEntryForm (Admin creates a doubles entry) (Ryan)

GOAL: On the event page an Admin (or Committee) creates a doubles entry: two players, a club for each, optional pair name. The entry is saved as a draft, then forwarded to the Committee.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-21-admin-entry-form` from `origin/develop`, `pnpm install` there; before typecheck run `pnpm --filter @blulens/shared build`. Run `pnpm --filter @blulens/web gen:api` if types look stale. Dev servers on port 3190 (not 3100). Never commit to main/develop.
- Review gate: after done, Andy sends your branch to Stanley; merge only on APPROVE.
- Depends on: bl-21-8, bl-21-4 (TeamCombobox) and bl-21-7 (PlayerPicker) merged; vi.mock them until then

SOURCES:
- Contract (docs/api/openapi.yaml, develop 07543e2): EntryInput `{ name?, players: [{ userId, teamId? }] }` (doubles = exactly 2 players; slice 1 = doubles); Entry `{ id, eventId, status, name, forwardedAt, decidedAt, decisionReason, players[{userId, displayName, teamIds, teamCount, grade|null}], warnings[] }`; EntryStatus = draft | pending_committee | approved | rejected | withdrawn. Warnings (strings): MULTI_TEAM, NO_APPROVED_GRADE, GRADE_OUT_OF_BAND, FRESH_ASSESSMENT_REQUIRED. Lifecycle: POST `/events/{id}/entries` -> draft; POST `/entries/{id}/forward` (Admin|Committee) draft -> pending_committee; POST `/entries/{id}/approve` (Committee; body `{reason?}`; 409 ENTRY_PLAYER_UNGRADED, 409 ENTRY_OUT_OF_BAND_REASON_REQUIRED needs reason >= 20 chars); POST `/entries/{id}/reject` (Committee; body `{reason}`); PATCH `/entries/{id}` (draft/rejected only). Queue: GET `/entries?status=pending_committee&eventId=`; GET `/events/{id}/entries?status=`. Hard errors on create: ENTRIES_CLOSED, ENTRY_PLAYER_COUNT, ENTRY_DUPLICATE_PLAYER. (Check the exact request bodies of approve/reject/PATCH in openapi before coding.)
- Components: `PlayerPicker` (`{ value: {userId,displayName}|null, onChange }`), `TeamCombobox` (`{ value: {teamId,name}|null, onChange }`), hooks from bl-21-8. Owner decision: no self-registration; slice = doubles; singles later.

SPEC:
- Files (ONLY these): `apps/web/features/entries/AdminEntryForm.tsx`, `apps/web/features/entries/AdminEntryForm.test.tsx`.
- Props: `{ eventId: string; onDone?: (entry: Entry) => void }`.
- Layout: two player blocks "ผู้เล่นคนที่ 1" / "ผู้เล่นคนที่ 2", each = PlayerPicker (wrapper `data-testid="entry-player-1"` / `entry-player-2`) + TeamCombobox (wrapper `entry-team-1` / `entry-team-2`); optional text input `entry-name` (max 80, label "ชื่อคู่ (ไม่บังคับ)"); buttons: `entry-save-draft` text "บันทึกร่าง", `entry-forward` text "ส่งให้คณะกรรมการ".
- Both buttons disabled until both players picked, both distinct (same userId twice -> inline `role="alert"` `entry-error` "เลือกผู้เล่นซ้ำกัน"). Team per player is optional (but show helper text "ควรเลือกสโมสร เพราะกติกาจับสายใช้ทีม" if empty).
- Save draft: createEntry({name?, players:[{userId, teamId?},{...}]}) (omit empty name and missing teamId). Forward: createEntry then forwardEntry({entryId}) in sequence; on success call onDone(entry) and reset.
- Show returned `entry.warnings` after create as chips with Thai text in `<ul data-testid="entry-warnings">`: MULTI_TEAM "ผู้เล่นสังกัดหลายทีม", NO_APPROVED_GRADE "ผู้เล่นยังไม่มีเกรดที่อนุมัติ", GRADE_OUT_OF_BAND "เกรดอยู่นอกช่วงอีเวนต์", FRESH_ASSESSMENT_REQUIRED "อีเวนต์นี้ต้องประเมินใหม่" (warnings do NOT block saving or forwarding).
- API error: `role="alert"` `entry-error` with ApiRequestError message; pending state disables both buttons.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI text; tailwind classes with theme tokens only, no hex; no business logic (API decides eligibility/status, web only renders and sends); no direct fetch in components (hooks only).

TOOLS: `pnpm --filter @blulens/web test AdminEntryForm` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "forward creates the draft with two players then forwards it": vi.mock PlayerPicker/TeamCombobox as stubs that call onChange with fixed values per instance; mock hooks; click `entry-forward` -> createEntry mutateAsync called with {players:[{userId:'u1',teamId:'t1'},{userId:'u2',teamId:'t2'}]} (no name key) THEN forwardEntry called with {entryId:<created id>}; onDone called once.
- Others: buttons disabled until both players picked; same player twice shows entry-error; warnings rendered after save draft; API error shown.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items.
