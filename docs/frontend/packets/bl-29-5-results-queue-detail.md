# PACKET bl-29-5-results-queue-detail: Results queue rows show when it was reported and the outcome; dialogs restate the match (Darryl)

GOAL: The Committee can see which result is being decided: reported time, who won, any flag, and both dialogs repeat the pairs and every game score.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree OUTSIDE it (sibling folder D:/_work/SourceDev/_code/blulens-<you>-5-results-queue-detail), branch `fe/bl-29-5-results-queue-detail` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Source: Pam's live pass docs/design/review-slice-3.md, item(s) S11 (Thai; read the table row for the evidence).

SOURCES:
- `apps/web/features/results/ResultsQueue.tsx` + test. Match fields in schema.d.ts: `result` (a_win|b_win|draw|walkover_a|walkover_b), `reportedAt`, `reportedBy` (an id only: there is NO reporter name yet; Andy asked Kevin for `reportedByName`; render it when present, never the raw id), `flags` (UMPIRE_TEAM_CONFLICT, COMMITTEE_DIRECT_ENTRY, CORRECTED), `games`, `aEntry`/`bEntry` EntryRef.

SPEC:
- Files (ONLY): `ResultsQueue.tsx`, `ResultsQueue.test.tsx`.
- Each row adds `data-testid="result-meta"`: 'รายงานเมื่อ {date time}' (+ ' โดย {reportedByName}' only if that field exists on the item), `data-testid="result-outcome"`: 'ชนะ: {pair name}' | 'เสมอ' | 'ชนะโดยไม่ลงแข่ง: {pair}', and flag chips with text + icon: UMPIRE_TEAM_CONFLICT 'ผู้ตัดสินเกี่ยวข้องกับทีมในแมตช์', COMMITTEE_DIRECT_ENTRY 'คณะกรรมการกรอกเอง', CORRECTED 'แก้ไขผล'.
- Both dialogs (confirm and send-back) start with `data-testid="result-dialog-match"`: '{A} พบ {B}' and one line per game '{i}: {a}–{b}'.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens ONLY: day tokens only (bg-card, bg-primary, text-muted-foreground, bg-warning, ...); grep -E 'bg-(white|blue|gray|red|green|orange|yellow)|text-(gray|blue|red|green|orange|yellow)|border-(gray|red)' must be empty on every line you touch; NO emoji anywhere in UI text (use the SVG icon pattern of `components/ui/WarningBanner.tsx`, aria-hidden, plus text); keep every existing data-testid (Playwright gates use them); tap targets >= 44px; status never by colour alone; document.documentElement.scrollWidth == 390 at 390px.

TOOLS: `pnpm --filter @blulens/web test ResultsQueue` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "shows when it was reported and restates the match in both dialogs": row shows result-meta and result-outcome; opening approve and reject dialogs each show result-dialog-match with the pair names and the game scores.
- Others: flags render text; no raw id shown.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items, pushed branch + SHA.
