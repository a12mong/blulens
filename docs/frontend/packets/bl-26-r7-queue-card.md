# PACKET bl-26-r7-queue-card: R7: review queue card shows clip count, duration and due badge (Phyllis)

GOAL: A queue card tells the reviewer how many clips, total length and whether it is overdue, still without any player identity.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree OUTSIDE it (sibling folder D:/_work/SourceDev/_code/blulens-<you>-<packet>), branch `fe/bl-26-r7-queue-card` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Source: Pam's findings in docs/design/fe-polish-packets.md and docs/design/review-slice-2.md (read the item named in the title; both are in Thai).

SOURCES:
- `apps/web/features/review/ReviewCard.tsx`, `ReviewQueue.tsx`, tests. Assignment list type in `@/lib/api/schema` (check for clip count / duration fields; if absent, show only what exists and report the gap to andy).

SPEC:
- Files (ONLY): those + tests.
- Add 'N คลิป · ยาวรวม mm:ss' (`data-testid="review-card-clips"`) and a due badge `data-testid="review-card-due"`: overdue = icon + 'เกินกำหนด', else 'เหลือ n วัน'.
- Blind review: never the player or an assessment id.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens ONLY (grep -E 'bg-(white|blue|gray|red|green|orange|yellow)|text-(gray|blue|red|green|orange|yellow)|border-(gray|red)' must be empty on every line you touch); keep EVERY existing data-testid (Playwright gates use them); tap targets >= 44px; status never by colour alone; check document.documentElement.scrollWidth == 390 at 390px if layout changes.

TOOLS: `pnpm --filter @blulens/web test ReviewCard` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "shows clip count and an overdue badge": card with 2 clips and a past dueAt -> '2 คลิป' and 'เกินกำหนด'.
- Others: a future due shows 'เหลือ'; existing card tests green.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items, pushed branch + SHA.
