PACKET bl-25-3: PUT /api/v1/matches/{matchId}/result (umpire reports / Committee enters or corrects)

Assignee: Meredith (meredith-muxtbonw) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
Slice 3. Approve/reject (POST .../result/approve|reject) is the NEXT packet; do not build it here.

GOAL: an assigned Umpire reports a result (-> reported); the Committee enters one directly (-> confirmed) or corrects a
  confirmed one (reason required, resultVersion + 1). Validated against the stage MatchFormat, audited, one transaction.

STATE: branch dev/bl-25-match-result from origin/develop. matches module exists (bl-25-1/1b: matches.service
  getEventMatches + its Match mapper incl. format). Shared (@blulens/shared): matchResultTransition(m: ResultMatch, actor,
  action, format) -> { ok, match } | { ok:false, code, message }; actions report | enter | correct (| confirm | reject,
  not here); resolveMatchFormat(event.format, stage); walkoverGames(format, 'a'|'b'). AuditService.record(entry, tx)
  in apps/api/src/common/audit. Prisma: Match (games Json [{a,b}], result, winnerEntryId, status, resultVersion,
  reportedBy/At, confirmedBy/At, flags, umpireId, court, groupId), EventUmpire { eventId, userId, courts[] (EMPTY = every
  court) }, GroupStanding (a row for match.groupId = the group stage is confirmed = locked), Entry players + user teams.

SOURCES (openapi, pasted):
  PUT /matches/{matchId}/result  x-roles [Umpire, Committee]
    body { outcome: played|walkover_a|walkover_b, games?: [{a,b}] (ints >= 0), reason?: string }
    200 Match (same shape as GET /events/{eventId}/matches items); 422 MATCH_SCORE_INVALID;
    409 STAGE_CONFIRMED | MATCH_ALREADY_CONFIRMED; 403 UMPIRE_NOT_ASSIGNED | UMPIRE_OWN_MATCH

SPEC (files ONLY: matches.controller.ts, matches.service.ts, apps/api/test/match-result.e2e-spec.ts new):
  - zod body; walkover_x -> games = walkoverGames(format, x) (ignore body games); played without games -> 400.
  - In ONE $transaction: SELECT the match FOR UPDATE (raw query, like reviews submit), load event format, entries
    (playerIds + their active team ids), umpire row, lock state. 404 MATCH_NOT_FOUND if missing.
  - Build ResultMatch: games as [a,b][], version = resultVersion, locked = GroupStanding exists for match.groupId.
    actor: Committee/Admin -> { kind 'committee' }; else Umpire -> { kind 'umpire', teamIds: caller's active team ids,
    courts: EventUmpire.courts, or [match.court] when courts is empty; no EventUmpire row -> courts [] }.
    action: umpire -> report; committee + status confirmed -> correct (needs reason); committee otherwise -> enter.
  - Map failure codes: GAME_SCORE_INVALID|GAMES_INCOMPLETE|GAMES_EXTRA|DRAW_NOT_ALLOWED -> 422 MATCH_SCORE_INVALID
    (put the shared code + gameIndex in details); MATCH_LOCKED -> 409 STAGE_CONFIRMED; MATCH_NOT_REPORTABLE or
    MATCH_NOT_SCHEDULED on a confirmed match -> 409 MATCH_ALREADY_CONFIRMED; UMPIRE_IS_PLAYER -> 403 UMPIRE_OWN_MATCH;
    UMPIRE_NOT_ASSIGNED -> 403; REASON_REQUIRED -> 400 VALIDATION_FAILED; FORBIDDEN -> 403.
  - Write back: games [{a,b}], status, flags, resultVersion = match.version, result a_win|b_win|draw|walkover_a|walkover_b
    from validateMatchScore winner / outcome, winnerEntryId; reported -> reportedBy/At; confirmed -> confirmedBy/At.
    Audit { action 'match.result.<report|enter|correct>', entityType 'match', before, after, reason }.
  - Return the mapped Match (reuse the bl-25-1 mapper; do not duplicate it).
  Test (fixtures like event-matches.e2e-spec.ts + an EventUmpire row): umpire reports valid 2x15 -> 200 reported +
    1 audit row; invalid score -> 422; umpire not assigned -> 403; umpire who plays in the match -> 403 UMPIRE_OWN_MATCH;
    Committee enters -> confirmed with COMMITTEE_DIRECT_ENTRY flag; Committee correct without reason -> 400, with reason ->
    resultVersion 2 + CORRECTED; GroupStanding row for the group -> 409 STAGE_CONFIRMED; walkover_a -> a_win-style games.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && pnpm test
DONE: push dev/bl-25-match-result, verify on origin, done message to Kevin (sha + result lines).
