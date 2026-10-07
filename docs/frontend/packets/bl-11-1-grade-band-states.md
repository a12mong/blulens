# PACKET bl-11-1.11: GradeBand provisional + disputed states (Darryl)

GOAL: GradeBand can show that a result is provisional (single reviewer, wide band) or disputed (reviewers disagree), using flags the caller passes in. Web never decides these; the caller maps API status/flags to props.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Use your own worktree; base `fe/bl-11-grade-band-states` on `origin/develop` (GradeBand from bl-08-1 is already there). Run `pnpm install` there; for typecheck run `pnpm --filter @blulens/shared build` first. Dev servers: use port 3190, not 3100.
- Never commit to main/develop. After done, Andy sends your branch to Stanley (review gate); merge only on APPROVE.
- Depends on: bl-08-1 (merged).

SOURCES:
- docs/specs/grading.md section 12.2: provisional result shows wide lower/upper and label "ชั่วคราว · กรรมการ 1 คน" plus flag SINGLE_REVIEWER.
- docs/api/openapi.yaml: AssessmentStatus includes `provisional` and `disputed`; AssessmentResult.flags may contain SINGLE_REVIEWER, PAIR_DISAGREEMENT.
- Existing component: apps/web/components/ui/GradeBand.tsx (+ test).

SPEC:
- Files (ONLY these): `apps/web/components/ui/GradeBand.tsx`, `apps/web/components/ui/GradeBand.test.tsx`.
- Extend props (all optional, existing callers unchanged): `provisional?: boolean; disputed?: boolean; reviewerCount?: number`.
- When `provisional` is true: render a badge `<span data-testid="grade-badge-provisional">` with text `ชั่วคราว · กรรมการ {reviewerCount ?? 1} คน` under the label; add `data-provisional="true"` on the root element; append to aria-label: ` (ผลชั่วคราว)`.
- When `disputed` is true: render `<span data-testid="grade-badge-disputed">ผลไม่ตรงกัน รอคณะกรรมการ</span>`; add `data-disputed="true"` on root; append ` (ผลไม่ตรงกัน)` to aria-label.
- Both can be true at once (two badges). Neither true: output identical to today (existing 4 tests must still pass unchanged).
- Invalid-props behaviour unchanged.
- Styling: tokens only (bg-muted, border), badge `text-xs border px-1`. No hex.

CONSTRAINTS: only these 2 files; no new dependencies; no `any`; no logic that derives provisional/disputed from grades.

TOOLS: `pnpm --filter @blulens/web test GradeBand` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "shows the provisional badge with reviewer count and marks the root": render lower='S-', upper='S+', score=7.8, provisional, reviewerCount=1 -> text "ชั่วคราว · กรรมการ 1 คน" present, root has data-provisional="true", aria-label ends with " (ผลชั่วคราว)".
- Others: disputed badge + data-disputed; both badges together; neither -> no badge testids (and old 4 tests unchanged).
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items.
