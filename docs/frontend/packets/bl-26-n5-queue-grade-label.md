# PACKET bl-26-n5-queue-grade-label: EntryTable: show the grade label and range as text next to the ladder, and tokenise the warning chips (Darryl)

GOAL: In the Committee queue and the admin list, each player's grade cell says in words what the grade is (e.g. 'S / S+ · S- ถึง S+'), not only a 15-rung picture.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-26-queue-grade-label` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch to origin and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Source of the finding: docs/design/review-slice-2nd-pass.md item N5 (Pam, browser-verified).

SOURCES:
- `apps/web/features/entries/EntryTable.tsx` lines ~95-125: per player `GradeBand` with `player.grade` {lower, upper, score, label}; hidden grade shows 'ซ่อนอยู่'. Warning chips use `bg-yellow-100 text-yellow-900` (raw colours: replace).
- `apps/web/components/ui/GradeBand.tsx` for what it already prints (do NOT change it).

SPEC:
- Files (ONLY these): `apps/web/features/entries/EntryTable.tsx`, `apps/web/features/entries/EntryTable.test.tsx`.
- Above each player's GradeBand add the player's display name and a text line `data-testid="entry-grade-text"`: `{label}` bold, then ` · ช่วง {lower}–{upper}` (use the same labels as the band: lower and upper are grade keys or ladder indexes: check the types; print keys like 'S-' and 'S+'), so the cell reads e.g. 'สมชาย  S/S+ · ช่วง S-–S+'. If `score` is present do NOT print it as a bare number.
- Warning chip classes: replace `bg-yellow-100 text-yellow-900` with `bg-warning text-warning-foreground`.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens ONLY (grep -E 'bg-(white|blue|gray|red|green|orange|yellow)|text-(gray|blue|red|green|orange|yellow)|border-(gray|red)' must be empty on every line you touch or add); keep every existing data-testid (the Playwright gate uses them).

TOOLS: `pnpm --filter @blulens/web test EntryTable` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "shows the grade label and range as text for each player": entry with two players (one with grade label 'S', lower 'S-', upper 'S+', one hidden) -> entry-grade-text contains 'S' and 'S-' and 'S+' for the first; the second still shows 'ซ่อนอยู่'.
- Others: warning chip has no raw yellow classes; existing EntryTable tests stay green.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items, pushed branch + SHA.
