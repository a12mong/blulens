# PACKET bl-21-4-team-combobox: TeamCombobox type-ahead (Darryl)

GOAL: A type-ahead team picker: the user types, picks from suggestions, and can request a new team if nothing matches. Free text alone is never accepted (owner decision A8).

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-21-team-combobox` from `origin/develop`, `pnpm install` there; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190 (not 3100). Never commit to main/develop.
- Review gate: after done, Andy sends your branch to Stanley; merge only on APPROVE.
- Depends on: none

SOURCES:
- docs/api/openapi.yaml: GET `/teams/suggest?q=&limit=` -> array of {teamId, name, matchedAlias|null, distance}; POST `/team-requests` body {name} -> TeamRequest {id,name,status}.
- docs/specs/architecture.md section 6.6 (Thai): search by Thai/English name/alias, no match -> "ขอเพิ่มทีม".
- Pattern: apps/web/features/auth/api.ts for hooks style.

SPEC:
- Files (ONLY these): `apps/web/features/teams/api.ts`, `apps/web/features/teams/TeamCombobox.tsx`, `apps/web/features/teams/TeamCombobox.test.tsx`.
- api.ts: `useTeamSuggestions(q: string)` = useQuery key ['teams','suggest',q], enabled only when q.trim().length >= 1, calls apiFetch('/teams/suggest', {query:{q, limit: 8}}); `useRequestTeam()` = useMutation POST '/team-requests' {name}.
- Component props: `{ value: { teamId: string; name: string } | null; onChange: (v: { teamId: string; name: string } | null) => void }`.
- Markup: `<input role="combobox" aria-expanded aria-controls data-testid="team-input">`; list `<ul role="listbox" data-testid="team-options">` with `<li role="option" data-testid="team-option">` per suggestion; each shows `name` and, when matchedAlias is set, small text "(ชื่อเดิม: {matchedAlias})". Debounce the query 250 ms (use a local useEffect timer; tests use vi.useFakeTimers).
- Behaviour: typing clears `value` (calls onChange(null)) so a typed-but-unpicked string is never submitted; clicking or Enter on an option calls onChange({teamId,name}) and sets the input text to name; ArrowUp/Down moves selection (aria-activedescendant); Escape closes.
- No match (query >= 1 char, loaded, empty list): show a button `data-testid="team-request-new"` text `ขอเพิ่มทีม "{q}"`; click calls useRequestTeam().mutate({name:q}); on success show `<p role="status" data-testid="team-request-sent">ส่งคำขอแล้ว รอคณะกรรมการอนุมัติ</p>`.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI text; tokens/tailwind classes only, no hex; no business logic (API decides, web only renders); no direct fetch in components (use hooks / apiFetch from apps/web/lib/api/client.ts).

TOOLS: `pnpm --filter @blulens/web test TeamCombobox` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "typing then picking an option calls onChange with the team; typing alone clears it": mock apiFetch (or the hooks) to return [{teamId:'t1',name:'Blue Wing',matchedAlias:null,distance:0}]; type 'blu', advance 250ms, click option -> onChange called with {teamId:'t1',name:'Blue Wing'}; then type 'x' -> onChange called with null.
- Others: matchedAlias text rendered; empty result shows the request-new button and clicking posts {name}; keyboard ArrowDown+Enter picks.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items.
