# PACKET bl-25-9: Link from the tournament detail to the Committee results queue (Phyllis)

GOAL: A Committee member on the tournament detail page can reach /committee/events/[eventId]/results (the results queue from bl-25-8) with one tap.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree OUTSIDE it (sibling folder D:/_work/SourceDev/_code/blulens-phyllis-results-link), branch `fe/bl-25-results-link` from `origin/develop` (must contain bl-25-8, the results page); `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- ROUTE RULE: the target page must exist on develop before you add the link.

SOURCES:
- `apps/web/features/events/TournamentDetailView.tsx` lines ~118-126: the existing Committee link `data-testid="event-entries-committee"` to `/committee/events/${e.id}/entries` labelled 'คิวอนุมัติ'. Copy its classes exactly.

SPEC:
- Files (ONLY): `apps/web/features/events/TournamentDetailView.tsx`, `apps/web/features/events/TournamentDetailView.test.tsx`.
- Right after the existing Committee link (same `roles.includes('Committee')` condition) add a second Link `data-testid="event-results-committee"` href `/committee/events/${e.id}/results`, label 'ผลที่รอยืนยัน', same classes (min-h 44px). Rename nothing; keep the first link and its label unchanged.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens ONLY (grep -E 'bg-(white|blue|gray|red|green|orange|yellow)|text-(gray|blue|red|green|orange|yellow)|border-(gray|red)' must be empty on lines you touch); keep every existing data-testid; no horizontal overflow at 390px (links wrap; check document.documentElement.scrollWidth == 390).

TOOLS: `pnpm --filter @blulens/web test TournamentDetailView` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "shows the results link to Committee only": roles ['Committee'] -> event-results-committee present with href ending '/results'; roles ['Member'] -> absent.
- Existing tests stay green.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items, pushed branch + SHA.
