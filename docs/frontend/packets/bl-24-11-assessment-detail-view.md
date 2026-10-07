# PACKET bl-24-11-assessment-detail-view: Committee assessment detail page (read-only): result, flags, clips, reviewer rows, version info (Darryl)

GOAL: The Committee opens /committee/assessments/[id] from the list and sees the assessment's latest result, flags, clips and each reviewer's contribution. Decision buttons come in the next packet (bl-24-12).

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree OUTSIDE the checkout (sibling folder D:/_work/SourceDev/_code/blulens-<you>-<packet>), branch `fe/bl-24-assessment-detail` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch to origin and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- ROUTE RULE: every link/route you add must point to a page that exists on develop (the list page links to /committee/assessments/{id}, this packet creates that page).

SOURCES:
- docs/design/demo-slice-2.md section C2 (layout, status table). Merged parts: `AssessmentStatusBadge` (`@/features/assessments/AssessmentStatusBadge`), `GradeBand` (`@/components/ui/GradeBand`: props lower, upper, score, label, provisional, disputed), `ClipPlayer` (`@/components/ui/ClipPlayer`: clips with status 'uploaded'), `AgreementBadge` is NOT available yet (print pairKappa as a number only), hook pattern `apps/web/features/assessments/api.ts` (`useAssessments`), `thaiError`.
- Types from `@/lib/api/schema`: `AssessmentDetail` = Assessment + clips[Clip] + latestResult (AssessmentResult|null: version, source computed|override, status, grade GradeView{score, margin, lower, upper, kind, label}, nRaters, nExcluded, spread, flags[], reason, computedAt) + reviewerRows[ReviewerScoreRow {reviewerId, reviewerName, overall, excluded, robustZ|null, reviewerBias|null, pairKappa|null, criteria[{criterion, gradeKey|null}]}]. Endpoint `GET /assessments/{assessmentId}` (Committee).
- Page guard: `apps/web/app/(app)/committee/layout.tsx` already wraps the area.

SPEC:
- Files (ONLY these): `apps/web/features/assessments/api.ts` (append hook `useAssessmentDetail(id)`, queryKey ['assessments','detail',id]), `apps/web/features/assessments/AssessmentDetailView.tsx`, `apps/web/features/assessments/AssessmentDetailView.test.tsx`, `apps/web/app/(app)/committee/assessments/[id]/page.tsx` (server component: `const { id } = await params;` renders `<AssessmentDetailView id={id} />`).
- AssessmentDetailView props `{ id: string }`. Layout top to bottom: back link '← รายการผลประเมิน' to /committee/assessments; header: subject name (`subject?.displayName ?? 'ไม่ระบุ'`) + AssessmentStatusBadge; result block `data-testid="detail-result"`: when `latestResult` exists show GradeBand (lower, upper, score, label, `provisional={status==='provisional'}`, `disputed={status==='disputed'}`) and text 'คะแนน {score.toFixed(2)} ± {margin.toFixed(2)}' + 'ผู้ประเมินที่ใช้ {nRaters} · ตัดออก {nExcluded}' + `spread`; when null: 'ยังสรุปไม่ได้' (no numbers). Flags `data-testid="detail-flags"`: each flag a chip with Thai text: OUTLIER_EXCLUDED 'ค่าผิดปกติถูกตัดออก', HIGH_DISAGREEMENT 'กรรมการเห็นต่างกันมาก', LOW_RATER_COUNT 'จำนวนกรรมการน้อย', OVERRIDE 'แก้ไขโดยคณะกรรมการ', SINGLE_REVIEWER 'ประเมินโดยกรรมการ 1 คน', PAIR_DISAGREEMENT 'คู่กรรมการเห็นต่างกัน'. If `latestResult.source === 'override'` show 'เหตุผล: {reason}'. Clips: `<ClipPlayer clips={clips} onRefreshNeeded={refetch}/>` when clips.length > 0 else 'ยังไม่มีคลิป'.
- Reviewer rows table `data-testid="detail-reviewers"` (scrolls inside its own container at 390): per row `data-testid="detail-reviewer-row"` with name, overall (2 decimals), 'ใช้' or 'ตัดออก' (text, plus 'z={robustZ.toFixed(1)}' when not null), bias text when `reviewerBias` not null: '{+0.4|-0.2} ขั้น', pairKappa as 'κ {value.toFixed(2)}' when not null; an expandable `<details>` 'ต่อหัวข้อ' listing `{criterion}: {gradeKey ?? 'ประเมินไม่ได้'}`.
- States: pending skeleton `role="status"` `data-testid="detail-loading"`; error `role="alert"` `data-testid="detail-error"` via thaiError + 'ลองใหม่'.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens ONLY (grep -E 'bg-(white|blue|gray|red|green|orange|yellow)|text-(gray|blue|red|green|orange|yellow)|border-(gray|red)' must be empty); mobile-first: check document.documentElement.scrollWidth == 390 at 390px; tap targets >= 44px; no direct fetch in components; status and flags never by colour only.

TOOLS: `pnpm --filter @blulens/web test AssessmentDetail` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "shows the result, flags and one row per reviewer with the excluded one marked": mock useAssessmentDetail with latestResult label 'S/S+', flags ['OUTLIER_EXCLUDED'], 2 reviewerRows (second excluded, robustZ 3.9) -> detail-result shows 'S/S+', detail-flags contains 'ค่าผิดปกติถูกตัดออก', 2 detail-reviewer-row, the second contains 'ตัดออก' and 'z=3.9'.
- Others: latestResult null shows 'ยังสรุปไม่ได้' and no score numbers; override result shows the reason; loading and error-with-retry states; no clips text.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, what you saw at 1440 and 390 incl. scrollWidth, unverified, open items, pushed branch + SHA.
