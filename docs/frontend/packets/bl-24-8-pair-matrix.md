# PACKET bl-24-8: AgreementBadge + PairMatrix for the Committee dashboard (Phyllis)

GOAL: The Committee sees rater agreement as a small matrix of Cohen's kappa per reviewer pair, every cell readable as text, with an honest "not enough data" cell.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-24-pair-matrix` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch to origin and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Pure props components. Data hook and dashboard assembly come later.

SOURCES:
- docs/design/demo-slice-2.md section C1 (PairMatrix rules).
- Types in `@/lib/api/schema`: `AgreementValue` {kappa: number|null, n, band: poor|fair|moderate|substantial|almost_perfect|insufficient} and `RaterStats` (pairs[{a, b, cohenKappaQuadratic}]) from components['schemas'].

SPEC:
- Files (ONLY these): `apps/web/features/assessments/AgreementBadge.tsx`, `apps/web/features/assessments/PairMatrix.tsx`, `apps/web/features/assessments/PairMatrix.test.tsx`.
- AgreementBadge props `{ value: AgreementValue }` -> `<span data-testid="agreement-badge" data-band={band}>`: when `kappa === null` or band 'insufficient': text '—' with `title="ข้อมูลร่วมไม่พอ"` and visually-hidden text 'ข้อมูลร่วมไม่พอ'; otherwise `{kappa.toFixed(2)}` plus Thai band text: poor 'ต่ำมาก', fair 'พอใช้', moderate 'ปานกลาง', substantial 'ดี', almost_perfect 'ดีมาก'; poor and fair also get a warning mark '⚠' (text, not colour only).
- PairMatrix props `{ reviewerIds: string[]; pairs: RaterStats['pairs']; labelFor?: (id: string) => string; onCellClick?: (a: string, b: string) => void }`. Labels default to 'R1','R2'... by index in reviewerIds (`labelFor` overrides; never show raw uuids). Render a `<table data-testid="pair-matrix">` with a header row/column of labels; diagonal cell '–'; for i != j the cell (symmetric: find the pair with {a,b} either order) shows an AgreementBadge, or '—' with the insufficient text when no pair exists. `data-testid="pair-cell-{i}-{j}"`. When `onCellClick` is given the non-diagonal cells are buttons (min 44px) calling it with (a, b); otherwise plain text. Wrap in an overflow-x-auto container. Empty reviewerIds -> text 'ยังไม่มีข้อมูลผู้ประเมิน'.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens ONLY (grep -E 'bg-(white|blue|gray|red|green|orange)|text-(gray|blue|red|green|orange)|border-(gray|red)' must be empty on your files); no fetch.

TOOLS: `pnpm --filter @blulens/web test PairMatrix` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "shows kappa with a band text per pair, a dash for insufficient data, and is symmetric": 3 reviewers, pairs (r1,r2) kappa 0.78 substantial, (r2,r3) kappa 0.52 moderate... use fair 0.31 for (r2,r3), none for (r1,r3) -> cell 0-1 and 1-0 both contain '0.78' and 'ดี'; cell 1-2 contains '0.31', 'พอใช้' and '⚠'; cell 0-2 shows '—' with 'ข้อมูลร่วมไม่พอ'; diagonal '–'.
- Others: onCellClick called with (a,b) on a cell click; no raw uuid appears in the output; empty reviewerIds text.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items, pushed branch + SHA.
