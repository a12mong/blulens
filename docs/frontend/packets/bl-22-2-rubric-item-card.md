# PACKET bl-22-2-rubric-item-card: RubricItemCard (Phyllis)

GOAL: One scoring card per rubric criterion: title, weight note, the GradePicker, and the state text 'not chosen / graded / cannot assess'.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-22-rubric-item-card` from `origin/develop`, `pnpm install` there; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Depends on: bl-22-1 GradePicker (mock it with vi.mock until merged)

SOURCES:
- docs/design/demo-slice-2.md section R2 (RubricItemCard (`criterion`, `value`, `onChange`, `readOnly`); weight shown as small text 'น้ำหนัก ×w').
- docs/api/openapi.yaml: rubric criteria item {key, nameTh, weight, anchorsTh: {Tier -> text}} (see ReviewAssignmentDetail.rubric); `GradePicker` from `@/components/ui/GradePicker` (props above in packet bl-22-1).

SPEC:
- Files (ONLY these): `apps/web/features/review/RubricItemCard.tsx`, `apps/web/features/review/RubricItemCard.test.tsx`.
- Export `type Criterion = { key: string; nameTh: string; weight: number; anchorsTh?: Partial<Record<Tier, string>> }` (Tier type from GradePicker).
- Props: `{ index: number; criterion: Criterion; value: GradeKey | null | undefined; onChange: (v: GradeKey | null | undefined) => void; readOnly?: boolean }`.
- Markup: `<section data-testid="rubric-item" data-criterion={criterion.key} data-answered={value !== undefined}>` with `<h3>` `{index}. {nameTh}`, small text `น้ำหนัก ×{weight}`, status text `data-testid="rubric-item-status"`: undefined "ยังไม่เลือก", GradeKey -> `ให้ {key}`, null "ประเมินไม่ได้". GradePicker with `allowNA`, `anchorsByTier={criterion.anchorsTh}`, `disabled={readOnly}`, aria-label = nameTh. In readOnly mode render only the status text (no picker).

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI text; tailwind classes with theme tokens only, no hex; no business logic; no direct fetch in components.

TOOLS: `pnpm --filter @blulens/web test RubricItemCard` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "shows the unanswered status, then reports the picked grade through onChange": render with value undefined -> status 'ยังไม่เลือก', data-answered='false'; mock GradePicker stub that calls onChange('S') -> parent onChange called with 'S'; with value 'S' status 'ให้ S'; with null 'ประเมินไม่ได้'.
- Others: readOnly renders no picker; weight text rendered.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items.
