# PACKET bl-25-5: Badminton score validation + GameScoreStepper (Darryl)

GOAL: The umpire enters per-game scores on a phone with big +/- buttons; the entry is validated live against the match format (points per game, deuce, cap, fixed games vs best-of) so the submit button can be disabled with a clear reason. Pure logic + one component, no API.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree OUTSIDE the checkout (sibling folder D:/_work/SourceDev/_code/blulens-<you>-<packet>), branch `fe/bl-25-score-stepper` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch to origin and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- The server remains the final judge (422 MATCH_SCORE_INVALID); this is live help only. Night tokens are NOT used here: the umpire screens use the normal day theme.

SOURCES:
- docs/design/demo-slice-3.md section U2 (stepper, live validation, format badge text). `MatchFormat` from `@/lib/api/schema` components['schemas']['MatchFormat']: {preset group_2x15|single_30|bo3_21|single_21|custom, mode fixed_games|best_of, games (1..5), pointsPerGame (5..31), deuce boolean, cap number|null, drawAllowed boolean}.
- Badminton rules used here: a game is won by the side that reaches `pointsPerGame` with a lead of 2 when `deuce`, or simply reaches `pointsPerGame` when not `deuce`; with deuce the game continues until a 2-point lead, but ends at `cap` (first to `cap` wins even by 1). Without deuce the winner has exactly `pointsPerGame` and the loser has fewer.

SPEC:
- Files (ONLY these): `apps/web/features/umpire/scoreRules.ts`, `apps/web/features/umpire/scoreRules.test.ts`, `apps/web/features/umpire/GameScoreStepper.tsx`, `apps/web/features/umpire/GameScoreStepper.test.tsx`.
- `scoreRules.ts` exports:
  - `type Game = { a: number; b: number }`.
  - `validateGame(g: Game, f: MatchFormat): string | null` -> Thai error or null if the game is a legal final score: returns 'ยังไม่ครบ {pointsPerGame} แต้ม' when nobody reached the target, 'ต้องห่างกัน 2 แต้ม' when deuce is on and the lead is 1 at/after target (unless a cap decides), 'เกินแต้มสูงสุด {cap}' when above cap, 'ผลเสมอไม่ได้' when both equal and not allowed, and for no-deuce 'ผู้ชนะต้องได้ {pointsPerGame} แต้มพอดี'. Examples with pointsPerGame 21, deuce true, cap 30: 21-19 ok, 21-20 'ต้องห่างกัน 2 แต้ม', 22-20 ok, 30-29 ok (cap), 31-29 'เกินแต้มสูงสุด 30', 20-18 'ยังไม่ครบ 21 แต้ม'. For pointsPerGame 15, deuce false: 15-13 ok, 16-14 'ผู้ชนะต้องได้ 15 แต้มพอดี'.
  - `validateMatch(games: Game[], f: MatchFormat): { ok: boolean; errors: (string | null)[]; winner: 'a' | 'b' | 'draw' | null; visibleGames: number }`: `fixed_games`: needs exactly `games` games each valid; winner = more games won, `draw` only if equal and `drawAllowed`, equal and not allowed -> not ok with message 'ผลเสมอไม่ได้' on the match. `best_of`: games needed = ceil(games/2); `visibleGames` = games played until someone has the needed wins (hide later games); not ok until a side has the needed wins.
- `GameScoreStepper.tsx`: props `{ index: number; value: Game; onChange: (g: Game) => void; error?: string | null; disabled?: boolean }`. Renders `<fieldset data-testid="game-stepper">` legend 'เกมที่ {index+1}', two columns A and B each with `-` and `+` buttons (`data-testid="step-a-minus|step-a-plus|step-b-minus|step-b-plus"`, min 56px square, aria-label 'ลดแต้ม ฝ่าย A' etc.), a numeric `<input inputMode="numeric" data-testid="score-a|score-b">` (0..99, non-numbers ignored), minus never below 0. `error` shown under the game in `role="alert"` `data-testid="game-error"`.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens only (day theme); tap targets >= 56px for the stepper buttons; check scrollWidth 390 at 390px in a browser (render the stepper in a scratch page or via the test dev server and report).

TOOLS: `pnpm --filter @blulens/web test scoreRules GameScoreStepper` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test (scoreRules) "validates games per the format": the examples above, and `validateMatch` for bo3_21 (games 3): [21-15, 18-21, 21-19] ok winner 'a', visibleGames 3; [21-15, 21-10] ok winner 'a', visibleGames 2 (third hidden); [21-15] not ok. For group_2x15 fixed 2 games with drawAllowed: [15-10, 10-15] ok winner 'draw'.
- Proving test (stepper) "plus/minus and typing update the score, minus stops at 0": click step-a-plus twice -> onChange {a:2,b:0}; step-b-minus at 0 -> stays 0; typing '21' in score-a -> a 21; error shows in game-error.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, scrollWidth at 390, unverified, open items, pushed branch + SHA.
