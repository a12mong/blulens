# PACKET bl-21-3a-stepper-grade-range: Stepper + GradeRangeSelect (Darryl)

GOAL: Two small reusable UI components for the create-tournament wizard: a step indicator and a grade-range picker.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-21-stepper-grade-range` from `origin/develop`, `pnpm install` there; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190 (not 3100). Never commit to main/develop.
- Review gate: after done, Andy sends your branch to Stanley; merge only on APPROVE.
- Depends on: none

SOURCES:
- docs/design/demo-slice-1.md section D2 (wizard 4 steps; GradeRangeSelect = two selects ordered by the ladder and grouped by 5 tiers, min <= max).
- `GRADE_KEYS` (15 keys RK1..P+) and tier ranges (Rookie 0-2, Beginner 3-5, Standard 6-8, Neutral 9-11, Professional 12-14) from apps/web/components/ui/GradeBand.tsx (export them there is NOT allowed to change; import GRADE_KEYS and re-derive tiers locally with the index ranges).

SPEC:
- Files (ONLY these): `apps/web/components/ui/Stepper.tsx`, `apps/web/components/ui/Stepper.test.tsx`, `apps/web/components/ui/GradeRangeSelect.tsx`, `apps/web/components/ui/GradeRangeSelect.test.tsx`.
- Stepper props: `{ steps: string[]; current: number; onStepClick?: (index: number) => void }`. Render `<ol aria-label="ขั้นตอน" data-testid="stepper">`; each `<li data-testid="stepper-step" data-state="done|current|todo">` with number + label; current has `aria-current="step"`; only steps with index < current are clickable (rendered as `<button>` calling onStepClick(i)); others plain text. State shown by text/number marker too, not only color.
- GradeRangeSelect props: `{ min: GradeKey; max: GradeKey; onChange: (v: { min: GradeKey; max: GradeKey }) => void; error?: string }`. Two `<select>` (`data-testid="grade-min"`, `grade-max"`) with `<optgroup label="Rookie">` etc. for the 5 tiers and `<option value=key>` per key. Changing min above max moves max up to equal min (and vice versa) so the pair stays valid, then calls onChange. `error` shown in `role="alert"`.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI text; tailwind classes with theme tokens only, no hex; no business logic; no direct fetch in components.

TOOLS: `pnpm --filter @blulens/web test Stepper GradeRangeSelect` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test (Stepper) "only completed steps are clickable and current has aria-current": 4 steps, current 2 -> steps 0 and 1 are buttons, click step 0 calls onStepClick(0); step 2 has aria-current='step'; steps 3 is not a button.
- Proving test (GradeRangeSelect) "raising min above max drags max up": min 'S-', max 'S' ; change min select to 'N' -> onChange called with {min:'N', max:'N'}.
- Others: five optgroups, 15 options per select; error shown.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items.
