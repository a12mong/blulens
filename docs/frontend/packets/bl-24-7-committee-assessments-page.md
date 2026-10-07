# PACKET bl-24-7-committee-assessments-page: Committee assessments page: data hook + container + /committee/assessments (Phyllis)

GOAL: The Committee opens /committee/assessments, sees the assessments list with a status filter, loaded from the API, with loading/empty/error states.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/fe/bl-24-committee-assessments` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch to origin (git push origin HEAD:fe/fe/bl-24-committee-assessments) so the reviewer and I can fetch it.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.

SOURCES:
- `AssessmentTable` + `AssessmentStatusBadge` in `apps/web/features/assessments/` (merged). Hook pattern: `apps/web/features/review/api.ts` and `apps/web/features/entries/api.ts` (`useQuery` + `apiFetch` from `@/lib/api/client`). Endpoint `GET /assessments?status=&limit=` returns `AssessmentPage {items, nextCursor}` (see docs/api/openapi.yaml `/assessments` get; Committee sees all).
- Page guard: `apps/web/app/(app)/committee/layout.tsx` (RoleGuard committee) already wraps `app/(app)/committee/*`. Look at `apps/web/app/(app)/committee/page.tsx` for the existing placeholder style.

SPEC:
- Files (ONLY these): `apps/web/features/assessments/api.ts` (hook `useAssessments(status?: AssessmentStatus)`, queryKey ['assessments', status ?? 'all'], query param status only when set), `apps/web/features/assessments/CommitteeAssessments.tsx`, `apps/web/features/assessments/CommitteeAssessments.test.tsx`, `apps/web/app/(app)/committee/assessments/page.tsx` (server component: `<h1>ผลประเมิน</h1><CommitteeAssessments/>`).
- CommitteeAssessments keeps `status` in useState, passes it to useAssessments and to AssessmentTable (`onStatusChange={setStatus}`), `items = data?.items ?? []`. States: pending `role="status"` `data-testid="assessments-loading"` 'กำลังโหลด…'; error `role="alert"` `data-testid="assessments-error"` via `thaiError` plus a 'ลองใหม่' button (refetch); empty -> the table's empty text 'ยังไม่มีผลประเมิน'. Request one page with `limit=50`; paging is out of scope for this packet.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens ONLY (grep -E 'bg-(white|blue|gray|red|green|orange)|text-(gray|blue|red|green|orange)|border-(gray|red)' must be empty on your files: use bg-card, border-border, bg-primary text-primary-foreground, text-muted-foreground, text-destructive, bg-secondary...); no direct fetch in components.

TOOLS: `pnpm --filter @blulens/web test CommitteeAssessments` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "loads assessments for the chosen status": mock useAssessments; first render called with undefined and the table shows 2 rows; choose 'ต้องหากรรมการเพิ่ม' in assessment-filter -> useAssessments last called with 'needs_reviewers'.
- Others: loading, error with retry calling refetch, empty text.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items, pushed branch + SHA.
