# PACKET bl-25-10-public-standings-page: Public group standings page /events/[id]/standings with the lock state (Darryl)

GOAL: Anyone (no login) opens /events/[id]/standings and sees the group tables, a badge saying whether the groups are locked or still provisional, and a link to the bracket. Today the owner only has the raw JSON URL.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree OUTSIDE it (sibling folder D:/_work/SourceDev/_code/blulens-<you>-standings-page), branch `fe/bl-25-standings-page` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.

SOURCES:
- `apps/web/features/bracket/BracketPage.tsx` (night style, `groupStandings()` grouping helper, GroupStandingsTable use, loading/error/empty states), `GroupStandingsTable.tsx` (`confirmed` flag per row, tiebreak notes), `api.ts` (`useStandings(eventId)` -> `GroupStanding[]`: groupId, entry, rank, played, won, drawn, lost, points, pointsFor, pointsAgainst, diff, tiebreakNote, qualification, confirmed). `apps/web/middleware.ts` public exception regex for /events/:id/bracket. `apps/web/app/events/[id]/bracket/page.tsx` as the page pattern (params is a Promise). Design: docs/design/screens/S18-group-draw-standings.md (standings table part).

SPEC:
- Files (ONLY): `apps/web/features/bracket/StandingsPage.tsx`, `StandingsPage.test.tsx`, `apps/web/app/events/[id]/standings/page.tsx` (server component, `const { id } = await params;` renders `<StandingsPage eventId={id} />`), and in `apps/web/middleware.ts` ONLY the regex so `/events/:id/standings` is public too: `^/events/[^/]+/(?:bracket|standings)(?:/.*)?$`.
- StandingsPage props `{ eventId: string }`: night page shell like BracketPage; header 'ตารางคะแนนกลุ่ม'; one GroupStandingsTable per group (reuse BracketPage's grouping: move nothing, import/copy minimal; if `groupStandings` is not exported, export it from BracketPage.tsx with no other change to that file); lock badge `data-testid="standings-lock"`: all rows confirmed -> 'ล็อกแล้ว' (icon + text), otherwise 'ยังไม่ครบ: มีผลที่รอยืนยัน' (icon + text); link `data-testid="standings-bracket-link"` 'ดูสายน็อคเอาท์' to /events/{eventId}/bracket (44px).
- States: loading `role="status"` `data-testid="standings-loading"`; error `role="alert"` via thaiError + 'ลองใหม่'; empty (no groups) 'ยังไม่มีการจับกลุ่ม'. Refetch every 30s like useStandings already does.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens ONLY: night + pixel tokens (same as the bracket page: bg-night, bg-night-panel, border-night-line, font-pixel); grep -E 'bg-(white|blue|gray|red|green|orange|yellow)|text-(gray|blue|red|green|orange|yellow)|border-(gray|red)' must be empty on every line you touch; keep every existing data-testid; mobile-first (document.documentElement.scrollWidth == 390 at 390px); tap targets >= 44px; status never by colour alone; no direct fetch in components.

TOOLS: `pnpm --filter @blulens/web test StandingsPage` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "shows one table per group and the provisional badge until every row is confirmed": mock useStandings with 2 groups, one row confirmed:false -> 2 tables, standings-lock shows 'ยังไม่ครบ'; all confirmed:true -> 'ล็อกแล้ว'.
- Others: empty state text; error with retry; the bracket link href.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items, pushed branch + SHA.
