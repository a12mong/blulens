PACKET bl-20-3: validateMatchScore(games, format) + walkoverGames(format, winner) in packages/shared (pure)

Assignee: Creed (creed-muxswjfu) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
Part of Jim's bl-20 format core (docs/packets/jim-bl-20-format-core.md, item 3).

GOAL:
  Check a match score typed in by an umpire or the Committee against the event's match format
  (tournament-format.md §5), and produce the walkover score (§4.1). Later endpoints call these, so the rules live in one place.

STATE:
  Your worktree. Branch dev/bl-20-match-score from origin/develop (69be10a or later).
  Already exists: packages/shared/src/schemas/format.ts exports matchFormatSchema and type MatchFormat =
    { preset?: 'group_2x15'|'single_30'|'bo3_21'|'single_21'|'custom', mode: 'fixed_games'|'best_of', games: 1..5,
      pointsPerGame: 5..31, deuce: boolean, cap?: number|null, drawAllowed: boolean }.
  Angela is creating packages/shared/src/format/ (round-robin) in parallel: you add YOUR file next to hers. If her
  folder is not on develop yet, create packages/shared/src/format/index.ts yourself with only your export line, and
  add `export * from './format';` to src/index.ts; the merge will combine both export lines.

SOURCES (spec §5 + §4.1 + QA GS-17/GS-20, pasted):
  Presets: group_2x15 = fixed_games, 2 games, 15 points, no deuce, draw allowed (1-1)
           single_30  = best_of, 1 game, 30 points, no deuce
           bo3_21     = best_of, 3 games, 21 points, deuce up to cap 30
           single_21  = best_of, 1 game, 21 points, deuce up to cap 30
  Per game: the winner has exactly pointsPerGame and the loser less. With deuce: the winner leads by >= 2,
    or has exactly cap when the score was cap-1 : cap-1.
  fixed_games: every game must be entered. best_of: stop once someone has won ceil(N/2) games; no extra games.
  GS-17 examples: group_2x15 15-8 ok, 15-14 ok, 16-14 bad, 14-14 bad, 15-15 bad; bo3_21 22-20 ok, 21-20 bad,
    30-29 ok (cap), 31-29 bad; negative / fractional / missing values bad.
  Walkover (§4.1, GS-20): the winner gets full points to 0 in the games needed to win: fixed_games = every game,
    best_of = ceil(N/2) games. group_2x15 = 15-0,15-0 · single_30 = 30-0 · bo3_21 = 21-0,21-0 · single_21 = 21-0.

SPEC:
  Files (ONLY these 4): packages/shared/src/format/match-score.ts (new), packages/shared/src/format/match-score.test.ts
  (new), packages/shared/src/format/index.ts (+ `export * from './match-score';`), packages/shared/src/index.ts
  (only if `export * from './format';` is missing).
  export type GameScore = [number, number]   // [side a points, side b points]
  export type MatchScoreResult =
    | { ok: true; winner: 'a' | 'b' | null /* null = draw */; gamesA: number; gamesB: number; pointsA: number; pointsB: number }
    | { ok: false; code: 'GAME_SCORE_INVALID' | 'GAMES_INCOMPLETE' | 'GAMES_EXTRA' | 'DRAW_NOT_ALLOWED'; gameIndex?: number; message: string }
  export function isValidGame(game: GameScore, f: MatchFormat): boolean
    - both values integers >= 0; w = max, l = min; w !== l; P = f.pointsPerGame
    - no deuce: w === P && l < P
    - deuce: (w === P && l <= P - 2) || (w > P && w - l === 2 && (f.cap == null || w <= f.cap))
             || (f.cap != null && w === f.cap && l === f.cap - 1)
  export function validateMatchScore(games: readonly GameScore[], f: MatchFormat): MatchScoreResult
    - first invalid game -> GAME_SCORE_INVALID with its 0-based gameIndex
    - fixed_games: games.length < f.games -> GAMES_INCOMPLETE; > f.games -> GAMES_EXTRA; equal games won -> draw if
      f.drawAllowed else DRAW_NOT_ALLOWED
    - best_of: need = ceil(f.games / 2); a game entered after someone reached need -> GAMES_EXTRA (gameIndex of that
      game); nobody reached need at the end -> GAMES_INCOMPLETE
    - messages in Thai (e.g. 'คะแนนเกมที่ 2 ไม่ถูกต้องตามกติกา', 'กรอกผลไม่ครบทุกเกม', 'กรอกเกมเกินจำนวนที่ต้องเล่น',
      'รูปแบบนี้ไม่อนุญาตให้เสมอ'); points totals summed over all games
  export function walkoverGames(f: MatchFormat, winner: 'a' | 'b'): GameScore[]
    - count = fixed_games ? f.games : ceil(f.games / 2); each game [P, 0] for 'a' or [0, P] for 'b'
    - the result must itself pass validateMatchScore (assert it in a test)
  Tests (vitest): a PRESETS table in the test file (the 4 presets above as MatchFormat). Then:
    - every GS-17 example above, plus at least 20 rows per preset (table-driven: valid and invalid)
    - group_2x15: [15,10],[10,15] -> ok, winner null; with drawAllowed false -> DRAW_NOT_ALLOWED; one game -> GAMES_INCOMPLETE
    - bo3_21: [21,10],[21,15],[21,3] -> GAMES_EXTRA gameIndex 2; [21,10],[10,21] -> GAMES_INCOMPLETE; [21,20] invalid
      game 0 (needs a 2-point lead), while [21,19] and [23,21] are valid games
    - walkoverGames for all 4 presets equals the §4.1 list, for winner 'a' and 'b'
    - a fractional (15.5) and a negative value -> GAME_SCORE_INVALID

CONSTRAINTS:
  - Pure functions; no Date / Math.random / I/O; no new dependencies. Do not change schemas/format.ts or src/draw.

TOOLS:
  cd packages/shared && npx vitest run src/format ; then pnpm --filter @blulens/shared build && pnpm --filter @blulens/shared test

DONE:
  `git push -u origin dev/bl-20-match-score`, then check `git log origin/dev/bl-20-match-score -1`.
  Done message to Kevin: sha and the vitest result line.
