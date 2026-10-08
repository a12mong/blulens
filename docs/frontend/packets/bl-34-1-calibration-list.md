# PACKET bl-34-1: Calibration sets list + create page S16, part 1 (Phyllis)

GOAL: The Committee opens /committee/calibration, sees every calibration set (name, period, clip count) and can create a new empty set by name and period. The set detail page is the next packet (bl-34-2), so each card only links there.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree OUTSIDE it (sibling folder D:/_work/SourceDev/_code/blulens-phyllis-calib), branch `fe/bl-34-calibration-list` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch and send the SHA.
- Review gate: Andy self-reviews (reviewers on the Gemini side are down); merge only after tests + tsc are green.
- ROUTE RULE: `GET/POST /calibration-sets` may not be on develop yet (check `apps/api/src/modules`). The page must still be built against the contract in docs/api/openapi.yaml (~line 631; types in apps/web/lib/api/schema.d.ts, run `pnpm gen:api` if stale). Andy will not merge until the routes exist on develop, OR the page is hidden behind `process.env.NEXT_PUBLIC_CALIBRATION_UI === '1'` (default off; tests set it). Do the flag from the start.

SOURCES:
- Design: docs/design/screens/S16-calibration-sets.md (Committee part only). Reviewers must never learn a clip is calibration: do NOT add any calibration wording to reviewer pages.
- Contract: `GET /calibration-sets` -> CalibrationSet[] {id, name, period, clips[{clipId, referenceKey}], createdAt}; `POST /calibration-sets` body `{ name, period? }` -> 201 CalibrationSet.
- Patterns: `features/teams/TeamRequestsQueue.tsx` + `requestsApi.ts` (list + mutation + invalidation + states), `features/results/api.ts`, `thaiError` in apps/web/lib/errors.ts, committee page shape `apps/web/app/(app)/committee/teams/requests/page.tsx` and guard `committee/layout.tsx`.

SPEC:
- Files (ONLY): `apps/web/features/calibration/api.ts` (`useCalibrationSets()` key ['calibration-sets']; `useCreateCalibrationSet()` onSuccess invalidates ['calibration-sets']; pass plain object bodies, apiFetch serialises, never JSON.stringify), `apps/web/features/calibration/CalibrationSets.tsx`, `CalibrationSets.test.tsx`, `apps/web/app/(app)/committee/calibration/page.tsx` (server component, h1 'ชุดคลิปมาตรฐาน', renders `<CalibrationSets />` only when the flag is on, otherwise `notFound()`), `apps/web/features/committee/CommitteeHome.tsx` + test ONLY to add a card `committee-link-calibration` 'ชุดคลิปมาตรฐาน' (desc 'สร้างชุดคลิปและดูความลำเอียงของผู้ตรวจ') to /committee/calibration, rendered only when the flag is on.
- CalibrationSets (no props): one card per set `data-testid="calibration-card"`: name, period (or 'ไม่ระบุรอบ'), 'คลิป {n} คลิป', link 'เปิดชุด' to /committee/calibration/{id} (min-h 44px). Create form `data-testid="calibration-create"`: name input (required, <= 120), period input (placeholder 2026-Q4, optional), submit 'สร้างชุด' (min-h 44px, disabled while pending or name empty); success clears the form and the list refreshes; failure shows thaiError in `calibration-create-error` role=alert.
- States: skeleton `calibration-loading` role=status; error `calibration-error` role=alert + 'ลองใหม่'; empty `calibration-empty` 'ยังไม่มีชุดมาตรฐาน'.

CONSTRAINTS: only the listed files; no new dependencies; no `any` outside tests; Thai UI; day theme tokens ONLY (bg-card, bg-primary, text-muted-foreground ...); grep -E 'bg-(white|blue|gray|red|green|orange|yellow)|text-(gray|blue|red|green|orange|yellow)|border-(gray|red)' must be empty on lines you touch; NO emoji; keep every existing data-testid; tap targets >= 44px; document.documentElement.scrollWidth == 390 at 390px; no direct fetch in components.

TOOLS: `pnpm --filter @blulens/web test CalibrationSets CommitteeHome` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "lists calibration sets and creates a new one": mock the hooks with 2 sets -> 2 cards with clip counts and the open link href; typing a name and submitting calls the create mutation with `{ name, period }` (period omitted when empty); empty list shows calibration-empty.
- Others: error with retry; create failure shows thaiError text; flag off -> CommitteeHome has no calibration card.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items, pushed branch + SHA.
