# PACKET bl-25-3: Bracket (knockout rounds, tree on desktop, list on phone) (Darryl)

GOAL: Render a knockout bracket from `rounds[]` of MatchCards: left-to-right tree on desktop, per-round accordion list on phone, with a visually hidden text table for screen readers.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-25-bracket` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch to origin and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Depends on: MatchCard (merged, `apps/web/features/bracket/MatchCard.tsx`). Pure props: no fetch, the page comes later with the real endpoint.

SOURCES:
- docs/design/demo-slice-3.md section B1 (Bracket rules). Night theme tokens (`bg-night`, `bg-night-panel`, `border-night-line`, `text-night-foreground`, `text-night-muted`, `font-pixel`) are in globals.css.
- `Bracket` shape: `components['schemas']['Bracket']` -> `rounds[{round, matches[{matchNo, top, bottom, winner, status, topEntry, bottomEntry}]}]` (topEntry/bottomEntry are EntryRef or null). `MatchCardData` from MatchCard.tsx.

SPEC:
- Files (ONLY these): `apps/web/features/bracket/Bracket.tsx`, `apps/web/features/bracket/Bracket.test.tsx`, `apps/web/features/bracket/bracketFixture.ts` (exported typed fixture: 8-entry knockout, 3 rounds, statuses mixed: some confirmed, one reported, one scheduled, one bye).
- Props `{ rounds: BracketRound[]; highlightEntryId?: string }`. Round title from the number of rounds: last = 'รอบชิง' (F), previous 'รองชนะเลิศ' (SF), previous 'รอบ 8 ทีม' (QF), then 'รอบ {2^k} ทีม'; titles also shown as pixel labels F/SF/QF/R16 in `font-pixel`.
- Map each match to `MatchCardData` (`winnerId = match.winner`, games undefined, `top = topEntry`, `bottom = bottomEntry`).
- Desktop layout (`lg:` and up): `<div data-testid="bracket-tree">` columns per round, 2px square connector lines optional (a left border on the round column is enough). Phone (below lg): `<div data-testid="bracket-list">` one `<details open>` per round (summary = title) with the MatchCards stacked. Render both and hide with `hidden lg:flex` / `lg:hidden`.
- A visually hidden `<table data-testid="bracket-sr-table">` (`sr-only`): columns รอบ, แมตช์, คู่บน, คู่ล่าง, สถานะ (Thai status text), ผู้ชนะ.
- Empty `rounds`: text 'ยังไม่มีสายแข่ง'.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens only (night tokens for this page); never render a grade; keep it pure props.

TOOLS: `pnpm --filter @blulens/web test Bracket` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "renders one match card per match in both layouts, titles the rounds and keeps a reported match unconfirmed": with the fixture, count `match-card` = 2 x (number of matches) (tree + list), round titles include 'รอบชิง' and 'รองชนะเลิศ'; the reported match card has `data-status="reported"` and no `data-winner`; sr table has one row per match.
- Others: highlightEntryId marks that entry's rows; empty rounds text.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items, pushed branch + SHA.
