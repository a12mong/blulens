# PACKET bl-21-2-create-tournament-form: CreateTournamentForm component (Phyllis)

GOAL: A form where a Committee user creates a tournament (name, venue, start date, entries-close time).

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-21-create-tournament-form` from `origin/develop`, `pnpm install` there; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190 (not 3100). Never commit to main/develop.
- Review gate: after done, Andy sends your branch to Stanley; merge only on APPROVE.
- Depends on: bl-21-1 (hooks) merged; until then mock the hook module in your test

SOURCES:
- docs/api/openapi.yaml schema TournamentInput: name* , venue, startsOn* (date), entriesCloseAt* (date-time). Hook: `useCreateTournament` from `@/features/events/api` (bl-21-1).
- Style reference: apps/web/features/auth/LoginForm.tsx.

SPEC:
- Files (ONLY these): `apps/web/features/events/CreateTournamentForm.tsx`, `apps/web/features/events/CreateTournamentForm.test.tsx`.
- Props: `{ onCreated?: (t: Tournament) => void }` (Tournament from components['schemas']['Tournament']).
- Fields with labels and data-testid: name `tournament-name` (required, max 80), venue `tournament-venue`, start date `tournament-starts-on` (type=date, required), close time `tournament-entries-close` (type=datetime-local, required; convert to ISO UTC string with `new Date(value).toISOString()`); submit button `tournament-submit` text "สร้างการแข่งขัน".
- Client check before submit: entries-close must be earlier than start date end-of-day; else show `<p role="alert" data-testid="tournament-error">` text "ปิดรับสมัครต้องก่อนวันแข่ง" and do not call mutate.
- States: pending -> button disabled; API error -> `role="alert"` with the ApiRequestError message (data-testid `tournament-error`); success -> reset the form and call onCreated(tournament).

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI text; tokens/tailwind classes only, no hex; no business logic (API decides, web only renders); no direct fetch in components (use hooks / apiFetch from apps/web/lib/api/client.ts).

TOOLS: `pnpm --filter @blulens/web test CreateTournamentForm` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "submits TournamentInput with ISO close time": mock useCreateTournament to capture mutate; fill name 'Cup', start '2026-11-01', close '2026-10-25T10:00'; click submit; assert mutate called with {name:'Cup', startsOn:'2026-11-01', entriesCloseAt: new Date('2026-10-25T10:00').toISOString(), venue omitted or ''} (empty venue must be omitted).
- Others: close after start -> error text and no mutate; API error message rendered.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items.
