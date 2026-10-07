PACKET bl-20-1: groupSizes(n, groupSize) + planGroups(entries, groupSize, seed) in packages/shared (pure)

Assignee: Meredith (meredith-muxtbonw) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
Part of Jim's bl-20 format core (item 1). Spec: docs/specs/tournament-format.md §3.1-3.2; QA GS-01, GS-04, GS-05.

GOAL:
  Split an event's entries into groups: how many groups and their sizes (§3.1), then pot-based placement where the
  top seeds go to different groups and same-team entries avoid sharing a group (§3.2), deterministic for a seed.

STATE:
  Branch dev/bl-20-plan-groups from origin/develop (0e8276c or later; src/format exists with round-robin and match-score).
  Available in packages/shared/src/draw: DrawEntry { id, teamIds: string[], seedScore: number }, sharesTeam(a, b),
  createRng(seed) / shuffle(items, rng) (prng.ts). Use them; never Math.random.

SOURCES (spec, in English):
  §3.1 groups g = floor(N / groupSize + 0.5), at least 1. Group sizes differ by at most 1 and every group must have
    3..5 entries; if that is impossible the Committee picks g (return an error, never a silently wrong split).
    Examples (groupSize 4): N=12 -> 4,4,4 · N=10 -> 4,3,3 · N=9 -> 5,4 · N=6 -> 3,3.
  §3.2 sort entries by seedScore desc (ties broken by the PRNG). Pot 1 = the first g, pot 2 = the next g, ...
    (the last pot may be partial). Pot 1: seed 1 -> group A, seed 2 -> group B, ... in order.
    Pot 2 onward: each pot member goes to a different group, chosen by the PRNG, one per group per pot.
    Team rule: entries sharing a team (sharesTeam) should be in different groups. If unavoidable, use a placement
    with the fewest same-team pairs; the API makes the Committee acknowledge it.
    Larger groups (the first `N mod g` groups get one extra) take the members of a partial last pot.

SPEC:
  Files (ONLY these 3): packages/shared/src/format/groups.ts (new), groups.test.ts (new), src/format/index.ts (+ export line).
  export function groupSizes(n: number, groupSize: number): number[] | { error: 'GROUP_SIZES_IMPOSSIBLE' }
    - g = max(1, floor(n / groupSize + 0.5)); sizes: the first (n mod g) groups get ceil(n/g), the rest floor(n/g)
    - any size outside 3..5 -> { error: 'GROUP_SIZES_IMPOSSIBLE' }
  export interface GroupPlan { groups: string[][]; sameTeamPairs: [string, string][] }   // groups[i] = entry ids, pot order
  export function planGroups(entries: readonly DrawEntry[], groupSize: number, seed: string): GroupPlan | { error: 'GROUP_SIZES_IMPOSSIBLE' }
    - sizes = groupSizes(entries.length, groupSize); rng = createRng(`${seed}:groups`)
    - order: sort by seedScore desc; equal scores ordered by shuffle(tiedIds sorted, rng) (deterministic)
    - pot 1 goes in order to groups 0..g-1
    - each later pot: find an assignment of its members to distinct groups that still have room, minimising the
      number of new same-team pairs; among equally good assignments pick by the PRNG: try candidate assignments in
      the order produced by shuffling the group indexes with rng, depth-first, keep the first one that reaches the
      lower bound 0, else the best found (pots have at most 5 members, so a full search is cheap)
    - sameTeamPairs: every pair in the same group that sharesTeam, ids sorted inside a pair, pairs sorted
  Tests (vitest):
    - groupSizes table: N=12,10,9,6 -> the examples above; N=16 -> 4,4,4,4; N=17 -> 5,4,4,4; N=2 -> error; N=13 (groupSize 4) -> 5,4,4
    - for N in 6..17: group count and sizes match groupSizes and every entry is placed exactly once
    - pot 1 seeds land in groups 0,1,2,...; every group gets at most one member of each pot
    - GS-04: 16 entries, 4 teams with 4 entries each, distinct seedScores: 0 same-team pairs, for 200 different seeds
    - GS-05: one team with 5 entries but only 4 groups: exactly 1 same-team pair reported (minimum)
    - same seed gives the same plan; input order of `entries` does not change the plan

CONSTRAINTS: pure; no Date / Math.random / I/O; do not change src/draw.

TOOLS: cd packages/shared && npx vitest run src/format ; pnpm --filter @blulens/shared build && pnpm --filter @blulens/shared test

DONE: `git push -u origin dev/bl-20-plan-groups`, check `git log origin/dev/bl-20-plan-groups -1`, done message to Kevin with sha + vitest line.
