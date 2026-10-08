# PACKET bl-25-8: Committee results queue: approve or send back reported match results (Darryl)

GOAL: The Committee opens /committee/events/[eventId]/results, sees the matches an umpire has reported, and approves each one or sends it back to the umpire with a reason.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree OUTSIDE it (sibling folder D:/_work/SourceDev/_code/blulens-darryl-results), branch `fe/bl-25-results-queue` from `origin/develop` (>= 5b4444e); `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Start AFTER packet bl-26-p5p6 is pushed.

SOURCES:
- openapi (already in `apps/web/lib/api/schema.d.ts`): `GET /events/{eventId}/matches?status=reported` (public list, `Match`), `POST /matches/{matchId}/result/approve` (reported -> confirmed; 409 MATCH_NOT_REPORTED, 409 STAGE_CONFIRMED), `POST /matches/{matchId}/result/reject` body `{ reason }` (5..2000 chars; reported -> scheduled). Both return `Match`.
- Patterns: `apps/web/features/assessments/AssessmentDecisions.tsx` (dialog + mutation), `ReasonDialog` in `@/components/ui/ReasonDialog`, `features/umpire/api.ts` (useReportResult pattern), `features/umpire/UmpireMatchCard.tsx` (how a Match is shown), `apps/web/app/(app)/committee/events/[eventId]/entries/page.tsx` (page shape; params is a Promise), `thaiError` in `@/lib/errors`.

SPEC:
- Files (ONLY): `apps/web/features/results/api.ts` (hooks `useReportedMatches(eventId)` queryKey ['events',eventId,'matches','reported']; `useMatchDecision(eventId)` mutate `{ matchId, action:'approve'|'reject', reason? }`; onSuccess invalidates ['events',eventId,'matches'] and ['events',eventId,'bracket'] and ['events',eventId,'standings']), `apps/web/features/results/ResultsQueue.tsx`, `apps/web/features/results/ResultsQueue.test.tsx`, `apps/web/app/(app)/committee/events/[eventId]/results/page.tsx` (server component, renders `<ResultsQueue eventId={eventId} />`), `apps/web/lib/errors.ts` (+ test) only to add MATCH_NOT_REPORTED 'แมตช์นี้ไม่ได้อยู่ในสถานะรอยืนยัน' if missing.
- ResultsQueue props `{ eventId: string }`. One row per reported match `data-testid="result-row"`: the two sides' names, each game score ('15–11, 15–9'), stage, court if any, `data-testid="result-approve"` 'ยืนยันผล' (confirm dialog role=dialog 'ยืนยันผลแมตช์นี้?'), `data-testid="result-reject"` 'ส่งกลับให้กรรมการ' (ReasonDialog minLength 5, confirmLabel 'ส่งกลับ'). Buttons min-h 44px, disabled while pending. Walkover shows text 'ชนะโดยไม่ลงแข่ง' instead of scores.
- States: skeleton `data-testid="results-loading"` role=status; error `data-testid="results-error"` role=alert via thaiError + 'ลองใหม่'; empty 'ไม่มีผลที่รอยืนยัน'. Mutation errors show in the dialog via thaiError.
- Link from the Committee area: only add it if an event-level committee page already exists with a nav list; otherwise report the missing entry point to andy (do not invent a page).

CONSTRAINTS: only the listed files; no new dependencies; no `any` (use types from `@/lib/api/schema`); Thai UI; theme tokens ONLY (grep -E 'bg-(white|blue|gray|red|green|orange|yellow)|text-(gray|blue|red|green|orange|yellow)|border-(gray|red)' must be empty); mobile-first (check document.documentElement.scrollWidth == 390 at 390px); tap targets >= 44px; status never by colour alone; no direct fetch in components.

TOOLS: `pnpm --filter @blulens/web test ResultsQueue` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "approves a reported match and sends another back with a reason": two reported rows; approve -> confirm dialog -> mutate called with {matchId, action:'approve'}; reject opens ReasonDialog, 4 chars keeps submit disabled, 5 chars enables and mutate called with {matchId, action:'reject', reason}.
- Others: empty state; error with retry; walkover row shows the walkover text and no scores; MATCH_NOT_REPORTED maps to Thai.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items, pushed branch + SHA.
