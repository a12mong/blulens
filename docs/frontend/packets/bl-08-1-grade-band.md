# PACKET bl-08-1: GradeBand (Darryl)

GOAL: A component that shows the 15-step grade ladder with the lower..upper range highlighted and a score marker. Web never computes grades; it only renders what the API sends.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout D:/_work/SourceDev/_code/blulens. Create your own worktree: `git worktree add D:/_work/SourceDev/_code/blulens-<yourname> -b <branch> origin/andy/bl-08-tooling`, run `pnpm install` there, and work only there.
- BASE: create your branch `dev/bl-08-grade-band` from `origin/andy/bl-08-tooling` (has vitest, testing-library, @tanstack/react-query, lib/roles.ts, lib/api/schema.d.ts). Work in your own worktree. Never commit to main/develop.
- Run commands via `pnpm --filter @blulens/web <script>`.
- Depends on: none.

SOURCES:
- GradeView in docs/api/openapi.yaml (components.schemas.GradeView) = { score: number 0..15, margin?, lower, upper, center: GradeKey, tier?, kind: exact|straddle|wide, label: string }.
- GradeKey order (index 0..14): RK1 RK2 RK3 BG1 BG2 BG3 S- S S+ N- N N+ P- P P+.
- Tiers by index: Rookie 0-2, Beginner 3-5, Standard 6-8, Neutral 9-11, Professional 12-14.

SPEC:
- Files (ONLY these): `apps/web/components/ui/GradeBand.tsx`, `apps/web/components/ui/GradeBand.test.tsx`. Export `GRADE_KEYS` (readonly tuple in the order above) and `type GradeKey` from GradeBand.tsx.
- Props: `type GradeBandProps = { lower: GradeKey; upper: GradeKey; score: number; label?: string }`
- Render: root `<div role="img" aria-label="เกรด {lower} ถึง {upper} คะแนน {score}">` (if lower === upper: "เกรด {lower} คะแนน {score}"). Inside, 15 cells `<span data-testid="grade-cell" data-key={key} data-tier={tier} data-active="true|false">` each showing its key text. Active = index between indexOf(lower) and indexOf(upper) inclusive. The cell at index floor(score) also has `data-marker="true"`. Below the cells show `label` if given, else `{lower}` when equal, else `{lower}–{upper}` (en dash).
- States: exact (lower === upper: 1 active); range (lower < upper); invalid (lower index > upper index, or score outside [0,15)): render null and call console.error once.
- Styling: tailwind classes with theme tokens only (bg-muted, bg-primary, text-primary-foreground, border). No hex. Active cell = bg-primary text-primary-foreground; marker cell gets ring-2. No visual polish; design comes later.

CONSTRAINTS: only the 2 files; no new dependencies; no `any`; no fetch.

TOOLS: `pnpm --filter @blulens/web test GradeBand` · `pnpm --filter @blulens/web typecheck`

DONE:
- Test file has 4 tests. The proving one is "highlights exactly the cells between lower and upper inclusive": render lower='S-', upper='S+', score=7.4 -> exactly 3 cells have data-active="true" (S-, S, S+), cell S has data-marker="true", aria-label is "เกรด S- ถึง S+ คะแนน 7.4".
- Others: exact case (1 active), invalid case (lower='P', upper='S' -> container empty, console.error called once), label fallback.
- Report to andy-muxsqkra (act=done): paths changed, exact commands run with real pass counts, unverified, open items.
