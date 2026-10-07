# PACKET bl-21-11: /events page (tournament list) (Darryl)

GOAL: The page at `/events` that lists tournaments as cards, lets a Committee user open (publish) a draft, and links to the create wizard.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-21-events-page` from `origin/develop` (TournamentCard is on develop once Stanley approves it; until then cherry-pick `fe/bl-21-tournament-card`), `pnpm install` there; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190 (not 3100). Never commit to main/develop.
- Review gate: after done, Andy sends your branch to Stanley; merge only on APPROVE.
- Depends on: bl-21-10 (TournamentCard), bl-21-1 (hooks, merged).

SOURCES:
- docs/design/demo-slice-1.md section D2 list states (loading skeleton, empty "ยังไม่มีทัวร์นาเมนต์", error + retry, status badges).
- Hooks in `apps/web/features/events/api.ts`: `useTournaments()` (returns TournamentPage `{items,nextCursor}` of Tournament), `useEvents(tournamentId)`, `useSetTournamentStatus(tournamentId, options?)`. The card needs `TournamentDetail` (Tournament + events[]): build the detail by calling `useEvents` per card inside a small child component `TournamentCardWithEvents({ tournament })` in the same file.
- Me: `useMe()` from `@/features/auth/api`; Committee gate: `me.roles.includes('Committee')`.
- Existing layout: `apps/web/app/(app)/layout.tsx` wraps pages in the AuthedShell; guests are redirected by middleware.

SPEC:
- Files (ONLY these): `apps/web/app/(app)/events/page.tsx`, `apps/web/features/events/TournamentList.tsx`, `apps/web/features/events/TournamentList.test.tsx`. page.tsx is a thin server component rendering `<TournamentList />` under an `<h1>ทัวร์นาเมนต์</h1>`.
- TournamentList (client): states: pending -> 3 skeleton blocks `data-testid="tournament-skeleton"`; error -> `role="alert"` `data-testid="tournament-list-error"` with message and button `tournament-retry` "ลองใหม่" calling refetch; empty -> `data-testid="tournament-empty"` "ยังไม่มีทัวร์นาเมนต์" (+ create link when canManage); list -> one `TournamentCardWithEvents` per tournament inside `<div data-testid="tournament-list">`.
- canManage = Committee role. When canManage render `<a data-testid="tournament-create-open" href="/events/new">+ สร้างทัวร์นาเมนต์</a>` above the list. Admin-only users do not see it.
- Publish: the card's onOpen calls `useSetTournamentStatus(tournament.id).mutate({ to: 'open' })`; while pending disable that card's button; on `ApiRequestError` show `role="alert"` `data-testid="tournament-publish-error"` with the server message (e.g. 409 TOURNAMENT_INVALID_TRANSITION).
- Polling: `refetchInterval` 30_000 is NOT set in the hook; do not add polling here.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI text; tailwind classes with theme tokens only; no direct fetch.

TOOLS: `pnpm --filter @blulens/web test TournamentList` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "renders one card per tournament and shows the create link only for Committee": mock `useTournaments` -> 2 tournaments, mock `useEvents` -> [], mock `useMe` Committee -> 2 `tournament-card`, 1 `tournament-create-open`; with roles ['Admin'] -> no create link.
- Others: skeleton while pending; empty state; error + retry calls refetch; publish click calls the status mutation with {to:'open'} and a failing mutation shows tournament-publish-error.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items.
