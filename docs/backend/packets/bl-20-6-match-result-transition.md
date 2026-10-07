PACKET bl-20-6: matchResultTransition(match, actor, action) in packages/shared (pure)

Assignee: Creed (creed-muxswjfu) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
Part of Jim's bl-20 format core (item 6). The slice-3 umpire/results-queue endpoints will call this.

GOAL:
  One pure state machine for match results (tournament-format.md §5.1, owner-approved slice 3): an umpire reports,
  the Committee confirms / rejects / enters directly / corrects, with the right flags. It returns the next state or a
  coded error; the API layer only persists.

STATE:
  Your worktree. Branch dev/bl-20-match-result from origin/develop (your bl-20-3 is in review: branch from it,
  origin/dev/bl-20-match-score f1015bc, because you call validateMatchScore).
  Available: validateMatchScore(games, format) from your bl-20-3; type MatchFormat from schemas/format.ts.

SOURCES (§5.1 + slice-3 owner decisions, pasted):
  scheduled --umpire report (validated per §5)--> reported
  reported  --the SAME umpire edits--> reported (until confirmed)
  reported  --Committee confirm--> confirmed
  reported  --Committee reject with a reason--> scheduled (the umpire enters again)
  scheduled --Committee enters directly--> confirmed at once, flag COMMITTEE_DIRECT_ENTRY
  confirmed --Committee correct with a reason--> confirmed (new version), flag CORRECTED; allowed only while
             `locked` is false (the group stage is not confirmed / the winner's next knockout match has not started)
  An umpire may not report a match they play in. An umpire who shares a team with a player may report, but the
  match gets flag UMPIRE_TEAM_CONFLICT. An umpire may report only matches assigned to them (their id or their court).

SPEC:
  Files (ONLY these 3): packages/shared/src/format/match-result.ts (new), match-result.test.ts (new),
  packages/shared/src/format/index.ts (+ export line).
  export type MatchFlag = 'UMPIRE_TEAM_CONFLICT' | 'COMMITTEE_DIRECT_ENTRY' | 'CORRECTED'
  export interface ResultMatch { status: 'scheduled'|'reported'|'confirmed'; games: [number, number][] | null;
    playerIds: string[]; playerTeamIds: string[]; umpireId: string | null; court: string | null;
    reportedBy: string | null; version: number; flags: MatchFlag[]; locked: boolean }
  export type ResultActor = { kind: 'umpire'; userId: string; teamIds: string[]; courts: string[] } | { kind: 'committee'; userId: string }
  export type ResultAction =
    | { type: 'report'; games: [number, number][] }   // umpire
    | { type: 'confirm' } | { type: 'reject'; reason: string }
    | { type: 'enter'; games: [number, number][] }    // committee direct entry
    | { type: 'correct'; games: [number, number][]; reason: string }
  export type TransitionResult = { ok: true; match: ResultMatch } | { ok: false; code: string; message: string }
  export function matchResultTransition(m: ResultMatch, actor: ResultActor, action: ResultAction, format: MatchFormat): TransitionResult
  Rules (codes in CAPS, messages in Thai):
    - wrong actor kind for the action -> FORBIDDEN
    - umpire 'report': m.status scheduled, or reported with m.reportedBy === actor.userId (else MATCH_NOT_REPORTABLE);
      actor.userId in playerIds -> UMPIRE_IS_PLAYER; not (m.umpireId === actor.userId || (m.court && actor.courts.includes(m.court)))
      -> UMPIRE_NOT_ASSIGNED; invalid games -> the validateMatchScore code. ok -> status reported, games, reportedBy,
      flags + UMPIRE_TEAM_CONFLICT when actor.teamIds intersects playerTeamIds (no duplicates)
    - 'confirm': status must be reported (else MATCH_NOT_REPORTED) -> confirmed
    - 'reject': status reported; reason trimmed length >= 5 (else REASON_REQUIRED) -> scheduled, games null, reportedBy null,
      flags without UMPIRE_TEAM_CONFLICT
    - 'enter': status scheduled (else MATCH_NOT_SCHEDULED); valid games -> confirmed + COMMITTEE_DIRECT_ENTRY
    - 'correct': status confirmed (else MATCH_NOT_CONFIRMED); locked -> MATCH_LOCKED; reason >= 5; valid games ->
      confirmed, version + 1, + CORRECTED
    - never mutate the input object; return a new one
  Tests (vitest): one test per row above (happy path) and per error code; the umpire edit-before-confirm case; another
    umpire editing a reported match -> MATCH_NOT_REPORTABLE; team-conflict flag added once even on re-report; correct on
    a locked match -> MATCH_LOCKED; input object unchanged (deep-equal to a copy taken before).

CONSTRAINTS: pure; no Date / Math.random / I/O; no new dependencies.

TOOLS: cd packages/shared && npx vitest run src/format ; pnpm --filter @blulens/shared build && pnpm --filter @blulens/shared test

DONE: `git push -u origin dev/bl-20-match-result`, check `git log origin/dev/bl-20-match-result -1`, done message to Kevin with sha + vitest line.
