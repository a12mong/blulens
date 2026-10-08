# PACKET bl-26-r3r4-committee-polish: R3 + R4: Committee list result column and approve dialog summary (Darryl)

GOAL: Overridden/approved rows show the grade (GradeBand compact + label + range) instead of 'ยังสรุปไม่ได้'; unfinished ones show 'รอผู้ตรวจ n/m'; the approve dialog opens with a one-line summary of the result being approved.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree OUTSIDE it (sibling folder D:/_work/SourceDev/_code/blulens-<you>-<packet>), branch `fe/bl-26-r3r4-committee-polish` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Source: Pam's findings in docs/design/fe-polish-packets.md and docs/design/review-slice-2.md (read the item named in the title; both are in Thai).

SOURCES:
- `apps/web/features/assessments/AssessmentTable.tsx`, `AssessmentDecisions.tsx` + tests; `ApproveConfirmDialog` in features/entries as the summary pattern. Spec: docs/design/review-slice-2.md R3, R4.

SPEC:
- Files (ONLY): those + tests. Start AFTER packet bl-24-14 is merged.
- R3: result column uses the `latestResult` grade when present; else 'รอผู้ตรวจ {done}/{total}' only if the list item has those counts, otherwise 'รอผล'.
- R4: approve dialog top line `data-testid="approve-summary"`: '{label} · {score} ± {margin} · {flag text}'.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens ONLY (grep -E 'bg-(white|blue|gray|red|green|orange|yellow)|text-(gray|blue|red|green|orange|yellow)|border-(gray|red)' must be empty on every line you touch); keep EVERY existing data-testid (Playwright gates use them); tap targets >= 44px; status never by colour alone; check document.documentElement.scrollWidth == 390 at 390px if layout changes.

TOOLS: `pnpm --filter @blulens/web test AssessmentTable` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "shows the grade for an overridden row and the result summary in the approve dialog".
- Others: an unfinished row has no grade numbers.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items, pushed branch + SHA.
