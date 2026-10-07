# PACKET bl-22-1-grade-picker: GradePicker (tiered + ladder variants, with "cannot assess") (Ryan)

GOAL: The control a reviewer uses to give one criterion a grade: pick 1 of the 15 rungs grouped in 5 tiers, or 'cannot assess'.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-22-grade-picker` from `origin/develop`, `pnpm install` there; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Depends on: none (GRADE_KEYS and tier ranges are in apps/web/components/ui/GradeBand.tsx; Stepper/GradeRangeSelect show how tiers are grouped)

SOURCES:
- docs/design/demo-slice-2.md section R2 (behaviour table 'เลือกเกรด (GradePicker tiered)'), a11y: radio group with arrow keys, not colour alone (key text + check mark), buttons >= 44px.
- `GRADE_KEYS` (RK1 RK2 RK3 BG1 BG2 BG3 S- S S+ N- N N+ P- P P+) and `GradeKey` from `@/components/ui/GradeBand`. Tiers by index: Rookie 0-2, Beginner 3-5, Standard 6-8, Neutral 9-11, Professional 12-14. Tier names Thai UI: Rookie "มือใหม่", Beginner "เริ่มต้น", Standard "มาตรฐาน", Neutral "กลาง", Professional "มืออาชีพ".

SPEC:
- Files (ONLY these): `apps/web/components/ui/GradePicker.tsx`, `apps/web/components/ui/GradePicker.test.tsx`.
- Props: `{ value: GradeKey | null | undefined; onChange: (v: GradeKey | null | undefined) => void; allowNA?: boolean; anchorsByTier?: Partial<Record<Tier, string>>; disabled?: boolean; variant?: 'tiered' | 'ladder'; 'aria-label'?: string }`. Semantics: `undefined` = not answered, `GradeKey` = a grade, `null` = "cannot assess" (answered). Export `type Tier = 'Rookie'|'Beginner'|'Standard'|'Neutral'|'Professional'`.
- Variant `tiered` (default): `<div role="radiogroup" data-testid="grade-picker">`: 5 tier buttons `data-testid="gp-tier-{Tier}"` (role radio, aria-checked when the current value is in that tier or that tier is being browsed); tapping a tier shows its 3 sub-rung buttons `data-testid="gp-key-{key}"` (role radio, text = key, a check mark when selected, `aria-checked`). Selecting a key calls onChange(key). Tapping the selected key again keeps it (no toggle); a button `data-testid="gp-clear"` "ล้าง" calls onChange(undefined) (visible only when value !== undefined).
- Variant `ladder`: a single row of 15 `gp-key-*` buttons grouped by tier with the tier name above each group (no tier buttons).
- `allowNA`: extra button `data-testid="gp-na"` "ประเมินไม่ได้" (role radio): calls onChange(null); when value === null show it checked plus a visible text "ประเมินไม่ได้" and `gp-na` becomes a toggle off (calls onChange(undefined)).
- anchor text: below the keys render `<p data-testid="gp-anchor">` with `anchorsByTier[tier]` of the selected/browsed tier when provided.
- Keyboard: arrow Left/Right moves focus among the visible radios (roving tabindex), Space/Enter selects. `disabled` disables everything.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI text; tailwind classes with theme tokens only, no hex; no business logic; no direct fetch in components.

TOOLS: `pnpm --filter @blulens/web test GradePicker` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "tier tap then key tap emits the GradeKey; N/A emits null; clear emits undefined": render tiered with allowNA, onChange spy: click gp-tier-Standard -> click gp-key-S+ -> onChange('S+'); click gp-na -> onChange(null); with value 'S' click gp-clear -> onChange(undefined).
- Others: ladder variant renders exactly 15 gp-key buttons; anchor text shown for the selected tier; selected key has aria-checked=true; disabled blocks clicks; ArrowRight moves focus.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items.
