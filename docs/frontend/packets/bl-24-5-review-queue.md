# PACKET bl-24-5-review-queue: ReviewQueue component + hook + /review page (Ryan)

GOAL: The reviewer's own queue page: progress, filter tabs by state, list of ReviewCards.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-24-review-queue` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- BLIND REVIEW: a reviewer task carries only the assignment id (neutral task id), state and due time. Never show or ask for an assessment id, the player, or whether a task is a calibration clip.

SOURCES:
- docs/design/demo-slice-2.md section R1 (states table). `ReviewCard` (packet bl-24-4, merged first). Hook pattern: `apps/web/features/entries/api.ts` (`useQuery` + `apiFetch` from `@/lib/api/client`). Endpoint `GET /reviews/assignments/me?state=open|submitted|expired` returns `ReviewAssignment[]` (no state param = all).
- Page guard: `apps/web/app/(app)/review/layout.tsx` exists or check; if missing, report instead of creating a guard.

SPEC:
- Files (ONLY these): `apps/web/features/review/api.ts` (hook `useMyAssignments(state?)`, queryKey ['review','assignments',state ?? 'all']), `apps/web/features/review/ReviewQueue.tsx`, `apps/web/features/review/ReviewQueue.test.tsx`, `apps/web/app/(app)/review/page.tsx` (server component: `<h1>คิวของฉัน</h1><ReviewQueue/>`).
- ReviewQueue: fetch all assignments once (`useMyAssignments()`), tabs `data-testid="review-tab-open|submitted|expired"` with counts ('ยังไม่ทำ 8'), default tab open, filtered client-side. Progress text `data-testid="review-progress"` 'เสร็จ {submitted}/{total}' and a `<progress>`-like bar with aria-label. List of ReviewCard sorted by dueAt ascending.
- States: pending `role="status"` skeleton cards `data-testid="review-skeleton"`; error `role="alert"` `data-testid="review-error"` with a 'ลองใหม่' button calling refetch (message via `thaiError` from `@/lib/errors`); empty tab: 'ไม่มีงานในหมวดนี้'; no assignments at all: 'ยังไม่มีงานที่มอบหมายให้คุณ'.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens only; no direct fetch in components; mobile-first (nothing overflows at 390px), tap targets >= 44px.

TOOLS: `pnpm --filter @blulens/web test ReviewQueue` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "shows counts, defaults to the open tab and switches": mock useMyAssignments with 2 open, 1 submitted, 1 expired -> 2 review-card in the open tab, review-progress 'เสร็จ 1/4'; click review-tab-submitted -> 1 card.
- Others: error state with retry calls refetch; loading shows skeletons; cards ordered by dueAt.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items.
