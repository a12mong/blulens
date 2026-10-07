PACKET bl-20-2: roundRobinSchedule(size, lastRoundPairs?) in packages/shared (pure function)

Assignee: Angela (angela-muxswccx) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
Part of Jim's bl-20 format core (docs/packets/jim-bl-20-format-core.md, item 2), split into one function per packet.

GOAL:
  The round-robin order of matches inside one group of 3, 4 or 5 entries (tournament-format.md §3.3): everyone meets
  everyone once, byes rotate for odd sizes, seeds 1 and 2 of the group meet in the last round, and a same-team pair is
  moved to the last round when the caller asks (GS-03).

STATE:
  Your worktree. Branch dev/bl-20-round-robin from origin/develop (69be10a or later).
  packages/shared has src/draw/* (bl-18 draw; do not change it) and src/index.ts exporting each folder.
  There is no src/format folder yet: you create it.

SOURCES (spec §3.3, pasted):
  - every entry meets every other entry exactly once; circle method; group of 4 = 3 rounds of 2 matches
  - group of 4, by in-group seed 1..4: round 1 = 1v4, 2v3 · round 2 = 1v3, 4v2 · round 3 = 1v2, 3v4
  - groups of 3 and 5 have one rotating bye per round
  QA GS-02: all pairs exactly once; group-4 order exactly as above; byes rotate (nobody sits out twice);
    match count = n(n-1)/2.  GS-03: a same-team pair is played in the LAST round of the group (sizes 3/4/5).

SPEC:
  Files (ONLY these 4): packages/shared/src/format/round-robin.ts (new), packages/shared/src/format/round-robin.test.ts
  (new), packages/shared/src/format/index.ts (new: `export * from './round-robin';`), packages/shared/src/index.ts
  (+ `export * from './format';`).
  export interface RoundRobinRound { round: number; matches: [number, number][]; bye: number | null }
  export function roundRobinSchedule(size: number, lastRoundPairs: readonly [number, number][] = []): RoundRobinRound[]
    - positions are 1-based in-group seeds 1..size. Throw RangeError unless size is an integer 3..5.
    - circle method, exactly this derivation (it reproduces the spec's group-4 table):
        m = size if even, else size + 1 (position m is the bye slot when size is odd)
        L = [2, 3, ..., m]
        for r = 1 .. m-1:
          pairs = [ [1, L[last]] ] then [L[0], L[len-2]], [L[1], L[len-3]], ... (len = L.length; stop when the
            two indices meet)
          a pair that contains m when size is odd is the bye: bye = the other position; otherwise keep it as a match
          then rotate L right by one (last element moves to the front)
      Check by hand for size 4: L=[2,3,4] -> 1v4, 2v3; L=[4,2,3] -> 1v3, 4v2; L=[3,4,2] -> 1v2, 3v4.
    - lastRoundPairs (unordered pairs of positions, e.g. same-team pairs): if non-empty, move ONE round to the end:
      the round that contains the most of those pairs (a tie goes to the round that is LATEST in the circle order).
      The other rounds keep their relative order. Renumber `round` 1..n. With no lastRoundPairs, the circle order stays.
    - pure: no Date, no Math.random, no I/O.
  Tests (vitest, round-robin.test.ts):
    - size 4 equals exactly [{round 1, matches [[1,4],[2,3]], bye null}, {round 2, [[1,3],[4,2]]}, {round 3, [[1,2],[3,4]]}]
    - sizes 3, 4, 5: every unordered pair exactly once; match count 3, 6, 10; rounds 3, 3, 5
    - sizes 3 and 5: exactly one bye per round, every position sits out exactly once
    - lastRoundPairs [[2,3]] with size 4: the last round contains the pair 2,3 and the schedule is still a valid round robin
    - for every size and every possible single pair: that pair lands in the last round (GS-03)
    - size 2, 6 and 3.5 throw RangeError

CONSTRAINTS:
  - Pure function; no new dependencies; identifiers in English. Do not touch src/draw.

TOOLS:
  cd packages/shared && npx vitest run src/format ; then pnpm --filter @blulens/shared build && pnpm --filter @blulens/shared test

DONE:
  `git push -u origin dev/bl-20-round-robin`, then check `git log origin/dev/bl-20-round-robin -1`.
  Done message to Kevin: sha and the vitest result line.
