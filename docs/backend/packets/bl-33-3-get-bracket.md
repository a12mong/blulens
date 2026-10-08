PACKET bl-33-3: GET /api/v1/events/{eventId}/bracket (public bracket read model)

Assignee: Meredith (meredith-muxtbonw), after bl-33-2 · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
Slice 4 step 3. Andy's bracket page (FE bl-33-1) reads this; today it 404s.
STATE: branch dev/bl-33-bracket from origin/develop after bl-33-2 merges (else stacked on origin/dev/bl-33-publish-knockout).
  bl-33-2 creates every knockout Match (stage knockout|third_place, round, matchNo, topEntryId, bottomEntryId, status
  incl. 'bye', winnerEntryId) and apps/api/src/modules/draws/bracket.ts nextSlot(round, index) -> { round, index, side }.
  DrawSlot { position, entryId|null, seedNo }. matches.service: event visibility rule, loadEntryMap (EntryRef), mapMatch.
  Shared: bracketOrder(size) (packages/shared/src/draw/bracket-order.ts: slot -> seed number), eventFormatSchema.
SOURCES: openapi b4261af GET /events/{eventId}/bracket + schemas Bracket and BracketMatch (read them in full; pasted
  essentials): Bracket { eventId, drawId|null, drawVersion|null, drawStatus published|locked|null, provisional, size,
  rounds[{ round, nameTh, matches: BracketMatch[] }], thirdPlace: BracketMatch|null, champion: EntryRef|null }.
  BracketMatch { matchId|null, matchNo, round, top|null, topEntry|null, topSeedNo|null, topPlaceholder|null, bottom...,
  winner|null (confirmed / bye / walkover only), status, games [{a,b}], court|null, nextMatchNo|null, nextSide top|bottom|null }.
SPEC (files ONLY: matches.controller.ts or draws.controller.ts (pick one, @Public like GET matches), the matching
  service, apps/api/test/bracket.e2e-spec.ts new):
  - visibility as GET /events/{id}/matches (draft hidden -> 404 EVENT_NOT_FOUND).
  - PUBLISHED or LOCKED knockout draw exists -> provisional false: rounds from its matches (stage knockout) ordered by
    round, matchNo; thirdPlace from the stage third_place match; entries via loadEntryMap (one query); seedNo from
    DrawSlot for round 1; nextMatchNo/nextSide from nextSlot (final and third place: null); winner only when status
    confirmed, walkover or bye; games from the match (reported games shown with status reported); champion = winner of
    the final when confirmed. Placeholders: round 1 null side of a bye -> 'บาย'; a later-round null side -> 'ผู้ชนะคู่ที่ N'
    (N = matchNo of the feeding match); third-place null side -> 'ผู้แพ้คู่ที่ N' (the feeding semi-final).
  - no knockout draw, event format groups_knockout, and the event has a published or locked group draw -> provisional
    true: Q = groups x advancePerGroup + bestThirds, size = next power of two >= Q, seed order: 'แชมป์กลุ่ม A'..,
    then 'รองแชมป์กลุ่ม A'.., then 'อันดับ 3 ที่ดีที่สุด #1'..; place seed k at the position bracketOrder(size) gives
    seed k; seeds > Q -> 'บาย'. matchId null, matchNo running 1.. in bracket order, later rounds 'ผู้ชนะคู่ที่ N'.
    No names are guessed (tournament-format §4.4).
  - otherwise -> 404 BRACKET_NOT_PUBLISHED.
  - nameTh per round by entries left in that round: 2 'ชิงชนะเลิศ', 4 'รองชนะเลิศ', 8 'ก่อนรองชนะเลิศ', else 'รอบ N คน'.
  - fixed number of queries (no N+1).
  Test: published knockout (from the bl-33-2 fixture, Q = 4): 2 rounds named 'รองชนะเลิศ' and 'ชิงชนะเลิศ', semis
    with entries + seedNos, final with 'ผู้ชนะคู่ที่ 1/2' placeholders and nextMatchNo/nextSide on the semis, thirdPlace
    with 'ผู้แพ้คู่ที่ N'; Q = 3 bye: round 1 bye has winner set and 'บาย'; provisional groups_knockout (2 groups x 2):
    size 4, placeholders 'แชมป์กลุ่ม A' etc., matchId null; knockout event without a draw -> 404 BRACKET_NOT_PUBLISHED;
    draft as Guest -> 404. Clean up.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && TEST_DATABASE_URL=<fresh *_test db> pnpm test
DONE: push, verify on origin, done message to Kevin (sha + FULL pnpm test line on a fresh test DB).
