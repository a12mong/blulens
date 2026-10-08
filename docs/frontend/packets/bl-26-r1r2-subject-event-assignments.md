# PACKET bl-26-r1r2-subject-event-assignments: Committee list/detail show the subject, the event and a reviewer status table (Darryl)

GOAL: The Committee sees the person's name and the event (not 'ไม่ระบุ') on the assessment list and detail, and for an in-review assessment a table of who has and has not submitted.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree OUTSIDE it (sibling folder D:/_work/SourceDev/_code/blulens-darryl-r1r2), branch `fe/bl-26-r1r2` from `origin/develop` (>= 778a865, types already regenerated); `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Backend fills these fields in packet bl-26-6 (Kevin/Creed): until then the API may return them empty. Code defensively; tests use mocks.

SOURCES:
- `apps/web/lib/api/schema.d.ts`: `Assessment.subject {userId, displayName, clubNames}` (required), `Assessment.event {id, discipline 'MS'|'WS'|'MD'|'WD'|'XD', tournamentName} | null` (null = standalone; an event has no name of its own), `AssessmentDetail.assignments?: AssignmentProgressRow[] {id, reviewerId, reviewerName, state 'open'|'submitted'|'expired'|'declined', dueAt, submittedAt|null}` (NO abstained field) (Committee/Admin only, ordered by creation). No scores in it.
- `apps/web/features/assessments/AssessmentTable.tsx`, `AssessmentDetailView.tsx` + tests. Spec: docs/design/review-slice-2.md R1, R2.

SPEC:
- Files (ONLY): `AssessmentTable.tsx`, `AssessmentDetailView.tsx`, new `ReviewerProgress.tsx` + `ReviewerProgress.test.tsx`, and the existing tests of the two components.
- List: the subject cell shows `subject.displayName` (fallback 'ไม่ระบุ' only when empty) and, muted, `clubNames.join(', ')` when non-empty; the event cell shows `{tournamentName} · {discipline in Thai}` (reuse the existing discipline label helper in features/events; grep for it, do not add a second map) or 'ประเมินทั่วไป' when event is null. Keep existing testids.
- Detail header: same name and event line.
- `ReviewerProgress` props `{ assignments: AssignmentProgressRow[] }`, `data-testid="detail-progress"`, one row `data-testid="progress-row"` each: reviewerName, state as text + icon (open 'รอส่ง', submitted 'ส่งแล้ว', expired 'หมดเวลา', declined 'ปฏิเสธ'), due date, submittedAt when present. Header 'ส่งแล้ว {n}/{total}'. Empty or undefined renders nothing. Rendered in AssessmentDetailView above the existing reviewer rows table, only when assignments has entries.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens ONLY (grep -E 'bg-(white|blue|gray|red|green|orange|yellow)|text-(gray|blue|red|green|orange|yellow)|border-(gray|red)' must be empty on every line you touch); keep EVERY existing data-testid; status never by colour alone; table scrolls inside its own container at 390px (document.documentElement.scrollWidth == 390).

TOOLS: `pnpm --filter @blulens/web test ReviewerProgress` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "lists each assigned reviewer with a text status and the submitted count": 3 assignments (submitted, open, expired) -> 3 progress-row, header 'ส่งแล้ว 1/3', each state text present.
- Others: list row with event null shows 'ประเมินทั่วไป'; subject name shown instead of 'ไม่ระบุ'; empty assignments render nothing.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items, pushed branch + SHA.
