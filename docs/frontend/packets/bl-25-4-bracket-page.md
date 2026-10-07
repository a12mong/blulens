# PACKET bl-25-4: Public bracket + standings page /events/[id]/bracket (Darryl)

GOAL: A public (guest-viewable) night/pixel page showing group standings and the knockout bracket of an event, auto-refreshing every 30 s, with a fixture mode so it can be shown before the draw endpoints exist.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-25-bracket-page` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch to origin and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Depends on: Bracket, MatchCard, GroupStandingsTable, QualificationBadge, bracketFixture (all merged in `apps/web/features/bracket/`). The API endpoints `GET /events/{eventId}/bracket` and `/standings` are in the contract but NOT served yet (draw/format are not built): the page must show a clear 'ยังไม่ประกาศ' state on 404 and work fully in fixture mode.
- Middleware: `/events` is protected in `apps/web/middleware.ts` for the list/detail pages; check the matcher and make the bracket path public ONLY if it is not already (smallest change; report it).

SOURCES:
- docs/design/demo-slice-3.md section B1 (tabs, states table, refresh 30 s, theme night).
- Hook pattern: `apps/web/features/review/api.ts` (`useQuery` + `apiFetch`). Types `Bracket`, `GroupStanding` in `@/lib/api/schema`.

SPEC:
- Files (ONLY these): `apps/web/features/bracket/api.ts` (hooks `useBracket(eventId)` and `useStandings(eventId)`, `refetchInterval: 30_000`, `retry: false`), `apps/web/features/bracket/BracketPage.tsx`, `apps/web/features/bracket/BracketPage.test.tsx`, `apps/web/app/events/[id]/bracket/page.tsx` (server component, awaits `params: Promise<{id: string}>` and `searchParams`, renders `<BracketPage eventId fixture={sp.fixture === '1'} />`; this route is OUTSIDE the `(app)` group so there is no auth shell), and `apps/web/middleware.ts` only if needed.
- BracketPage props `{ eventId: string; fixture?: boolean }`. Wrapper `<main data-testid="bracket-page" className="min-h-screen bg-night text-night-foreground">`, h1 'สายแข่งขัน', last-updated text 'อัปเดต {HH:mm} (รีเฟรชอัตโนมัติ 30 วิ)'. Tabs (buttons with role=tab): 'รอบกลุ่ม' (one GroupStandingsTable per group, grouping standings by `groupId`, label A, B... in order) and 'สายน็อคเอาท์' (Bracket); default tab = knockout if standings is empty, else groups.
- fixture mode: skip the hooks' data and use `bracketFixture` + a small exported `standingsFixture` (2 groups x 4 rows incl. one provisional) added to `bracketFixture.ts` (you may append there).
- States: loading `role=status` 'กำลังโหลด…'; 404/error with no data: `data-testid="bracket-unpublished"` 'สายแข่งยังไม่ประกาศ' plus a back link to `/events`; other errors `role=alert` via `thaiError`.
- Guests must never see grades: pass nothing grade-related (components already ignore gradeLabel).

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; night theme tokens only; no raw palette classes.

TOOLS: `pnpm --filter @blulens/web test BracketPage` · `pnpm --filter @blulens/web typecheck` · then open `/events/<any>/bracket?fixture=1` in the browser at 1440 and 390 widths and report what you saw.

DONE:
- Proving test "fixture mode shows the groups tab by default and switches to the knockout bracket": render fixture -> two group-standings, click tab 'สายน็อคเอาท์' -> bracket-tree present.
- Others: 404 from the hook shows bracket-unpublished; loading status; refetchInterval is 30000 (assert via the exported hook options or a constant).
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, what you saw at 1440 and 390, unverified, open items, pushed branch + SHA.
