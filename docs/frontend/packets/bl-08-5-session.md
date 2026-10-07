# PACKET bl-08-5: session hooks (Phyllis, after bl-08-2 and bl-08-3)

GOAL: React hooks for the current user: useMe, useLogin, useLogout, using apiFetch and TanStack Query.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout D:/_work/SourceDev/_code/blulens. Create your own worktree: `git worktree add D:/_work/SourceDev/_code/blulens-<yourname> -b <branch> origin/andy/bl-08-tooling`, run `pnpm install` there, and work only there.
- BASE: branch `dev/bl-08-session` from develop once bl-08-2 and bl-08-3 are merged. Never commit to main/develop.
- Depends on: bl-08-2 (apiFetch), bl-08-3 (Providers).

SOURCES:
- docs/api/openapi.yaml paths: `/auth/me` (GET -> Me), `/auth/login` (POST body {identifier, password} -> Me), `/auth/logout` (POST -> 204).
- Types: `import type { components } from '@/lib/api/schema'` then `type Me = components['schemas']['Me']`.

SPEC:
- Files (ONLY these): `apps/web/features/auth/api.ts`, `apps/web/features/auth/api.test.tsx`
- `export const meKey = ['auth', 'me'] as const`
- `useMe()` = useQuery(meKey) calling `apiFetch<Me>('/auth/me')`, staleTime 5 min, retry false. A 401 means "guest": catch ApiRequestError status 401 and return null (data null, no throw to UI).
- `useLogin()` = useMutation POST '/auth/login' with the body; onSuccess `setQueryData(meKey, me)`.
- `useLogout()` = useMutation POST '/auth/logout'; onSuccess `queryClient.clear()`.

CONSTRAINTS: only these files; no direct fetch (apiFetch only); no `any`; no new dependencies.

TOOLS: `pnpm --filter @blulens/web test auth` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "login stores the user under ['auth','me']": mock '@/lib/api/client' so apiFetch resolves a Me object; render the hook inside a QueryClientProvider; mutate useLogin with {identifier:'a', password:'b'}; assert `queryClient.getQueryData(['auth','me'])` equals the object and apiFetch was called with '/auth/login' and method 'POST'.
- Other test: useMe with apiFetch rejecting ApiRequestError status 401 -> data is null and no error surfaced.
- Report to andy-muxsqkra (act=done): paths changed, exact commands with real pass counts, unverified, open items.
