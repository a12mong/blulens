PACKET bl-20-4: computeGroupStandings(entryIds, matches, points, seed) in packages/shared (pure)

Assignee: Angela (angela-muxswccx) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
Part of Jim's bl-20 format core (item 4). ONE group only; best-thirds across groups (§4.3) is a later packet.

GOAL:
  The standings table of one group from its CONFIRMED results (tournament-format.md §4.1-4.2): points 3/1/0,
  then point difference, then head-to-head with the recursive sub-table, then points for, then a seeded lot.

STATE:
  Your worktree. Branch dev/bl-20-standings from origin/develop (your round-robin is in review; branch from develop
  and add your file to src/format/index.ts, a merge combines the export lines).
  Available: packages/shared/src/draw/prng.ts: createRng(seed: string): Rng and shuffle<T>(items, rng): T[]
  (deterministic for a given seed; use these, never Math.random).

SOURCES (spec §4.1, §4.2, §8, pasted in English):
  Points: win 3, draw 1, loss 0 (configurable). Walkover counts as a normal confirmed result with its recorded games.
  Tiebreak order for entries level on points:
    1. points  2. point difference (points for - points against over all games in the group)
    3. head-to-head: if exactly 2 are tied, the winner of their match (if that match was a draw -> step 4).
       If 3 or more are tied: a sub-table of ONLY the matches among the tied entries (points -> point difference).
       - if the sub-table separates some of them: rank those by the sub-table; any subset still tied RESTARTS step 3
         with only that subset (2 -> direct match, 3+ -> a new sub-table of just them)
       - if the sub-table separates nobody (all equal on sub-table points AND sub-table difference) -> step 4 for them
    4. total points for   5. lot: PRNG with the group's draw seed (same result every time; independent of input order and ids)
  §8 fixture (group_2x15, 3/1/0), games are [a, b] for "a v b":
    P1 v P4: [15,8],[15,10]   P2 v P3: [15,13],[12,15]   P1 v P3: [13,15],[15,11]
    P4 v P2: [15,12],[15,14]  P1 v P2: [10,15],[11,15]   P3 v P4: [15,9],[15,13]
    Expected: 1 P3 (W-D-L 1-2-0, 5 pts, 84-77, +7) · 2 P1 (1-1-1, 4, 79-74, +5) · 3 P2 (1-1-1, 4, 83-79, +4) ·
    4 P4 (1-0-2, 3, 70-86, -16). P1 is above P2 on point difference even though P2 beat P1.

SPEC:
  Files (ONLY these 3): packages/shared/src/format/standings.ts (new), standings.test.ts (new),
  packages/shared/src/format/index.ts (+ `export * from './standings';`; create it with only this line if it is missing,
  and then also add `export * from './format';` to src/index.ts).
  export interface GroupMatch { a: string; b: string; status: 'scheduled'|'bye'|'reported'|'confirmed'|'walkover'|'void';
    games: [number, number][] }   // games are [a points, b points]
  export interface StandingRow { entryId: string; rank: number; played: number; won: number; drawn: number; lost: number;
    points: number; pointsFor: number; pointsAgainst: number; diff: number; decidedBy: 'points'|'diff'|'h2h'|'pointsFor'|'lot'|null }
  export function computeGroupStandings(entryIds: readonly string[], matches: readonly GroupMatch[],
    pointsCfg: { win: number; draw: number; loss: number } = { win: 3, draw: 1, loss: 0 }, seed: string): StandingRow[]
    - count ONLY status 'confirmed' and 'walkover' matches; ignore everything else (reported results never count)
    - a match winner = the side that won more games; equal games = draw
    - rank 1..n, no shared ranks (step 5 always separates). decidedBy = the step that separated this entry from the
      next one below it (null for the last row)
    - lot (step 5): order the still-tied ids with shuffle([...ids].sort(), createRng(`${seed}:lot:${[...ids].sort().join(',')}`))
      so the result does not depend on input order
    - implement step 3 recursively as described; it must always terminate
  Tests (vitest):
    - the §8 fixture: exact rank order and every number in the expected table; P1/P2 decidedBy 'diff'
    - 2 tied on points and diff -> the direct winner is above (decidedBy 'h2h'); their match drawn -> pointsFor decides
    - 3-way cycle (A beat B, B beat C, C beat A, equal points and diff, different points for) -> pointsFor order;
      run it with the matches array shuffled 20 times -> same result every time
    - a 3-way tie where the sub-table separates one entry and the other two restart with their direct match
    - a full tie on everything -> lot; same seed same order; a different seed may differ; input order irrelevant
    - 'reported' and 'scheduled' matches are ignored (add a reported result that would change the order -> no change)

CONSTRAINTS:
  - Pure; no Date / Math.random / I/O; no new dependencies; do not change src/draw.

TOOLS:
  cd packages/shared && npx vitest run src/format ; pnpm --filter @blulens/shared build && pnpm --filter @blulens/shared test

DONE:
  `git push -u origin dev/bl-20-standings`, check `git log origin/dev/bl-20-standings -1`, done message to Kevin with sha + vitest line.
