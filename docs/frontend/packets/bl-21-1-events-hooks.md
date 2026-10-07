# PACKET bl-21-1-events-hooks: events/entries query hooks (Ryan)

GOAL: TanStack Query hooks for tournaments, events and entries so pages never call fetch.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-21-events-hooks` from `origin/develop`, `pnpm install` there; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190 (not 3100). Never commit to main/develop.
- Review gate: after done, Andy sends your branch to Stanley; merge only on APPROVE.
- Depends on: none (apiFetch and Providers are on develop)

SOURCES:
- docs/api/openapi.yaml: GET/POST `/tournaments`, POST `/tournaments/{tournamentId}/events`, GET/POST `/events/{eventId}/entries`; schemas TournamentInput, Tournament, TournamentPage, EventInput, Event, Entry. Types: `import type { components } from '@/lib/api/schema'`.
- Pattern: apps/web/features/auth/api.ts (query key const, composed onSuccess, apiFetch).
- Now in the contract (develop 0648a86; run `pnpm --filter @blulens/web gen:api` to refresh types): GET `/tournaments/{tournamentId}` -> TournamentDetail (Tournament + events[]); GET `/tournaments/{tournamentId}/events` -> Event[]; GET `/events/{eventId}` -> EventDetail (Event + tournamentName, tournamentStatus, entryCount); POST `/tournaments/{tournamentId}/status` body {to: open|closed|running|finished} -> TournamentDetail (409 TOURNAMENT_INVALID_TRANSITION).

SPEC:
- Files (ONLY these): `apps/web/features/events/api.ts`, `apps/web/features/events/api.test.tsx`.
- Export keys: `tournamentsKey = ['tournaments']`, `eventsKey = (tournamentId: string) => ['tournaments', tournamentId, 'events']`, `entriesKey = (eventId: string) => ['events', eventId, 'entries']`.
- `useTournaments()` -> GET /tournaments (returns TournamentPage `items`; return the page).
- `useCreateTournament(options?)` -> POST /tournaments body TournamentInput; onSuccess invalidates tournamentsKey, then calls caller onSuccess with `...args` (compose; options first, then our onSuccess).
- `useTournament(tournamentId)` -> GET /tournaments/{id} (TournamentDetail), key ['tournaments', id].
- `useSetTournamentStatus(tournamentId, options?)` -> POST /tournaments/{id}/status body {to}; invalidates tournamentsKey and ['tournaments', id].
- `useEvent(eventId)` -> GET /events/{id} (EventDetail), key ['events', eventId].
- `useEvents(tournamentId)` -> GET /tournaments/{id}/events (Event[]).
- `useCreateEvent(tournamentId, options?)` -> POST /tournaments/{id}/events body EventInput; invalidates eventsKey(tournamentId).
- `useEventEntries(eventId)` -> GET /events/{id}/entries (Entry[]), `refetchInterval: 30_000`.
- `useCreateEntry(eventId, options?)` -> POST /events/{id}/entries body `{ playerIds: string[] }`; invalidates entriesKey(eventId); returns Entry (caller reads `warnings` for MULTI_TEAM).

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI text; tokens/tailwind classes only, no hex; no business logic (API decides, web only renders); no direct fetch in components (use hooks / apiFetch from apps/web/lib/api/client.ts).

TOOLS: `pnpm --filter @blulens/web test events` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "useCreateTournament posts the body and invalidates the tournaments list": mock '@/lib/api/client' apiFetch; run mutation with {name:'Cup',startsOn:'2026-11-01',entriesCloseAt:'2026-10-25T00:00:00Z'}; assert apiFetch called with '/tournaments' and method 'POST' and that queryClient.invalidateQueries was called with {queryKey:['tournaments']} (spy).
- Others: useCreateEntry invalidates entriesKey and passes through the Entry with warnings; useEventEntries calls '/events/E1/entries'; caller onSuccess is also called.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items.
