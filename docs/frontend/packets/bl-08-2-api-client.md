# PACKET bl-08-2: apiFetch client (Ryan)

GOAL: One typed fetch wrapper all features use to call the API: same-origin /api/v1, cookies, envelope unwrap, typed errors, one automatic refresh-and-retry on 401.

STATE:
- BASE: create branch `dev/bl-08-api-client` from `origin/andy/bl-08-tooling`. Work in your own worktree. Never commit to main/develop.
- Run commands via `pnpm --filter @blulens/web <script>`.
- Depends on: none.

SOURCES:
- docs/specs/architecture.md section 6.1-6.2 (Thai).
- Envelope: success `{ success: true, data }`; failure `{ success: false, error: { code: 'UPPER_SNAKE', message: <Thai>, details?: { fieldErrors? } } }`. 204 responses have no body.
- Refresh = `POST /api/v1/auth/refresh` (204 on success; server rotates cookies).
- Types ApiSuccess / ApiError / CursorPage exist in packages/shared (`import type {...} from '@blulens/shared'`).

SPEC:
- Files (ONLY these): `apps/web/lib/api/client.ts`, `apps/web/lib/api/client.test.ts`
- Export `class ApiRequestError extends Error { status: number; code: string; details?: unknown }` (message = server Thai message).
- Export `function setSessionExpiredHandler(fn: () => void): void`.
- Export `async function apiFetch<T>(path: string, init?: { method?: string; body?: unknown; query?: Record<string, string | number | undefined>; signal?: AbortSignal }): Promise<T>`.
- Behaviour: URL = '/api/v1' + path (+ query string, skipping undefined); `credentials: 'same-origin'`; if body is set send JSON with Content-Type application/json; 204 -> resolve undefined; success envelope -> resolve data; error envelope -> throw ApiRequestError(status, code, message, details); non-JSON or network failure -> throw ApiRequestError with code 'NETWORK_ERROR' (status 0).
- On HTTP 401 for any path except '/auth/refresh' and '/auth/login': call POST /auth/refresh once (share one in-flight promise so concurrent 401s refresh once); if refresh ok retry the original request once; if refresh fails call the session-expired handler and throw the original 401 error.

CONSTRAINTS: only the 2 files; no new dependencies; no `any` (use unknown); use global fetch; never read cookies in JS.

TOOLS: `pnpm --filter @blulens/web test client` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "refreshes once and retries on 401": stub global fetch (vi.stubGlobal) so call 1 returns 401 error envelope, call 2 (/auth/refresh) returns 204, call 3 returns success envelope `{ success: true, data: { ok: 1 } }` => apiFetch resolves `{ ok: 1 }`, fetch called exactly 3 times, second call URL is '/api/v1/auth/refresh'.
- Other tests in the same file: error envelope -> ApiRequestError with code; 204 -> undefined; refresh failure -> handler called once and original error thrown.
- Report to andy-muxsqkra (act=done): paths changed, exact commands with real pass counts, unverified, open items.
