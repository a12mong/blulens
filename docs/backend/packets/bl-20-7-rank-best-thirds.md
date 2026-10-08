PACKET bl-20-7: rankBestThirds(groups, pointsCfg, seed) in packages/shared/src/format/standings.ts (pure)

Assignee: Meredith (meredith-muxtbonw), reassigned from Angela (she is near her context limit; she never started it)
Reviewer: Oscar (oscar-muxt974o) · Senior: Jim while Kevin is paused (jim-muxspl2j)
Replaces Kevin's short note to Angela (kevin-k3), which had two gaps: the lot must be the seeded PRNG (not entryId
order), and the input needs each group's matches to recompute the thirds.

GOAL: when bestThirds > 0, rank every group's 3rd-placed entry so the best ones go through (tournament-format.md §4.3).

STATE: branch dev/bl-20-best-thirds from origin/develop. computeGroupStandings(entryIds, matches, pointsCfg, seed) and
  the private applyLot (createRng(`${seed}:lot:${sortedIds}`) + shuffle) are already in standings.ts.

SOURCES (§4.3 + §4.2, pasted in English):
  Take the 3rd-placed entry of every group. Rank them by §4.2 criteria 1, 2, 4, 5: points, point difference,
  points for, lot (criterion 3 head-to-head cannot apply: they never met).
  If the groups are not the same size: first REMOVE each third's results against the LAST-placed entry of a group that
  is larger than the smallest group, so every third is compared over the same number of matches (decision F7).
  Only confirmed / walkover matches count (same rule as computeGroupStandings).

SPEC (files ONLY: standings.ts, standings.test.ts):
  export interface GroupInput { groupIndex: number; entryIds: readonly string[]; matches: readonly GroupMatch[] }
  export interface ThirdRow { entryId: string; groupIndex: number; points: number; diff: number; pointsFor: number;
    rank: number; decidedBy: 'points' | 'diff' | 'pointsFor' | 'lot' | null }
  export function rankBestThirds(groups: readonly GroupInput[], pointsCfg = { win: 3, draw: 1, loss: 0 },
    seed: string): ThirdRow[]
  1. For each group: rows = computeGroupStandings(entryIds, matches, pointsCfg, `${seed}:g${groupIndex}`). A group
     with fewer than 3 entries has no third (skip it).
  2. minSize = the smallest entryIds.length among the groups. For a group with size > minSize: drop the matches between
     its 3rd and its last-placed entry, then recompute that third's points / diff / pointsFor from the rest
     (a small private helper; do not change computeGroupStandings).
  3. Sort by points desc, diff desc, pointsFor desc; any tie still left goes to the lot: reuse applyLot with
     `${seed}:thirds` (deterministic; independent of input order). rank = 1..k; decidedBy as in StandingRow.
  Pure: no Date, no Math.random.
  Tests: 3 groups of 4: plain order by points; an unequal case (one group of 5 + groups of 4) where dropping the result
    against the 5-group's last place CHANGES the order (assert the order before and after); a full tie decided by
    the lot that stays the same when the input groups are shuffled; a group of 2 has no third.
TOOLS: pnpm --filter @blulens/shared build && (cd packages/shared && npx vitest run)
DONE: push dev/bl-20-best-thirds, verify on origin, done message to Jim (sha + vitest line).
