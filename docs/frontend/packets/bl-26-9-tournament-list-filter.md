# PACKET bl-26-9: Tournament list: search, status filter, demote the publish button (Darryl)

GOAL: With many tournaments the Committee/Admin can find one quickly (search by name, filter by status), and the main action on each card is "เปิด" while "เปิดรับสมัคร" reads as a secondary action. Also tokenise error text and use thaiError.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-26-list-filter` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch to origin and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Source of the finding: docs/design/review-slice-1.md items #9 (and #15-17 in part), Pam.

SOURCES:
- `apps/web/features/events/TournamentList.tsx` (143 lines: `TournamentList` renders `items` from `useTournaments()`; `TournamentCardWithEvents`), `apps/web/features/events/TournamentCard.tsx` (publish button `tournament-publish` and open link `tournament-open` at the bottom). Status values: `draft | open | closed | ...` (see `TournamentStatusBadge.tsx` for the full list and Thai labels). `thaiError` in `@/lib/errors`.

SPEC:
- Files (ONLY these): `apps/web/features/events/TournamentList.tsx`, `apps/web/features/events/TournamentCard.tsx`, `apps/web/features/events/TournamentList.test.tsx` (extend or create), `apps/web/features/events/TournamentCard.test.tsx` (extend only if needed).
- Above the list (when items exist): search input `data-testid="tournament-search"` placeholder 'ค้นหาชื่อทัวร์นาเมนต์' (client-side, case-insensitive substring on `name`, trims), and a status `<select data-testid="tournament-status-filter">` with 'ทุกสถานะ' + each status that appears in the data with its Thai label from TournamentStatusBadge (export the label map from there ONLY if it is not exported yet: then add that one-line export, TournamentStatusBadge.tsx joins the file list). Filtering is client-side over `items`.
- When filters hide everything: `data-testid="tournament-no-match"` 'ไม่พบทัวร์นาเมนต์ที่ตรงกับการค้นหา' with a 'ล้างตัวกรอง' button.
- TournamentCard: the open link stays the primary button; the publish button becomes the secondary style (`border border-border bg-card text-foreground hover:bg-muted`) so the two are not equally prominent. Keep both testids.
- Errors: in `TournamentList.tsx` use `thaiError(error, 'เกิดข้อผิดพลาดในการโหลดทัวร์นาเมนต์')` for the list error and `thaiError(err, 'ไม่สามารถเปิดรับสมัครได้')` for the publish error.
- Tap targets at least 44px high for the new controls; nothing wider than 390px (check `document.documentElement.scrollWidth` equals 390 in a browser at 390).

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens ONLY (grep -E 'bg-(white|blue|gray|red|green|orange|yellow)|text-(gray|blue|red|green|orange|yellow)|border-(gray|red)' must be empty on lines you touch); keep every existing data-testid.

TOOLS: `pnpm --filter @blulens/web test TournamentList` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "search and status filter narrow the list and show a no-match state": mock useTournaments with 3 tournaments (names 'เชียงใหม่ โอเพ่น' open, 'กรุงเทพ คัพ' draft, 'ภูเก็ต โอเพ่น' open) -> type 'โอเพ่น' -> 2 cards; choose status draft -> 0 cards and tournament-no-match; click 'ล้างตัวกรอง' -> 3 cards.
- Others: publish button has the secondary classes (no `bg-primary`), open link keeps `bg-primary`; thaiError used for the list error.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, what you saw at 1440 and 390 incl. scrollWidth, unverified, open items, pushed branch + SHA.
