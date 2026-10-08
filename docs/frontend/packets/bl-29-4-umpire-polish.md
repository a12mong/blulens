# PACKET bl-29-4-umpire-polish: Umpire pages: keep the scores on a 401, and fix the court and tie wording (Phyllis)

GOAL: If the session expires while the umpire is submitting a score, the entered scores survive and the umpire is sent to log in and returned to the same match. Court names and tie labels read clearly.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree OUTSIDE it (sibling folder D:/_work/SourceDev/_code/blulens-<you>-4-umpire-polish), branch `fe/bl-29-4-umpire-polish` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Source: Pam's live pass docs/design/review-slice-3.md, item(s) S9 + S10 (Thai; read the table row for the evidence).

SOURCES:
- `apps/web/features/umpire/MatchResultForm.tsx`, `UmpireMatchPage.tsx`, `UmpireMatchCard.tsx`, `scoreRules.ts` (read-only), `api.ts`; draft pattern `apps/web/features/review/useReviewDraft.ts` (localStorage with try/catch); `apps/web/lib/errors.ts` / `ApiRequestError` (status 401); AuthedShell already redirects a stale session on /me.

SPEC:
- Files (ONLY): `MatchResultForm.tsx`, `UmpireMatchPage.tsx`, `UmpireMatchCard.tsx`, new `useResultDraft.ts` + `useResultDraft.test.ts`, and the existing tests of those components.
- S9: `useResultDraft(matchId)` stores `{games:[{a,b}], outcome}` under `bl:result-draft:{matchId}` (try/catch like useReviewDraft); MatchResultForm writes it on every change, restores it on mount, clears it after a successful report. When the mutation fails with ApiRequestError status 401: keep the draft, close the dialog, `router.push('/login?next=' + encodeURIComponent(pathname))`. No 401 text inside the dialog.
- S10: court text printed as '{court}' only when the court label already starts with 'สนาม' else 'สนาม {court}' (never 'สนาม สนาม 1'); the tie label becomes 'เสมอ {a}–{b} เกม' with a second line 'แต้มรวม {sumA}–{sumB}' (compute from games); the winner label similarly 'ชนะ {a}–{b} เกม'.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens ONLY: day tokens only (bg-card, bg-primary, text-muted-foreground, bg-warning, ...); grep -E 'bg-(white|blue|gray|red|green|orange|yellow)|text-(gray|blue|red|green|orange|yellow)|border-(gray|red)' must be empty on every line you touch; NO emoji anywhere in UI text (use the SVG icon pattern of `components/ui/WarningBanner.tsx`, aria-hidden, plus text); keep every existing data-testid (Playwright gates use them); tap targets >= 44px; status never by colour alone; document.documentElement.scrollWidth == 390 at 390px.

TOOLS: `pnpm --filter @blulens/web test Umpire` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "keeps the scores and redirects to login on 401": submit rejects with ApiRequestError status 401 -> router.push called with a /login?next=... URL, the draft key holds the entered scores, remount restores them.
- Others: court 'สนาม 1' is not doubled; tie label shows games and total points; draft cleared after success.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items, pushed branch + SHA.
