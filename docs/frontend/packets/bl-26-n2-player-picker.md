# PACKET bl-26-n2-player-picker: PlayerPicker: exclude an already-chosen player and show how many clubs each result has (Darryl)

GOAL: In the add-pair form, the second picker must not offer the player already chosen in the first (and vice versa), and each search result shows club names and grade label, enough to tell people with similar names apart.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-26-player-picker` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch to origin and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Source of the finding: docs/design/review-slice-2nd-pass.md item N2 (Pam, browser-verified).

SOURCES:
- `apps/web/features/users/PlayerPicker.tsx` (props `{ value, onChange }`; results come from `usePlayerSearch` in `./api`; `UserSummary` has `id`, `displayName`, `roles`, `teamIds?`). `apps/web/features/entries/AdminEntryForm.tsx` renders two pickers (lines ~171 and ~184 with `player1`, `player2` state).
- UPDATE: openapi 99b26c7 (types regenerated on develop) gives `GET /users` items as `UserPickerItem {id, displayName, teamIds?, teamNames?, gradeLabel?: string|null, gradeProvisional?: boolean}` (check `apps/web/lib/api/schema.d.ts`). Change `UserSummary` in `features/users/api.ts` to this shape if needed.

SPEC:
- Files (ONLY these): `apps/web/features/users/PlayerPicker.tsx`, `apps/web/features/users/PlayerPicker.test.tsx`, and in `apps/web/features/entries/AdminEntryForm.tsx` only the two `<PlayerPicker .../>` lines.
- New optional prop `excludeUserIds?: string[]`. Results whose `id` is in it are filtered out of the list (not shown). If after filtering the list is empty but the raw result was not, show the existing empty text variant 'ผู้เล่นคนนี้ถูกเลือกไปแล้ว'.
- Each option shows the name and, when `teamIds` has entries, a small muted text `data-testid="player-option-clubs"` '{n} สโมสร' (nothing when none or unknown).
- AdminEntryForm: picker 1 gets `excludeUserIds={player2 ? [player2.userId] : []}`, picker 2 `excludeUserIds={player1 ? [player1.userId] : []}`.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens ONLY (grep -E 'bg-(white|blue|gray|red|green|orange|yellow)|text-(gray|blue|red|green|orange|yellow)|border-(gray|red)' must be empty on every line you touch or add); keep every existing data-testid (the Playwright gate uses them).

TOOLS: `pnpm --filter @blulens/web test PlayerPicker` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "does not offer the player already chosen elsewhere": mock usePlayerSearch returning A and B; render with excludeUserIds=[A.id] and open -> only B is listed; with no exclusion both are listed.
- Others: option shows 'A, B' and 'S+' for teamNames ['A','B'] and gradeLabel 'S+', and 'ยังไม่มีเกรด' for null; excluded-only result shows the 'ถูกเลือกไปแล้ว' text; existing PlayerPicker and AdminEntryForm tests stay green.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items, pushed branch + SHA.
