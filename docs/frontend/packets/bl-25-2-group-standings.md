# PACKET bl-25-2-group-standings: GroupStandingsTable + QualificationBadge (Darryl)

GOAL: One group's standings as a pixel/night table with qualification badges, footnote for tiebreaks and a provisional marker.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-25-group-standings` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Theme tokens already on develop (globals.css @theme): classes `bg-night`, `bg-night-panel`, `bg-night-panel-2`, `border-night-line`, `text-night-foreground`, `text-night-muted`, `font-pixel` (Press Start 2P, Latin/digits ONLY; Thai text and names use the normal sans). Square corners, 2px borders, no shadows, no `any`, icons from lucide-react if already a dependency (else inline text marks).
- Depends on: nothing. Slice 3 early work: the page assembly (`/events/[id]/bracket`) comes later with the real endpoints; today everything is props + test fixtures.

SOURCES:
- docs/design/demo-slice-3.md section B1 (GroupStandingsTable).
- Types: `components['schemas']['GroupStanding']` from `@/lib/api/schema` (rank, played, won, drawn, lost, points, pointsFor, pointsAgainst, diff, tiebreakNote, qualification, confirmed, entry: EntryRef). Never render gradeLabel.

SPEC:
- Files (ONLY these): `apps/web/features/bracket/QualificationBadge.tsx`, `apps/web/features/bracket/GroupStandingsTable.tsx`, `apps/web/features/bracket/GroupStandingsTable.test.tsx`.
- QualificationBadge props `{ q: 'qualified'|'best_third'|'best_third_contender'|'out' }` -> `<span data-testid="qual-badge" data-q={q}>` icon/mark + text: qualified "เข้ารอบ ✓", best_third "เข้ารอบ (อันดับ 3 ที่ดีที่สุด)", best_third_contender "ลุ้นอันดับ 3", out "ตกรอบ".
- GroupStandingsTable props `{ label: string; rows: GroupStanding[]; pendingReportedCount?: number }`. `<section data-testid="group-standings" aria-label={`กลุ่ม ${label}`}>` heading "กลุ่ม {label}", `<table>` with columns # (font-pixel), คู่ (displayName + club small), แข่ง, ช/ส/พ ("won/drawn/lost"), ผลต่าง (signed: +24, -9), แต้ม, สถานะ (QualificationBadge). Rows sorted by rank; each `data-testid="standing-row"`. If any row `tiebreakNote` -> footnote list `data-testid="tiebreak-note"` "เสมอแต้ม ตัดสินด้วย: {note}". If any row `confirmed === false` -> badge `data-testid="standings-provisional"` "ตารางชั่วคราว". If `pendingReportedCount > 0` -> `data-testid="standings-pending"` "มี {n} แมตช์รอยืนยัน (ยังไม่นับในตาราง)".
- Horizontal scroll inside its own container on phone (nothing overflows the page).

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; never render a grade; accessible (status never by colour alone); no fetch (pure props component).

TOOLS: `pnpm --filter @blulens/web test GroupStandingsTable` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "rows are ordered by rank, show signed diff, qualification badges and the provisional marker": 4 rows given out of order -> standing-row order by rank 1..4; diff text '+24' and '-9'; four qual-badge texts; one confirmed=false -> standings-provisional present; pendingReportedCount=1 -> standings-pending text contains '1 แมตช์'.
- Others: tiebreakNote footnote only when present; gradeLabel never rendered.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items.
