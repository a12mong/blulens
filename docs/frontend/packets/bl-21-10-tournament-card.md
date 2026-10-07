# PACKET bl-21-10: TournamentCard + TournamentStatusBadge (Darryl)

GOAL: The card shown in the tournament list on /events: name, date, venue, close date, status badge, event types, and a link to open it.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-21-tournament-card` from `origin/develop`, `pnpm install` there; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190 (not 3100). Never commit to main/develop.
- Review gate: after done, Andy sends your branch to Stanley; merge only on APPROVE.
- Depends on: none.

SOURCES:
- docs/design/demo-slice-1.md section D2 "รายการ" wireframe and states.
- docs/api/openapi.yaml: Tournament {id, name, venue?, startsOn (date), entriesCloseAt (date-time), status draft|open|closed|running|finished}; Event {id, discipline MS|WS|MD|WD|XD, gradeMin, gradeMax}. Types: `components['schemas']['Tournament']` and `['TournamentDetail']` (Tournament + events[]) from '@/lib/api/schema'.

SPEC:
- Files (ONLY these): `apps/web/features/events/TournamentStatusBadge.tsx`, `apps/web/features/events/TournamentCard.tsx`, `apps/web/features/events/TournamentCard.test.tsx`.
- TournamentStatusBadge props `{ status: Tournament['status'] }`; `<span data-testid="tournament-status" data-status={status}>` Thai text with a leading symbol (not colour only): draft "ร่าง", open "เปิดรับสมัคร", closed "ปิดรับสมัคร", running "กำลังแข่งขัน", finished "จบแล้ว".
- TournamentCard props `{ tournament: TournamentDetail; canManage?: boolean; onOpen?: (t) => void }`. Root `<article data-testid="tournament-card" data-tournament-id={id}>`. Show: `<h3 data-testid="tournament-name">`, start date formatted Thai with `toLocaleDateString('th-TH', {day:'numeric', month:'short', year:'numeric', timeZone:'Asia/Bangkok'})`, venue if present, "ปิดรับ {date}" from entriesCloseAt (same formatter), the status badge, and an events line: each event as a chip `data-testid="tournament-event-chip"` text `{discipline} {gradeMin}–{gradeMax}` (en dash); if no events show "ยังไม่มีอีเวนต์".
- Link: `<a data-testid="tournament-open" href={`/events/${id}`}>เปิด</a>` (next/link). If `canManage` and status is `draft`, also a button `data-testid="tournament-publish"` "เปิดรับสมัคร" that calls `onOpen?.(tournament)` (the page wires the status mutation; the card never calls the API).

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI text; tailwind classes with theme tokens only, no hex; no direct fetch.

TOOLS: `pnpm --filter @blulens/web test TournamentCard` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "renders name, status text and one chip per event; publish button only for managers on drafts": TournamentDetail with 2 events and status 'draft', canManage -> tournament-name text, tournament-status has data-status draft and text ร่าง, 2 chips with text 'MD S-–S+' style, tournament-publish present and clicking calls onOpen; same with canManage false or status 'open' -> no tournament-publish.
- Others: no events shows "ยังไม่มีอีเวนต์"; open link href is /events/{id}; venue omitted when absent.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items.
