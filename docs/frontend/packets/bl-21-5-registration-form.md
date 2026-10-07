# PACKET bl-21-5: RegisterPlayerForm (Committee registers a player on behalf) (Ryan)

GOAL: On an event page a Committee user picks a player, picks the player's team with the type-ahead, and registers the player into the event. (Slice decision D-S4: Member self-registration comes later; the form is the same shape.)

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-21-register-player-form` from `origin/develop`, `pnpm install` there; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190 (not 3100). Never commit to main/develop.
- Review gate: after done, Andy sends your branch to Stanley; merge only on APPROVE.
- Depends on: bl-21-1 (hooks), bl-21-4 (TeamCombobox), bl-21-7 (PlayerPicker) merged. Until then vi.mock their modules in your test.

SOURCES:
- docs/api/openapi.yaml: POST `/teams/{teamId}/members` body {userId, validFrom: 'YYYY-MM-DD'} -> 201 (409 Conflict if already a member: treat 409 as OK, continue); POST `/events/{eventId}/entries` body {playerIds:[userId]} -> Entry with `warnings` (409 codes ENTRY_GRADE_OUT_OF_BAND, ENTRIES_CLOSED, NO_APPROVED_GRADE, FRESH_ASSESSMENT_REQUIRED); entry.players[].teamCount (A11 multi-team warning when > 1).
- Components: `PlayerPicker` (bl-21-7, props `{ value: {userId,displayName}|null, onChange }`), `TeamCombobox` (bl-21-4, props `{ value: {teamId,name}|null, onChange }`), `useCreateEntry` (bl-21-1).

SPEC:
- Files (ONLY these): `apps/web/features/events/RegisterPlayerForm.tsx`, `apps/web/features/events/RegisterPlayerForm.test.tsx`, `apps/web/features/events/api.ts` ONLY to add `useAddTeamMember()` (POST `/teams/{teamId}/members`, variables `{ teamId, userId, validFrom }`; treat ApiRequestError status 409 as success by catching and returning undefined). Nothing else in api.ts changes.
- Props: `{ eventId: string; onRegistered?: (e: Entry) => void }`.
- Fields: player via PlayerPicker (wrapper `data-testid="reg-player"`); team via TeamCombobox (wrapper `data-testid="reg-team"`); clip link input `reg-clip-link` (type=url, optional, helper text "ลิงก์คลิป (ตัวอย่าง) ยังไม่ถูกส่งในรุ่นนี้", NOT sent to API); submit `reg-submit` text "ลงทะเบียนผู้เล่น", disabled until player and team are picked.
- Submit sequence: (1) addTeamMember({teamId, userId, validFrom: today as YYYY-MM-DD from `new Date().toISOString().slice(0,10)`}); (2) createEntry({playerIds:[userId]}). On success: show `<p role="status" data-testid="reg-success">ลงทะเบียนเรียบร้อย</p>`, call onRegistered(entry), reset both pickers. If entry.warnings includes 'MULTI_TEAM' (or any player teamCount > 1) show `<p role="alert" data-testid="reg-multiteam-warning">ผู้เล่นสังกัด {teamCount} ทีมแล้ว</p>` with the max teamCount.
- API error from either call: `role="alert"` `data-testid="reg-error"` with the ApiRequestError message (Thai from server).

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI text; tokens/tailwind classes only, no hex; no business logic (API decides); no direct fetch in components.

TOOLS: `pnpm --filter @blulens/web test RegisterPlayerForm` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "adds the player to the team, then posts the entry, then shows the multi-team warning": vi.mock PlayerPicker/TeamCombobox as stubs that call onChange({userId:'u1',displayName:'A'}) / ({teamId:'t1',name:'T'}); addTeamMember resolves; createEntry resolves an Entry with warnings ['MULTI_TEAM'] and players [{teamCount:2}]; click submit -> addTeamMember called with {teamId:'t1', userId:'u1', validFrom: <today>} BEFORE createEntry called with {playerIds:['u1']}; text 'ผู้เล่นสังกัด 2 ทีมแล้ว' visible; reg-success visible.
- Others: submit disabled until both picked; 409 on addTeamMember is swallowed and createEntry still runs; entry API error shown in reg-error.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items.
