# PACKET bl-26-8-tournament-detail-ctas: TournamentDetailView: real CTAs and counts instead of underlined links (Darryl)

GOAL: Each event row on the tournament page shows its entry count and clear buttons (not underlined links) for the actions the user's role allows.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/fe/bl-26-tournament-ctas` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch to origin (git push origin HEAD:fe/fe/bl-26-tournament-ctas) so the reviewer and I can fetch it.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.

SOURCES:
- `apps/web/features/events/TournamentDetailView.tsx` (55 lines; read it). Event type from `@/features/events/api` `useEvents` (check fields: id, discipline, gradeMin, gradeMax, entryCount, maxEntries if present). docs/design/review-slice-1.md item #8 (Pam).

SPEC:
- Files (ONLY these): `apps/web/features/events/TournamentDetailView.tsx` and its test file (`TournamentDetailView.test.tsx`, create if missing).
- Keep every existing data-testid (tournament-detail, tournament-name, event-list, event-row, event-entries-admin, event-entries-committee, event-empty): the Playwright gate uses them.
- Per event row: discipline label and grade range as the row title; a count text `data-testid="event-entry-count"` 'ผู้สมัคร {entryCount} คู่' (plus ' / สูงสุด {maxEntries}' when maxEntries is set; if entryCount is undefined show nothing); the two links become button-styled links (`inline-flex min-h-[44px] items-center rounded border border-border bg-card px-4 text-sm font-medium`; admin one primary: `bg-primary text-primary-foreground`). Same hrefs and role conditions as now.
- When the tournament is not open (`t.status !== 'open'`) show a small note `data-testid="tournament-not-open"` 'ยังไม่เปิดรับสมัคร' above the list (Admin cannot add entries then).
- Loading text replaced by a simple skeleton `data-testid="tournament-skeleton"` with `role="status"` and aria-label 'กำลังโหลด'; the error message via `thaiError(tournament.error, 'ไม่พบทัวร์นาเมนต์')` from `@/lib/errors`.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens ONLY (grep -E 'bg-(white|blue|gray|red|green|orange)|text-(gray|blue|red|green|orange)|border-(gray|red)' must be empty on your files: use bg-card, border-border, bg-primary text-primary-foreground, text-muted-foreground, text-destructive, bg-secondary...); no direct fetch in components.

TOOLS: `pnpm --filter @blulens/web test TournamentDetailView` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "shows the entry count and role-based action buttons per event": mock useMe roles ['Admin','Committee'], useTournament open, useEvents one event with entryCount 3 and maxEntries 16 -> event-entry-count 'ผู้สมัคร 3 คู่ / สูงสุด 16', both links with the right hrefs; with roles ['Committee'] only the committee link; tournament status 'draft' -> tournament-not-open present.
- Others: skeleton while pending; error shows Thai message.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items, pushed branch + SHA.
