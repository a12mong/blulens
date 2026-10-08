# PACKET bl-29-2-standings-copy: Public standings: correct banner wording, Thai tiebreaker names, readable column headers (Darryl)

GOAL: The standings page says exactly why it is provisional (waiting for confirmation vs matches not yet played), never prints internal keys like 'diff', and explains the W/D/L columns.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree OUTSIDE it (sibling folder D:/_work/SourceDev/_code/blulens-<you>-2-standings-copy), branch `fe/bl-29-2-standings-copy` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Source: Pam's live pass docs/design/review-slice-3.md, item(s) S4 + S5 (Thai; read the table row for the evidence).

SOURCES:
- `apps/web/features/bracket/StandingsPage.tsx`, `GroupStandingsTable.tsx` (`tiebreakNote`, `confirmed` per row), their tests. `useStandings` rows have only `confirmed` and counts; per-match status is not in standings. Matches for the pending count: `GET /events/{eventId}/matches` (public), add a small hook `useEventMatches(eventId)` in `features/bracket/api.ts` (queryKey ['events',eventId,'matches']; Match type from schema: status scheduled|reported|confirmed ...).

SPEC:
- Files (ONLY): `StandingsPage.tsx`, `GroupStandingsTable.tsx`, `features/bracket/api.ts` (add the hook), and their tests.
- S4: banner `data-testid="standings-lock"` states: any match `reported` -> 'มี {n} ผลรอคณะกรรมการยืนยัน'; else some group matches still `scheduled` -> 'แข่งแล้ว {played} จาก {total} แมตช์'; all confirmed -> 'ล็อกแล้ว'. The 'ชั่วคราว' badge on the table only when not all played. Keep the SVG icon + text.
- S5: map tiebreakNote keys to Thai in a small const in GroupStandingsTable: diff -> 'ผลต่างแต้ม', head_to_head -> 'เจอกันเอง', points_for -> 'แต้มได้', wins -> 'จำนวนชนะ' (if other keys appear show 'เกณฑ์อื่น', never the raw key). Column headers: 'ชนะ/เสมอ/แพ้' full words from `md`, short 'ช/ส/พ' below with a legend line under the table 'ช = ชนะ · ส = เสมอ · พ = แพ้'.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens ONLY: night + pixel tokens (bg-night, bg-night-panel, border-night-line, font-pixel) on the public pages; grep -E 'bg-(white|blue|gray|red|green|orange|yellow)|text-(gray|blue|red|green|orange|yellow)|border-(gray|red)' must be empty on every line you touch; NO emoji anywhere in UI text (use the SVG icon pattern of `components/ui/WarningBanner.tsx`, aria-hidden, plus text); keep every existing data-testid (Playwright gates use them); tap targets >= 44px; status never by colour alone; document.documentElement.scrollWidth == 390 at 390px.

TOOLS: `pnpm --filter @blulens/web test StandingsPage GroupStandingsTable` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "explains the provisional state precisely and never shows a raw tiebreaker key": matches {2 confirmed, 1 scheduled} -> 'แข่งแล้ว 2 จาก 3 แมตช์' (not 'รอยืนยัน'); one reported -> 'มี 1 ผลรอ'; tiebreakNote 'diff' renders 'ผลต่างแต้ม'.
- Others: legend present; all confirmed -> 'ล็อกแล้ว'.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items, pushed branch + SHA.
