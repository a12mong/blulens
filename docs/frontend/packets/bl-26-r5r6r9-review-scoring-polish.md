# PACKET bl-26-r5r6r9-review-scoring-polish: R5 + R6 + R9: reviewer scoring page submit summary, submitted view, rubric numbering (Phyllis)

GOAL: The submit dialog says what is being sent and warns when more than half of the criteria are 'cannot assess'; a submitted task keeps the back link and shows the comment; rubric items count from 1 and show the grade meaning.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree OUTSIDE it (sibling folder D:/_work/SourceDev/_code/blulens-<you>-<packet>), branch `fe/bl-26-r5r6r9-review-scoring-polish` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Source: Pam's findings in docs/design/fe-polish-packets.md and docs/design/review-slice-2.md (read the item named in the title; both are in Thai).

SOURCES:
- `apps/web/features/review/ReviewScoring.tsx`, `RubricItemCard.tsx`, their tests. Spec: docs/design/review-slice-2.md R5, R6, R9.

SPEC:
- Files (ONLY): those two components + tests.
- R5: confirm dialog adds `data-testid="scoring-summary"` 'ให้ระดับ {n} · ประเมินไม่ได้ {m} · ความเห็น มี/ไม่มี'; when m*2 > total add `data-testid="scoring-warning"` with an icon and text 'ประเมินไม่ได้เกินครึ่ง'; it does NOT block submit.
- R6: the read-only (submitted) view keeps the '← คิว' link and shows the submitted comment read-only (`data-testid="scoring-comment-readonly"`) when present.
- R9: criteria numbered from 1; the selected grade shows its meaning, e.g. 'มาตรฐาน (S)' (if no mapping exists in the code, use a small local map in RubricItemCard for the ladder keys already used in GradePicker labels; do not invent grades).

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens ONLY (grep -E 'bg-(white|blue|gray|red|green|orange|yellow)|text-(gray|blue|red|green|orange|yellow)|border-(gray|red)' must be empty on every line you touch); keep EVERY existing data-testid (Playwright gates use them); tap targets >= 44px; status never by colour alone; check document.documentElement.scrollWidth == 390 at 390px if layout changes.

TOOLS: `pnpm --filter @blulens/web test ReviewScoring` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "warns without blocking when more than half are cannot-assess": 4 criteria, 3 null -> dialog shows scoring-summary and scoring-warning, scoring-confirm still enabled.
- Others: submitted view has the back link and shows the comment; first rubric card is numbered 1.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items, pushed branch + SHA.
