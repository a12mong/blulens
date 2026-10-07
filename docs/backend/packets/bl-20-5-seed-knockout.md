PACKET bl-20-5: seedKnockout(qualifiers, seed) in packages/shared (pure)

Assignee: Meredith (meredith-muxtbonw) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
Part of Jim's bl-20 format core (item 5). Spec: docs/specs/tournament-format.md §6; draw.md appendix A (bracketOrder).

GOAL:
  Place the group-stage qualifiers into the knockout bracket: tiered seeding (group winners first, then runners-up,
  then best thirds), byes to the top seeds, and as few first-round meetings as possible between entries of the SAME
  TEAM (first priority) or the SAME GROUP (second priority).

STATE:
  Branch dev/bl-20-seed-knockout from origin/develop. Available in packages/shared/src/draw: bracketOrder(size)
  (bracket-order.ts; read its doc comment for what each array position means: slot -> seed number), sharesTeam(a, b).

SOURCES (spec §6, in English):
  Q qualifiers; bracket size S = the smallest power of two >= Q; byes = S - Q, given to the best seeds.
  Seed numbers: all group winners first (seed 1..g, ordered among themselves), then all runners-up, then the best thirds.
  Positions come from the standard slot order (bracketOrder). Conflicts in the FIRST round: same team (sharesTeam)
  and same group. Minimise lexicographically (teamClashes, groupClashes): team clashes first, group clashes second.

SPEC:
  Files (ONLY these 3): packages/shared/src/format/knockout-seed.ts (new), knockout-seed.test.ts (new), src/format/index.ts (+ export).
  export interface Qualifier { entryId: string; teamIds: string[]; groupIndex: number; tier: 1 | 2 | 3; tierRank: number }
    // tierRank 1 = best inside its tier (the caller ranks each tier with the §4.3 criteria)
  export interface KnockoutPlan { size: number; slots: (string | null)[]; teamClashes: number; groupClashes: number }
    // slots[i] = entry id, or null for a bye; first-round pairs are (slots[0], slots[1]), (slots[2], slots[3]), ...
  export function seedKnockout(qualifiers: readonly Qualifier[], seed: string): KnockoutPlan
    1. order = sort by (tier asc, tierRank asc, entryId asc) -> seed number 1..Q. Throw RangeError if Q < 2.
    2. size S; place seed number k into the slot where bracketOrder(S) puts seed k; seeds Q+1..S are byes (null).
    3. improve: repeatedly look for the best single SWAP of two entries of the SAME tier (never across tiers, never
       touching byes) that lowers (teamClashes, groupClashes) lexicographically; apply it; stop when no swap improves.
       Candidate swaps are visited in a deterministic order: pairs (i, j) of slot indexes i < j ascending; ties between
       equally good swaps -> the first one visited. (`seed` is reserved for a later solver; do not use randomness now.)
    4. clashes counted over first-round pairs where both slots hold an entry.
  Tests (vitest):
    - 4 groups x 2 advance (Q = 8): winners take seeds 1-4, runners-up 5-8; each winner meets a runner-up in round 1;
      no first-round pair from the same group
    - Q = 6 (S = 8): the two byes go to seeds 1 and 2 (their opponent slot is null)
    - a case where avoiding a team clash forces a group clash: the result keeps teamClashes minimal and accepts the
      group clash (team first)
    - the result is identical for every input order of `qualifiers`; it never swaps across tiers; Q = 1 throws

CONSTRAINTS: pure; no Date / Math.random / I/O; do not change src/draw.
TOOLS: cd packages/shared && npx vitest run src/format ; pnpm --filter @blulens/shared build && pnpm --filter @blulens/shared test
DONE: push dev/bl-20-seed-knockout, verify on origin, done message to Kevin (sha + vitest line).
