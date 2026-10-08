# PACKET bl-25-6: MatchResultForm + useReportResult (umpire result entry) (Darryl)

GOAL: One form component where the umpire enters the per-game scores of a match (or a walkover), sees live validation and the winner, and reports the result with a confirm step. Plus the mutation hook. Pure props + hook; the page `/umpire/matches/[id]` comes later when the match fetch endpoint is known.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree OUTSIDE the checkout (sibling folder D:/_work/SourceDev/_code/blulens-<you>-<packet>), branch `fe/bl-25-result-form` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch to origin and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Depends on merged: `scoreRules.ts` (validateGame, validateMatch) and `GameScoreStepper` in `apps/web/features/umpire/`. The API `PUT /matches/{id}/result` may not be served yet: code against the contract and test with mocks.

SOURCES:
- docs/design/demo-slice-3.md section U2 (states table, format badge text, walkover button, local draft notice).
- openapi: `PUT /matches/{matchId}/result` body `{ outcome: played|walkover_a|walkover_b, games?: [{a,b}], reason? }` -> 200 Match; 422 MATCH_SCORE_INVALID; 409 STAGE_CONFIRMED | MATCH_ALREADY_CONFIRMED; 403 UMPIRE_NOT_ASSIGNED | UMPIRE_OWN_MATCH. Types: `Match`, `MatchFormat` in `@/lib/api/schema` (Match: id, stage, groupId, round, aEntry/bEntry EntryRef {displayName, teamNames}, games[{a,b}], result, status scheduled|bye|reported|confirmed|walkover|void, court, flags[]).
- Hook pattern `apps/web/features/review/api.ts` (`useMutation` + `apiFetch`), `thaiError` in `@/lib/errors` (add the 6 error codes to its MESSAGES: MATCH_SCORE_INVALID 'คะแนนไม่ถูกต้องตามกติกา', STAGE_CONFIRMED 'รอบนี้ยืนยันแล้ว แก้ไขไม่ได้', MATCH_ALREADY_CONFIRMED 'แมตช์นี้ถูกยืนยันแล้ว', UMPIRE_NOT_ASSIGNED 'คุณไม่ได้รับมอบหมายแมตช์นี้', UMPIRE_OWN_MATCH 'ห้ามกรอกผลแมตช์ที่ตนเองเป็นผู้เล่น').

SPEC:
- Files (ONLY these): `apps/web/features/umpire/api.ts` (hook `useReportResult(matchId)`: PUT body as above; onSuccess invalidates ['umpire','matches'] and ['matches']), `apps/web/features/umpire/MatchResultForm.tsx`, `apps/web/features/umpire/MatchResultForm.test.tsx`, `apps/web/features/umpire/MatchFormatBadge.tsx`, `apps/web/lib/errors.ts` + `apps/web/lib/errors.test.ts` (only the 5 new codes).
- MatchFormatBadge props `{ format: MatchFormat }` -> text like '2 เกม × 15 แต้ม ไม่มีดิวส์ เสมอได้' / '2 ใน 3 เกม × 21 แต้ม ดิวส์ถึง 30' (best_of: '{needed} ใน {games} เกม'; fixed: '{games} เกม'; deuce -> 'ดิวส์' + (cap ? ' ถึง {cap}' : ''), no deuce -> 'ไม่มีดิวส์'; drawAllowed -> ' เสมอได้').
- MatchResultForm props `{ match: Match; format: MatchFormat; onReported?: (m: Match) => void }`. Uses `useReportResult(match.id)` and local state `games: Game[]` (start with `format.games` zeros; for best_of show only `validateMatch(...).visibleGames` games). Header: court, stage/round, both sides' names + clubs, MatchFormatBadge. One GameScoreStepper per visible game with its error from validateMatch. Summary `data-testid="result-summary"`: 'ผู้ชนะ: {name}' | 'เสมอ' + total point difference, only when `ok`. Buttons: `result-submit` 'รายงานผล' (disabled unless ok), secondary `result-walkover` 'ไม่มาแข่ง (walkover)' opening a dialog (role=dialog) choosing which side did not show (`walkover-a`, `walkover-b`) -> mutate outcome walkover_a|walkover_b (A did not show = walkover_a). Submit click opens a confirm dialog (role=dialog, aria-modal) 'ยืนยันรายงานผล {winner}' with `result-confirm`/`result-cancel`; confirm calls mutate `{ outcome: 'played', games: <only the played games> }`; onSuccess -> onReported(match).
- Status states: `reported` -> banner `data-testid="result-reported"` 'รายงานแล้ว รอ Committee ยืนยัน' (form stays editable, prefilled from match.games); `confirmed` -> read-only 'ยืนยันแล้ว' (+ 'แก้ไขหลังยืนยัน' when flags include CORRECTED), no buttons; `scheduled` -> empty form.
- Errors: mutation error shown in `role="alert"` `data-testid="result-error"` via thaiError.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens only (day theme); mobile-first (check scrollWidth 390 at 390px; tap targets >= 44px, stepper 56px); ROUTE RULE: add no links to pages that do not exist.

TOOLS: `pnpm --filter @blulens/web test MatchResultForm errors` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "reports a valid played result after a confirm and blocks an invalid score": match scheduled, format bo3_21; set game 1 to 21-15 and game 2 to 21-10 (via the stepper inputs score-a/score-b) -> result-summary shows the winner, result-submit enabled; with game 1 at 21-20 -> submit disabled and a game-error; click submit -> dialog -> result-confirm -> mutate called with {outcome:'played', games:[{a:21,b:15},{a:21,b:10}]} (only 2 games).
- Others: walkover dialog sends walkover_a for 'A ไม่มา'; confirmed match is read-only; reported match shows the banner and prefilled scores; server 422 shows 'คะแนนไม่ถูกต้องตามกติกา'; MatchFormatBadge text for group_2x15 and bo3_21.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, scrollWidth at 390, unverified, open items, pushed branch + SHA.
