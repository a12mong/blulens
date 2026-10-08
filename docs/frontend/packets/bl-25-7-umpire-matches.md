# PACKET bl-25-7: Umpire "แมตช์ของฉัน" list + the result page /umpire/matches/[id] (Darryl)

GOAL: The umpire opens /umpire, sees the matches they may report (by court and order, filterable by state), taps one and lands on the result form.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree OUTSIDE the checkout (sibling folder D:/_work/SourceDev/_code/blulens-<you>-<packet>), branch `fe/bl-25-umpire-matches` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch to origin and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Depends on merged: MatchResultForm, useReportResult, MatchFormatBadge (`apps/web/features/umpire/`). The API `GET /umpire/matches` may not be served yet: mocks in tests, graceful error in the UI. The page area guard `apps/web/app/(app)/umpire/layout.tsx` exists; `apps/web/app/(app)/umpire/page.tsx` is a placeholder h1 you replace.

SOURCES:
- docs/design/demo-slice-3.md section U1 (card contents, filters, states) and U2 (page states).
- openapi: `GET /umpire/matches?status=scheduled|reported|confirmed` -> `Match[]` (EntryRef aEntry/bEntry, court, stage, groupId, round, games, status, flags[UMPIRE_TEAM_CONFLICT|COMMITTEE_DIRECT_ENTRY|CORRECTED]). There is NO single-match GET: the result page finds its match in the same list (`useUmpireMatches()` then `find(id)`); the `MatchFormat` of the match: if no endpoint gives it yet, accept it from a constant `DEFAULT_FORMATS` keyed by stage (group -> {preset group_2x15, mode fixed_games, games 2, pointsPerGame 15, deuce false, cap null, drawAllowed true}, knockout/third_place -> {preset bo3_21, mode best_of, games 3, pointsPerGame 21, deuce true, cap 30, drawAllowed false}) and say so in your report (open item for Jim/Kevin).
- Hook pattern: `apps/web/features/umpire/api.ts` (`useReportResult`); `thaiError`.

SPEC:
- Files (ONLY these): `apps/web/features/umpire/api.ts` (append `useUmpireMatches(status?)`, queryKey ['umpire','matches', status ?? 'all']), `apps/web/features/umpire/UmpireMatchCard.tsx`, `apps/web/features/umpire/UmpireMatches.tsx`, `apps/web/features/umpire/UmpireMatches.test.tsx`, `apps/web/features/umpire/UmpireMatchPage.tsx`, `apps/web/features/umpire/UmpireMatchPage.test.tsx`, `apps/web/app/(app)/umpire/page.tsx`, `apps/web/app/(app)/umpire/matches/[id]/page.tsx`.
- UmpireMatchCard props `{ match: Match }`: `<article data-testid="umpire-match" data-status>`: header 'สนาม {court ?? '-'} · {stage text} รอบ {round}' (stage: group 'กลุ่ม', knockout 'น็อคเอาท์', third_place 'ชิงที่ 3'), both sides (displayName + teamNames small) with 'vs' between, status badge text (scheduled 'รอกรอกผล', reported 'รายงานแล้ว', confirmed 'ยืนยันแล้ว', bye 'BYE', walkover 'ไม่มาแข่ง', void 'ยกเลิก') + flag chip 'ผู้ตัดสินสังกัดเดียวกับผู้เล่น' for UMPIRE_TEAM_CONFLICT; action link `data-testid="umpire-match-action"` to `/umpire/matches/{id}`: scheduled 'กรอกผล', reported 'แก้ผล', confirmed 'ดู'; none for bye/void. Min tap 44px.
- UmpireMatches (client): `useUmpireMatches()` all once; filter tabs (`data-testid="umpire-tab-todo|reported|confirmed|all"`, default todo = scheduled) with counts, client-side; cards sorted by court then round; states: skeleton `role=status`; error `role=alert` `data-testid="umpire-error"` via thaiError + 'ลองใหม่'; empty text 'ไม่มีแมตช์ในหมวดนี้'.
- `/umpire/page.tsx`: `<h1>แมตช์ของฉัน</h1><UmpireMatches/>`. `/umpire/matches/[id]/page.tsx` (server, awaits params Promise): `<UmpireMatchPage id={id}/>` with a back link '← แมตช์ของฉัน' to /umpire.
- UmpireMatchPage (client, props `{id}`): finds the match in `useUmpireMatches()`; not found -> `data-testid="umpire-match-missing"` 'ไม่พบแมตช์นี้ หรือคุณไม่มีสิทธิ์'; found -> `<MatchResultForm match format={DEFAULT_FORMATS[stage]} onReported={() => router.push('/umpire')}/>`.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens only (day theme); mobile-first (scrollWidth 390 at 390px; tap targets >= 44px); ROUTE RULE: links only to /umpire and /umpire/matches/{id} (both exist after this packet).

TOOLS: `pnpm --filter @blulens/web test UmpireMatches UmpireMatchPage` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "lists todo matches by default, counts the tabs and links to the result page": mock 3 matches (scheduled court 2, scheduled court 1, confirmed) -> default tab shows 2 cards ordered court 1 then 2, tab text shows counts, action link of the first has href '/umpire/matches/<id>' and text 'กรอกผล'; click the confirmed tab -> 1 card with 'ดู'.
- Others: error with retry; empty text; UMPIRE_TEAM_CONFLICT chip; UmpireMatchPage renders the form for a found match and the missing text otherwise.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, scrollWidth at 390, unverified, open items (esp. the DEFAULT_FORMATS question), pushed branch + SHA.
