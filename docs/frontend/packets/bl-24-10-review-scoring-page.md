# PACKET bl-24-10-review-scoring-page: ReviewScoring: the reviewer scoring page (clip player + rubric cards + submit) at /review/tasks/[id] (Ryan)

GOAL: The reviewer opens a task from the queue, watches the clip(s), grades each rubric criterion (or 'cannot assess'), writes an optional comment and submits once.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-24-review-scoring` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch to origin and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- BLIND REVIEW: never show or ask for an assessment id, the player, or whether the task is a calibration clip.

SOURCES:
- docs/design/demo-slice-2.md section R2 (layout, behaviour, states). Merged parts: `ClipPlayer` (`@/components/ui/ClipPlayer`: props clips, onRefreshNeeded, onTimeUpdate), `RubricItemCard` (`@/features/review/RubricItemCard`: props index, criterion, value, onChange, readOnly), `GradePicker`, `ReasonDialog`/dialog patterns, hooks from packet bl-24-9 (`useAssignment`, `useSubmitReview`, `useReviewDraft`: MUST be merged first), `thaiError`.
- Routes: the queue links to `/review/tasks/{id}` (ReviewCard). `apps/web/app/(app)/review/layout.tsx` already guards the area. Next 15: `params` is a Promise.

SPEC:
- Files (ONLY these): `apps/web/features/review/ReviewScoring.tsx`, `apps/web/features/review/ReviewScoring.test.tsx`, `apps/web/app/(app)/review/tasks/[id]/page.tsx` (server component: `const { id } = await params;` renders `<ReviewScoring id={id} />`).
- ReviewScoring props `{ id: string }`. `data = useAssignment(id)`, `draft = useReviewDraft(id)`, `submit = useSubmitReview(id)`.
- States: pending skeleton `role="status"` `data-testid="scoring-loading"`; error `role="alert"` `data-testid="scoring-error"` via thaiError + 'ลองใหม่' (refetch) and a link back to /review; state `submitted` (or expired/declined): read-only view: heading 'ส่งผลประเมินแล้ว' (or 'งานนี้หมดเวลาแล้ว'), RubricItemCard with `readOnly` and the values from `data.myScores`, no submit button.
- Open state: header 'งาน #{last 4 of id uppercased}' with link '← คิว' to /review; `<ClipPlayer clips={data.clips} onRefreshNeeded={() => refetch()} />`; progress `data-testid="scoring-progress"` 'ให้คะแนนแล้ว {n}/{total}' (answered = a key present in draft.scores incl. null); one RubricItemCard per `rubric.criteria` (value = draft.scores[key], onChange -> draft.setScore); a textarea `data-testid="scoring-comment"` (max 2000, label 'ความเห็นรวม'); note `data-testid="scoring-draft-note"` 'ร่างอยู่ในเครื่องนี้เท่านั้น'; sticky bottom bar with the submit button `data-testid="scoring-submit"` 'ส่งและล็อก', disabled until every criterion is answered (a null counts).
- Submit: click opens a confirm dialog (role=dialog, aria-modal) text 'ส่งแล้วแก้ไขไม่ได้ ยืนยันหรือไม่' with `scoring-confirm` 'ส่งและล็อก' / `scoring-cancel` 'ยกเลิก'; confirm calls `submit.mutate({ scores: criteria.map(c => ({ criterion: c.key, gradeKey: draft.scores[c.key] })), comment: draft.comment || undefined }, { onSuccess: () => { draft.clear(); router.push('/review'); }, onError: show thaiError in `role="alert"` `data-testid="scoring-submit-error"` })`. Use `useRouter` from next/navigation.
- Prefill: when `data.myScores` is non-empty and the local draft is empty, seed the draft from it once.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens ONLY (grep -E 'bg-(white|blue|gray|red|green|orange|yellow)|text-(gray|blue|red|green|orange|yellow)|border-(gray|red)' must be empty); mobile-first (390px, tap targets >= 44px); no direct fetch in components.

TOOLS: `pnpm --filter @blulens/web test ReviewScoring` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "submit stays disabled until every criterion is answered, then confirms and sends all scores": mock the three hooks; 2 criteria; initially scoring-submit disabled and progress '0/2'; set both (one grade 'S', one null) -> enabled and '2/2'; click -> dialog; scoring-confirm -> submit.mutate called with scores [{criterion:'a',gradeKey:'S'},{criterion:'b',gradeKey:null}].
- Others: submitted state is read-only with no submit; loading and error (retry) states; the output never contains the words 'calibration' or 'ชุดมาตรฐาน' nor any assessment id.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items, pushed branch + SHA.
