# PACKET bl-21-3-create-event-form: CreateEventForm component (Phyllis)

GOAL: A form where a Committee user adds an event (discipline, grade band, max entries, min reviewers) to a tournament.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-21-create-event-form` from `origin/develop`, `pnpm install` there; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190 (not 3100). Never commit to main/develop.
- Review gate: after done, Andy sends your branch to Stanley; merge only on APPROVE.
- Depends on: bl-21-1 merged (mock the hook until then)

SOURCES:
- docs/api/openapi.yaml schema EventInput: discipline* enum MS WS MD WD XD; gradeMin*, gradeMax* (GradeKey); maxEntries (int <= 256); requiresFreshAssessment (bool); minReviewers (1-5, default 2). GradeKey order: RK1 RK2 RK3 BG1 BG2 BG3 S- S S+ N- N N+ P- P P+ (import `GRADE_KEYS` from `@/components/ui/GradeBand`).
- Hook: `useCreateEvent(tournamentId)` from `@/features/events/api`.

SPEC:
- Files (ONLY these): `apps/web/features/events/CreateEventForm.tsx`, `apps/web/features/events/CreateEventForm.test.tsx`.
- Props: `{ tournamentId: string; onCreated?: (e: Event) => void }`.
- Fields (data-testid): discipline select `event-discipline` with Thai labels ชายเดี่ยว(MS) หญิงเดี่ยว(WS) ชายคู่(MD) หญิงคู่(WD) คู่ผสม(XD); `event-grade-min` and `event-grade-max` selects over GRADE_KEYS; `event-max-entries` number; `event-min-reviewers` number 1-5 default 2; checkbox `event-fresh-assessment` label "ต้องประเมินใหม่สำหรับรายการนี้"; submit `event-submit` text "เพิ่มรายการแข่ง".
- Client check: gradeMin index must be <= gradeMax index, else `role="alert"` `event-error` "เกรดต่ำสุดต้องไม่สูงกว่าเกรดสูงสุด", no mutate. Empty max entries -> omit.
- States: pending disabled; API error shown in `event-error`; success resets and calls onCreated.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI text; tokens/tailwind classes only, no hex; no business logic (API decides, web only renders); no direct fetch in components (use hooks / apiFetch from apps/web/lib/api/client.ts).

TOOLS: `pnpm --filter @blulens/web test CreateEventForm` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "submits EventInput with numbers converted": choose MS, S-, S+, max 16, min reviewers 3 -> mutate called with {discipline:'MS', gradeMin:'S-', gradeMax:'S+', maxEntries:16, minReviewers:3, requiresFreshAssessment:false}.
- Others: min > max grade blocks submit with error; empty max entries omitted.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items.
