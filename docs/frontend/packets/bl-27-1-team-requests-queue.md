# PACKET bl-27-1: Committee team-requests queue (S17): create team, alias to an existing team, or reject (Darryl)

GOAL: The Committee opens /committee/teams/requests, sees each pending "please add this team" request with similar existing teams, and creates the team, aliases it to an existing one, or rejects it with a reason.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree OUTSIDE it (sibling folder D:/_work/SourceDev/_code/blulens-darryl-teamreq), branch `fe/bl-27-team-requests` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Routes verified on develop: `GET /team-requests` (Committee/Admin, pending only) and `POST /team-requests/{requestId}/resolve` exist in apps/api/src/modules/teams/team-requests.controller.ts.
- Known BE gap (do NOT work around): TeamRequest has no requester name or similar-team list; show the requester as 'ผู้ขอ' without a name, and get similar teams from the existing suggest hook. Andy reports the gap to Kevin.

SOURCES:
- Design: docs/design/screens/S17-team-requests.md.
- `apps/web/lib/api/schema.d.ts`: `TeamRequest {id, name, requestedBy, status 'pending'|'created'|'aliased'|'rejected', teamId|null, createdAt}`; resolve body `{ action: 'create_team'|'alias_to_team'|'reject', teamId?, reason? }` (teamId required for alias_to_team) -> TeamRequest.
- `apps/web/features/teams/api.ts` (`useTeamSuggestions(query)` for similar teams, `useRequestTeam` pattern, `TeamRequest` type), `apps/web/features/teams/TeamCombobox.tsx`.
- Patterns: `features/results/ResultsQueue.tsx` (rows + confirm dialogs + ReasonDialog), `features/results/api.ts`, `thaiError` in `@/lib/errors`, committee page shape `apps/web/app/(app)/committee/events/[eventId]/results/page.tsx` (params Promise; this page has no params).

SPEC:
- Files (ONLY): `apps/web/features/teams/requestsApi.ts` (`useTeamRequests()` queryKey ['team-requests'] GET /team-requests; `useResolveTeamRequest()` mutate `{ requestId, action, teamId?, reason? }`, onSuccess invalidates ['team-requests'] and ['teams']), `apps/web/features/teams/TeamRequestsQueue.tsx`, `TeamRequestsQueue.test.tsx`, `apps/web/app/(app)/committee/teams/requests/page.tsx` (server component renders `<TeamRequestsQueue />`), `apps/web/features/events/TournamentList.tsx` is NOT touched; the entry link goes in `apps/web/app/(app)/committee/page.tsx` ONLY if it already lists links to committee areas (add 'คำขอทีม' there, `data-testid="committee-team-requests-link"`), otherwise report the missing entry point to andy.
- TeamRequestsQueue (no props). One row per request `data-testid="teamreq-row"`: name (bold), 'ขอเมื่อ {date}', 'ผู้ขอ', similar teams list `data-testid="teamreq-similar"` from `useTeamSuggestions(name)` (names; if none: 'ไม่พบทีมที่คล้ายกัน'). Buttons (min-h 44px, disabled while pending): `teamreq-create` 'สร้างทีมใหม่' (confirm dialog role=dialog 'สร้างทีม "{name}" ?'), `teamreq-alias` 'ผูกเป็นชื่อเรียกอื่น' (opens a dialog listing the similar teams as radio options; submit disabled until one is chosen; sends action alias_to_team with teamId; when similar teams exist this button is visually primary), `teamreq-reject` 'ปฏิเสธ' (ReasonDialog minLength 5).
- Errors: mutation errors show in the dialog via thaiError; a 409/404 conflict text from thaiError is fine ('ถูกดำเนินการแล้ว' if the code maps; otherwise generic).
- States: skeleton `data-testid="teamreq-loading"` role=status; error `data-testid="teamreq-error"` role=alert + 'ลองใหม่'; empty 'ไม่มีคำขอทีม'. Admin sees the list read-only: if the user's roles lack Committee hide the three buttons (use the existing roles helper/useMe pattern in ApproveConfirmDialog/EntryTable).

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; day theme tokens ONLY (grep -E 'bg-(white|blue|gray|red|green|orange|yellow)|text-(gray|blue|red|green|orange|yellow)|border-(gray|red)' must be empty); mobile-first (document.documentElement.scrollWidth == 390 at 390px); tap targets >= 44px; status never by colour alone; no direct fetch in components.

TOOLS: `pnpm --filter @blulens/web test TeamRequestsQueue` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "creates, aliases and rejects a request": 3 rows (or one row exercised three times); create -> confirm -> mutate {requestId, action:'create_team'}; alias -> choose a similar team -> mutate {action:'alias_to_team', teamId}; reject -> 4 chars keeps submit disabled, 5 enables -> mutate {action:'reject', reason}.
- Others: empty state; error with retry; no similar teams text; Admin (no Committee role) sees no action buttons.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items, pushed branch + SHA.
