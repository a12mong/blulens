# PACKET bl-08-4: Next middleware first-pass (Phyllis)

GOAL: Redirect visitors without a session marker cookie to /login, and logged-in visitors away from /login. API stays authoritative; this is UX only.

STATE:
- BASE: branch `dev/bl-08-middleware` from `origin/andy/bl-08-tooling`. Own worktree. Never commit to main/develop.
- Depends on: none.

SOURCES:
- docs/specs/architecture.md section 6.2: cookie `bl_session` = non-secret marker; `bl_access`/`bl_refresh` are httpOnly and never read here.
- Pattern to copy: D:\_work\SourceDev\_code\kpaccv2\apps\web\middleware.ts (read-only).

SPEC:
- Files (ONLY these): `apps/web/middleware.ts`, `apps/web/middleware.test.ts`
- Export `middleware(req: NextRequest)` and `config.matcher` that excludes /api, /_next/static, /_next/image, favicon.ico and static image files.
- Protected prefixes: '/me', '/review', '/committee', '/admin'. Every other path is public ('/', '/login', '/register', '/tournaments', '/403').
- Rules: protected prefix + no bl_session cookie -> redirect to `/login?next=<original pathname>`; '/login' or '/register' + has bl_session -> redirect to '/me'; otherwise NextResponse.next().

CONSTRAINTS: only these files; no role logic here (roles are checked in layouts); no new dependencies.

TOOLS: `pnpm --filter @blulens/web test middleware` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "redirects /committee to /login?next=/committee without bl_session": `new NextRequest('http://localhost:3100/committee')`, call middleware, assert status 307 and the location header ends with `/login?next=%2Fcommittee`.
- Others: with cookie bl_session=1, /committee passes (no redirect); /login with cookie redirects to /me; /tournaments without cookie passes.
- Report to andy-muxsqkra (act=done): paths changed, exact commands with real pass counts, unverified, open items.
