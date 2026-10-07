# PACKET bl-24-9-review-detail-hooks: Review task hooks: load the assignment, submit the review, keep a local draft (Ryan)

GOAL: Three hooks for the scoring page: load one assignment with its clips and rubric, submit the review once, and keep the reviewer's unsent scores in the browser.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-24-review-hooks` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch to origin and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- BLIND REVIEW: never show or ask for an assessment id, the player, or whether the task is a calibration clip.

SOURCES:
- `apps/web/features/review/api.ts` (existing `useMyAssignments`; follow its pattern: `useQuery`/`useMutation` + `apiFetch` from `@/lib/api/client`).
- Types in `@/lib/api/schema`: `ReviewAssignmentDetail` (id, state, dueAt, clips[], rubric{methodVersion, criteria[{key,nameTh,weight,anchorsTh}]}, myScores[CriterionScore{criterion, gradeKey|null}]), `ReviewInput {scores: CriterionScore[] (min 1), comment?}`, `ReviewAssignment`.
- Endpoints: `GET /reviews/assignments/{id}` and `PUT /reviews/assignments/{id}` (200 -> ReviewAssignment; 409 REVIEW_ALREADY_SUBMITTED | ASSIGNMENT_EXPIRED). Error mapping: `thaiError` in `@/lib/errors` (add the two 409 codes to its MESSAGES: REVIEW_ALREADY_SUBMITTED 'ส่งผลประเมินไปแล้ว แก้ไขไม่ได้', ASSIGNMENT_EXPIRED 'งานนี้หมดเวลาแล้ว').

SPEC:
- Files (ONLY these): `apps/web/features/review/api.ts` (append), `apps/web/features/review/useReviewDraft.ts`, `apps/web/features/review/api.test.tsx`, `apps/web/features/review/useReviewDraft.test.ts`, `apps/web/lib/errors.ts` (+ its test only for the 2 new codes).
- `useAssignment(id)`: queryKey ['review','assignment',id], GET; `staleTime` 60_000 minus nothing else; on success data is the detail.
- `useSubmitReview(id)`: useMutation PUT body ReviewInput; onSuccess invalidates ['review','assignment',id] and ['review','assignments'] (the queue key prefix used by useMyAssignments).
- `useReviewDraft(id)` returns `{ draft, setScore(criterion, gradeKey|null|undefined), setComment(text), clear() }` where `draft = { scores: Record<string, GradeKey|null>, comment: string }`; persisted in `localStorage` under key `bl:review-draft:{id}` (JSON), wrapped in try/catch (private mode: works in memory only); `setScore(criterion, undefined)` removes that criterion; `clear()` removes the key.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens ONLY (grep -E 'bg-(white|blue|gray|red|green|orange|yellow)|text-(gray|blue|red|green|orange|yellow)|border-(gray|red)' must be empty); mobile-first (390px, tap targets >= 44px); no direct fetch in components.

TOOLS: `pnpm --filter @blulens/web test review-hooks` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "useReviewDraft stores, restores and clears the draft per assignment": set scores {footwork:'S', smash:null} and comment -> a fresh hook instance for the same id restores them; another id is empty; clear() empties and removes the localStorage key; localStorage throwing does not crash.
- Others: useSubmitReview calls PUT with {scores, comment} and invalidates both query keys (mock apiFetch + QueryClient spy); thaiError maps the two new codes.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items, pushed branch + SHA.
