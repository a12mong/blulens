# PACKET bl-08-3: Providers (QueryClient) (Ryan, after bl-08-2)

GOAL: One TanStack QueryClient provider with the app-wide defaults, wired into the root layout.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout D:/_work/SourceDev/_code/blulens. Create your own worktree: `git worktree add D:/_work/SourceDev/_code/blulens-<yourname> -b <branch> origin/andy/bl-08-tooling`, run `pnpm install` there, and work only there.
- BASE: branch `dev/bl-08-query-provider` from `origin/andy/bl-08-tooling` after bl-08-2 is merged to develop (rebase on develop then). Never commit to main/develop.
- Depends on: bl-08-2 (uses ApiRequestError from `apps/web/lib/api/client.ts`).

SOURCES: docs/frontend/architecture-notes.md section 3.

SPEC:
- Files (ONLY these): `apps/web/app/providers.tsx`, `apps/web/app/providers.test.tsx`, `apps/web/app/layout.tsx` (wrap `{children}` in `<Providers>`; nothing else changes).
- providers.tsx: `'use client'`; `export function makeQueryClient(): QueryClient`; `export function Providers({ children })` creating the client once with useState.
- Defaults: staleTime 30_000; refetchOnWindowFocus true; `retry: (count, err) => count < 1 && !(err instanceof ApiRequestError && [401, 403, 404].includes(err.status))`.

CONSTRAINTS: only the listed files; no devtools dependency; no new dependencies.

TOOLS: `pnpm --filter @blulens/web test providers` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "provides a QueryClient with 30s staleTime and no retry on 403": render `<Providers>` with a child using useQueryClient(), assert `getDefaultOptions().queries.staleTime === 30000`; call the retry fn with (0, ApiRequestError status 403) => false, and with (0, new Error('x')) => true.
- Report to andy-muxsqkra (act=done): paths changed, exact commands with real pass counts, unverified, open items.
