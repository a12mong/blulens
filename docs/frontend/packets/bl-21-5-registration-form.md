# PACKET bl-21-5-registration-form: EventRegistrationForm component (Ryan)

GOAL: A Member registers themself for an event: pick team with the type-ahead, see a multi-team warning, enter a clip link (stub), accept consent, submit.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-21-registration-form` from `origin/develop`, `pnpm install` there; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190 (not 3100). Never commit to main/develop.
- Review gate: after done, Andy sends your branch to Stanley; merge only on APPROVE.
- Depends on: bl-21-1 and bl-21-4 merged (mock their modules until then)

SOURCES:
- docs/design/screens/S05-registration.md (fields, states; clip upload is a stub in this slice).
- docs/api/openapi.yaml: POST `/me/teams` body {teamId} -> {teams, teamCount, warnings: ['MULTI_TEAM'?]}; POST `/events/{eventId}/entries` body {playerIds:[myId]} -> Entry (409 codes ENTRY_GRADE_OUT_OF_BAND, ENTRIES_CLOSED, NO_APPROVED_GRADE, FRESH_ASSESSMENT_REQUIRED). Me from `useMe()` in `@/features/auth/api`.
- Components: `TeamCombobox` (bl-21-4), `useCreateEntry` (bl-21-1).

SPEC:
- Files (ONLY these): `apps/web/features/events/EventRegistrationForm.tsx`, `apps/web/features/events/EventRegistrationForm.test.tsx`, `apps/web/features/events/api.ts` ONLY to add `useJoinTeam()` (POST /me/teams) — nothing else in that file changes.
- Props: `{ eventId: string; onRegistered?: (e: Entry) => void }`.
- Fields: team via TeamCombobox (required) `data-testid` of the wrapper `reg-team`; clip link input `reg-clip-link` (type=url, optional, helper text "ลิงก์คลิป (ตัวอย่าง) — ยังไม่ถูกส่งในรุ่นนี้", NOT sent to API); consent checkbox `reg-consent` label "ยอมรับกติกาและให้ใช้คลิปเพื่อการประเมิน" (required); submit `reg-submit` text "สมัครแข่ง" disabled until team picked and consent checked.
- Submit sequence: (1) joinTeam({teamId}); if response.warnings includes 'MULTI_TEAM' show `<p role="alert" data-testid="reg-multiteam-warning">คุณสังกัด {teamCount} ทีมแล้ว</p>` (non-blocking); (2) createEntry({playerIds:[me.id]}). On success show `<p role="status" data-testid="reg-success">สมัครเรียบร้อย</p>` and call onRegistered. If the entry response has warnings MULTI_TEAM also show the warning.
- API error: `role="alert"` `data-testid="reg-error"` with the ApiRequestError message (Thai from server).

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI text; tokens/tailwind classes only, no hex; no business logic (API decides, web only renders); no direct fetch in components (use hooks / apiFetch from apps/web/lib/api/client.ts).

TOOLS: `pnpm --filter @blulens/web test EventRegistrationForm` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "joins the team, posts the entry for me, and shows the multi-team warning": mock useMe -> {id:'u1'}, TeamCombobox (vi.mock to a stub calling onChange({teamId:'t1',name:'A'})), joinTeam resolving {teamCount:2,warnings:['MULTI_TEAM']}, createEntry resolving an Entry; pick team, check consent, click submit -> joinTeam called with {teamId:'t1'}, createEntry called with {playerIds:['u1']}, warning text 'คุณสังกัด 2 ทีมแล้ว' visible, reg-success visible.
- Others: submit disabled until team + consent; 409 error message shown in reg-error.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items.
