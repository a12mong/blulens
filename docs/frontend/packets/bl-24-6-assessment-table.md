# PACKET bl-24-6: AssessmentStatusBadge + AssessmentTable for the Committee dashboard (Phyllis)

GOAL: The Committee sees a list of assessments with a status badge, review progress, the latest grade label and a link to the detail page, filterable by status.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-24-assessment-table` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Pure props component; the page and data hook come in a later packet.

SOURCES:
- docs/design/demo-slice-2.md section C1 (status badges and table rules).
- Types: `components['schemas']['Assessment']` ({id, subjectUserId, subject?{displayName}, status, latestGrade (GradeView|null: label, lower, upper, kind), reviewsSubmitted, reviewsRequired, createdAt}) and `AssessmentStatus` from `@/lib/api/schema`. `GradeBand` in `@/components/ui/GradeBand` (props lower, upper, score, label, provisional, disputed) may be used for the grade cell or just print `latestGrade.label`.

SPEC:
- Files (ONLY these): `apps/web/features/assessments/AssessmentStatusBadge.tsx`, `apps/web/features/assessments/AssessmentTable.tsx`, `apps/web/features/assessments/AssessmentTable.test.tsx`.
- AssessmentStatusBadge props `{ status: AssessmentStatus }` -> `<span data-testid="assessment-status" data-status={status}>` mark + Thai text: draft 'ร่าง', submitted 'ส่งแล้ว', in_review 'กำลังรีวิว', needs_reviewers 'ต้องหากรรมการเพิ่ม', provisional 'ชั่วคราว (กรรมการ 1 คน)', disputed 'เห็นต่างกันมาก', pending_approval 'รออนุมัติ', approved 'อนุมัติแล้ว', overridden 'แก้ไขโดยคณะกรรมการ', rejected 'ไม่ผ่าน', withdrawn 'ถอนคำขอ'. Never colour only.
- AssessmentTable props `{ items: Assessment[]; status?: AssessmentStatus; onStatusChange?: (s: AssessmentStatus | undefined) => void; emptyText?: string }`. Filter `<select data-testid="assessment-filter">` ('ทั้งหมด' + each status text) calling onStatusChange (undefined for all); the table shows `items` as given (the parent filters via the API). Columns: ผู้ถูกประเมิน (`subject?.displayName ?? 'ไม่ระบุ'`), สถานะ (badge), รีวิว (`{submitted}/{required}`), ผล (`latestGrade?.label` else 'ยังสรุปไม่ได้', never invent numbers), and a link `data-testid="assessment-open"` 'ดูรายละเอียด' to `/committee/assessments/{id}`. Rows `data-testid="assessment-row"`. Empty: `emptyText ?? 'ไม่มีรายการ'`. Table scrolls inside its own container at 390px.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens only; no fetch.

TOOLS: `pnpm --filter @blulens/web test AssessmentTable` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "renders status badge, progress and grade label per row and reports the filter change": 2 items (provisional 1/1 label 'S-–S+', disputed 3/3 label null) -> badge texts 'ชั่วคราว (กรรมการ 1 คน)' and 'เห็นต่างกันมาก', progress '1/1' and '3/3', 'ยังสรุปไม่ได้' for the null grade, link href '/committee/assessments/<id>'; selecting 'ต้องหากรรมการเพิ่ม' in the filter calls onStatusChange('needs_reviewers').
- Others: empty items shows the empty text; all 11 statuses render non-empty Thai text.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items.
