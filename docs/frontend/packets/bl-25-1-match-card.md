# PACKET bl-25-1-match-card: MatchCard (Darryl)

GOAL: One match of a knockout bracket drawn as a pixel/night card: top and bottom entry (name + club), per-game scores, winner mark, and a status badge.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-25-match-card` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Theme tokens already on develop (globals.css @theme): classes `bg-night`, `bg-night-panel`, `bg-night-panel-2`, `border-night-line`, `text-night-foreground`, `text-night-muted`, `font-pixel` (Press Start 2P, Latin/digits ONLY; Thai text and names use the normal sans). Square corners, 2px borders, no shadows, no `any`, icons from lucide-react if already a dependency (else inline text marks).
- Depends on: nothing. Slice 3 early work: the page assembly (`/events/[id]/bracket`) comes later with the real endpoints; today everything is props + test fixtures.

SOURCES:
- docs/design/demo-slice-3.md section B1 (MatchCard rules).
- Types from `@/lib/api/schema`: `components['schemas']['EntryRef']` ({entryId, displayName, players, teamNames, gradeLabel}). Do NOT render gradeLabel.

SPEC:
- Files (ONLY these): `apps/web/features/bracket/MatchCard.tsx`, `apps/web/features/bracket/MatchCard.test.tsx`.
- Export `type MatchStatus = 'scheduled'|'bye'|'reported'|'confirmed'|'walkover'`; `type MatchCardData = { matchNo: number; top: EntryRef | null; bottom: EntryRef | null; winnerId: string | null; status: MatchStatus; games?: { a: number; b: number }[]; withdrawnIds?: string[] }`.
- Props `{ match: MatchCardData; highlightEntryId?: string }`. Markup `<article data-testid="match-card" data-status={status}>` with the match number in `font-pixel` ("#3"), two rows `data-testid="match-top"` / `match-bottom`: name (sans), club (`teamNames.join(', ')`, small muted), per-game scores (font-pixel digits, top row shows a, bottom row b). null entry -> "รอผล" (muted). Winner row (id === winnerId and status confirmed|walkover) shows text "ชนะ" + a check mark and `data-winner="true"`. Withdrawn entries: name struck through + text "ถอนตัว".
- Status badge `data-testid="match-status"` text: scheduled "รอแข่ง", bye "BYE", reported "รอยืนยัน" (card border dashed, a clock mark, title="ยังไม่นับในตารางคะแนน"; NO winner mark even if winnerId set), confirmed no badge, walkover "ไม่มาแข่ง". highlightEntryId row gets `data-highlight="true"` + 2px outline.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; never render a grade; accessible (status never by colour alone); no fetch (pure props component).

TOOLS: `pnpm --filter @blulens/web test MatchCard` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "reported match is dashed, shows รอยืนยัน and no winner; confirmed shows ชนะ on the winner row only": render reported with winnerId=top.entryId -> match-status 'รอยืนยัน', no data-winner; render confirmed -> match-top has data-winner, match-bottom does not.
- Others: bye shows BYE and null bottom 'รอผล'; withdrawn entry has 'ถอนตัว'; gradeLabel text never appears in output.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items.
