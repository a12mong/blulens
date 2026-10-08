PACKET bl-25-1b: every Match response carries `format: MatchFormat` (contract change, Jim 2026-10-08)

Assignee: Meredith (meredith-muxtbonw) · Reviewer: Oscar (oscar-muxt974o) · Senior: Jim while Kevin is paused (jim-muxspl2j)
Tell on merge: Andy (andy-muxsqkra). The umpire result form stops guessing the format from constants.

GOAL: the umpire form and every score check use the real scoring rules of a match (points per game, deuce, cap,
  number of games, draw allowed), read from the event's format.

STATE: branch dev/bl-25-match-format from origin/develop (bl-25-1 is merged: matches.service getEventMatches).
  Event.format (Json, EventFormat: groupMatchFormat / knockoutMatchFormat, both optional) and the zod
  matchFormatSchema / eventFormatSchema in packages/shared/src/schemas/format.ts exist.

SOURCES (openapi, develop):
  Match.format: MatchFormat, readOnly, ALWAYS present: stage group -> groupMatchFormat;
    knockout | third_place -> knockoutMatchFormat; missing -> preset group_2x15 / bo3_21.
  MatchFormat = { preset?, mode: fixed_games|best_of, games 1..5, pointsPerGame 5..31, deuce, cap|null, drawAllowed }
  Presets (tournament-format.md §5): group_2x15 = { preset, mode fixed_games, games 2, pointsPerGame 15, deuce false,
    cap null, drawAllowed true } · bo3_21 = { preset, mode best_of, games 3, pointsPerGame 21, deuce true, cap 30,
    drawAllowed false }.

SPEC (files ONLY: packages/shared/src/format/match-format.ts (new) + its .test.ts, format/index.ts (+ export),
  apps/api/src/modules/matches/matches.service.ts, apps/api/test/<the bl-25-1 e2e spec> (+ asserts)):
  shared: export const MATCH_FORMAT_PRESETS (the two presets above) and
    export function resolveMatchFormat(eventFormat: unknown, stage: 'group' | 'knockout' | 'third_place'): MatchFormat
    (safeParse eventFormatSchema; on failure or a missing field -> the preset; pure). Tests: each stage, missing format,
    invalid json -> preset.
  api: in getEventMatches (and in any other place that maps a Match row to the contract, e.g. /umpire/matches when it
    exists), add format = resolveMatchFormat(event.format, match.stage), resolved once per event, not per row.
  Test: a groups_knockout event with a custom groupMatchFormat -> group matches carry it; an event with no format ->
    the presets.
TOOLS: pnpm --filter @blulens/shared build && (cd packages/shared && npx vitest run); pnpm --filter @blulens/api db:generate;
  cd apps/api && pnpm build && pnpm lint && pnpm test
DONE: push dev/bl-25-match-format, verify on origin, done message to Jim (sha + result lines).
