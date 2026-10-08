# PACKET bl-24-14: Committee "assign reviewers" action on /committee/assessments/[id] (Darryl)

GOAL: When an assessment is submitted, in_review (e.g. after "ส่งกลับ") or needs_reviewers, the Committee can pick one or more Reviewers and assign them, with the server's conflict-of-interest answer shown per reviewer. Without it a returned task is a dead end.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree OUTSIDE the checkout (sibling folder D:/_work/SourceDev/_code/blulens-<you>-<packet>), branch `fe/bl-24-assign-reviewers` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch to origin and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Depends on merged: AssessmentDecisions, AssessmentDetailView, `useAssessmentAction` in `apps/web/features/assessments/api.ts`, PlayerPicker patterns in `apps/web/features/users/`.

SOURCES:
- openapi (API is on develop): `POST /assessments/{assessmentId}/assign` body `{ reviewerIds: uuid[] (min 1), dueAt?: date-time (default now+72h) }` -> 200 AssessmentDetail; 409 `REVIEWER_CONFLICT_OF_INTEREST` (details `{ reviewerId, teamIds }`) | `REVIEWER_NOT_ELIGIBLE` | `ASSESSMENT_NOT_ASSIGNABLE`.
- Picker data: `GET /users?role=Reviewer&q=<text>&limit=8` -> items `UserPickerItem` {id, displayName, teamNames?, gradeLabel?}. Look at `usePlayerSearch` in `apps/web/features/users/api.ts` (it uses role Member) to build a `useReviewerSearch(q)` the same way.
- `AssessmentDetail.reviewerRows[].reviewerId` = reviewers already on this assessment (exclude them from the picker). `thaiError` in `@/lib/errors`.

SPEC:
- Files (ONLY these): `apps/web/features/users/api.ts` (append `useReviewerSearch(q, options)`, queryKey ['users','reviewers',q]), `apps/web/features/assessments/api.ts` (append `useAssignReviewers(id)`: POST body as above, onSuccess sets ['assessments','detail',id] to the returned detail and invalidates ['assessments']), `apps/web/features/assessments/AssignReviewers.tsx`, `apps/web/features/assessments/AssignReviewers.test.tsx`, `apps/web/lib/errors.ts` + `errors.test.ts` (add REVIEWER_CONFLICT_OF_INTEREST 'ผู้ประเมินสังกัดทีมเดียวกับผู้ถูกประเมิน', REVIEWER_NOT_ELIGIBLE 'ผู้ใช้นี้ไม่มีสิทธิ์เป็นผู้ประเมิน', ASSESSMENT_NOT_ASSIGNABLE 'สถานะนี้มอบหมายผู้ประเมินเพิ่มไม่ได้'), and in `AssessmentDetailView.tsx` only the line rendering `<AssignReviewers detail={data} />` below the decisions.
- AssignReviewers props `{ detail: AssessmentDetail }`. Renders nothing unless `status` is submitted | in_review | needs_reviewers. A button `data-testid="assign-open"` 'มอบหมายผู้ประเมิน' (min-h 44px) opens a dialog (role=dialog, aria-modal) containing: a search input `data-testid="assign-search"` (debounce 250 ms, needs >= 1 char) with results list (`data-testid="assign-option"`: name + clubs + grade label when present; reviewers already in `reviewerRows` are filtered out; already-picked ones are hidden); the picked reviewers as chips `data-testid="assign-picked"` with a remove button; an optional due date `<input type="datetime-local" data-testid="assign-due">`; submit `data-testid="assign-submit"` 'มอบหมาย' disabled until >= 1 picked or while pending. Submit sends `{ reviewerIds, dueAt: due ? new Date(due).toISOString() : undefined }`.
- Errors: a 409 REVIEWER_CONFLICT_OF_INTEREST with `details.reviewerId` shows the Thai text inline on that picked chip (`data-testid="assign-conflict"`), keeps the dialog open so the user removes that reviewer; other errors in `role="alert"` `data-testid="assign-error"` via thaiError. On success close the dialog and clear picks.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens ONLY (raw-palette grep empty); mobile-first (scrollWidth 390 at 390px; tap targets >= 44px); BLIND rule does not apply here (Committee page); ROUTE RULE: no new links.

TOOLS: `pnpm --filter @blulens/web test AssignReviewers errors` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "searches reviewers, excludes those already assigned, assigns the picked ones and shows a conflict per reviewer": detail status 'in_review' with reviewerRows [r1]; search returns [r1, r2, r3] -> options show r2 and r3 only; pick r2 and r3, submit -> mutate called with {reviewerIds:[r2,r3]}; mutation error REVIEWER_CONFLICT_OF_INTEREST with details.reviewerId r3 -> assign-conflict on the r3 chip with the Thai text and the dialog stays open.
- Others: renders nothing for status approved/provisional/disputed/pending_approval; submit disabled with no picks; the due date is sent as ISO; errors.ts maps the 3 new codes.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, scrollWidth at 390, unverified, open items, pushed branch + SHA.
