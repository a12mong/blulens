# PACKET bl-21-7: PlayerPicker (Darryl, after bl-21-4)

GOAL: A search-as-you-type picker of Member users for the Committee (find a player by name or email prefix, pick one).

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-21-player-picker` from `origin/develop`, `pnpm install` there; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190 (not 3100). Never commit to main/develop.
- Review gate: after done, Andy sends your branch to Stanley; merge only on APPROVE.
- Depends on: none (copy the pattern of your own TeamCombobox from bl-21-4).

SOURCES:
- docs/api/openapi.yaml: GET `/users?role=Member&q=&limit=` (Committee/Admin) -> `{ items: UserSummary[], nextCursor }`; UserSummary {id, displayName, roles[], teamId|null}.
- Pattern: apps/web/features/teams/TeamCombobox.tsx (debounce 250 ms, combobox/listbox/option roles, keyboard).

SPEC:
- Files (ONLY these): `apps/web/features/users/api.ts`, `apps/web/features/users/PlayerPicker.tsx`, `apps/web/features/users/PlayerPicker.test.tsx`.
- api.ts: `usePlayerSearch(q: string)` = useQuery key ['users','players',q], enabled when q.trim().length >= 1, apiFetch('/users', {query:{role:'Member', q, limit: 8}}), returns `items`.
- Component props: `{ value: { userId: string; displayName: string } | null; onChange: (v: { userId: string; displayName: string } | null) => void }`.
- Markup: `<input role="combobox" data-testid="player-input" aria-expanded aria-controls>`, `<ul role="listbox" data-testid="player-options">`, `<li role="option" data-testid="player-option">` showing displayName. Typing clears value (onChange(null)); click or Enter on an option calls onChange({userId: id, displayName}) and sets the input text; ArrowUp/Down navigate; Escape closes. Empty result: `<p data-testid="player-empty">ไม่พบผู้เล่น</p>`.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI text; tokens/tailwind classes only; no direct fetch in components.

TOOLS: `pnpm --filter @blulens/web test PlayerPicker` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "typing then picking an option calls onChange with the player; typing alone clears it": mock apiFetch to return {items:[{id:'u1',displayName:'สมชาย',roles:['Member'],teamId:null}],nextCursor:null}; type 'สม', advance 250ms, click option -> onChange({userId:'u1',displayName:'สมชาย'}); then type 'x' -> onChange(null).
- Others: empty result shows player-empty; apiFetch called with '/users' and query {role:'Member', q:'สม', limit:8}.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items.
