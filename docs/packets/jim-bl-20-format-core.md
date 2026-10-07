# Packet bl-20 — Tournament format core (Jim -> Kevin)

GOAL: pure, deterministic functions in `packages/shared` for the group stage + knockout format, plus the schema deltas they need, so bl-10 endpoints can be thin.
1. `planGroups(entries, format, seed)`: group count/sizes (§3.1), pots + same-team separation reusing the bl-18 solver (§3.2), teammates' mutual match moved to the last round when unavoidable.
2. `roundRobinSchedule(group)`: circle method; group of 4 = 1v4, 2v3 / 1v3, 4v2 / 1v2, 3v4 (§3.3); rotating byes for 3/5.
3. `validateMatchScore(games, matchFormat)`: presets group_2x15, single_30, bo3_21, single_21 + custom; deuce/cap; fixed_games vs best_of (§5); walkover score generation (§4.1).
4. `computeStandings(group, matches, format, seed)`: CONFIRMED results only; points 3/1/0; tiebreak points -> point diff -> head-to-head with recursive sub-block restart -> points for -> seeded lot (§4.2); best-thirds with the "drop results vs last place of bigger groups" rule (§4.3).
5. `seedKnockoutFromStandings(snapshot, format, seed)`: tiered seeding (winners -> runners-up -> thirds), bracket order from draw.md appendix A, lexicographic conflict cost (teamConflicts, groupConflicts) (§6), optional 3rd-place match.
6. `matchResultTransition(match, actor, action)`: scheduled -> reported -> confirmed, reject, Committee direct entry, correction rules + flags (§5.1).

STATE: spec frozen — docs/specs/tournament-format.md v1 (commits 3b1e248, 32bb443). draw.md v1 frozen; your bl-18 solver/bracket order is the building block. Schema deltas: matches (stage, group_id, round, court, umpire_id, games jsonb, result, status scheduled|bye|reported|confirmed|walkover|void, reported_by/at, confirmed_by/at, flags), groups, group_members, group_standings snapshot, event_umpires, events.format jsonb, draws.kind group|knockout, Role + Umpire.

SOURCES: docs/specs/tournament-format.md (all sections; §8 fixture), docs/specs/draw.md appendix A/§4, docs/api/openapi.yaml tag `format` (Match, EventFormat, MatchFormat, GroupStanding, EventUmpire), docs/qa/test-plan.md §4 GS-01..24 (Dwight), reference rules only: D:/_work/SourceDev/_code/bbfriendlymatch/src/lib/standings.ts.

CONSTRAINTS: pure functions (no Date.now / Math.random / DB); PRNG + seed from bl-18; zod types in shared matching openapi; Thai comments optional, identifiers English; split into micro-tasks for Angela/Creed (one function each). Sequence AFTER your current bl-07/18/19 queue.

TOOLS: your own worktree (TEAM.md §9) — never switch branches in the shared checkout; branch `be/bl-20-<slug>`.

DONE: unit tests with the §8 standings fixture, the 4 walkover presets, a 3-way tie needing a sub-block restart, a knockout case where team vs group conflicts trade off (team first), and the umpire flow transitions; PR + the real test command output; then a done message to Jim.
