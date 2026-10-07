PACKET bl-21-10: Origin guard accepts several web origins (WEB_URLS) and, in development only, any http://localhost:<port>

Assignee: Angela (angela-muxswccx) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp) · tell: Dwight (dwight-muxsq5jb)

GOAL:
  Reviewers and testers run their own web servers on their own ports and hit 403 ORIGIN_FORBIDDEN, because the API
  accepts exactly one origin (WEB_URL). Allow a comma list of origins, plus any localhost port in development.
  Production behaviour stays exactly the same.

STATE:
  Your worktree. Branch dev/bl-21-dev-origins from origin/develop (30888c2 or later).
  Already exists:
    apps/api/src/common/auth/origin.guard.ts: OriginGuard. Mutating method (POST/PUT/PATCH/DELETE) + Origin header
      present + origin !== new URL(WEB_URL ?? 'http://localhost:3100').origin -> 403 ORIGIN_FORBIDDEN. Requests without
      an Origin header are allowed (unchanged).
    apps/api/src/main.ts: app.enableCors({ origin: process.env.WEB_URL ?? 'http://localhost:3100', credentials: true }).
    apps/api/test/auth.e2e-spec.ts: existing ORIGIN_FORBIDDEN test (foreign origin 403, WEB_URL origin allowed). Keep it green.
    .env.example: WEB_URL="http://localhost:3100"; there is no NODE_ENV line yet.

SPEC:
  Files (ONLY these 5):
  1. apps/api/src/common/auth/allowed-origins.ts (new), pure functions, no Nest imports:
       export function allowedOrigins(env: NodeJS.ProcessEnv | Record<string, string | undefined>): string[]
         - env.WEB_URLS (comma separated, trim each, skip empty) if set and non-empty, else [env.WEB_URL ?? 'http://localhost:3100'];
           map each through new URL(x).origin (normalises trailing slash and path); throw on an invalid URL (fail at boot).
       export function isAllowedOrigin(origin: string, allowed: string[], nodeEnv: string | undefined): boolean
         - true if allowed.includes(origin)
         - else, ONLY when nodeEnv === 'development': true if new URL(origin) has protocol 'http:' and hostname
           'localhost' or '127.0.0.1' (any port). Anything else, or an unparsable origin, -> false.
  2. origin.guard.ts: in the constructor compute this.allowed = allowedOrigins({ WEB_URLS: config.get('WEB_URLS'),
     WEB_URL: config.get('WEB_URL') }) and this.nodeEnv = config.get('NODE_ENV'). In canActivate, replace
     `origin === this.allowed` with isAllowedOrigin(origin, this.allowed, this.nodeEnv). Update the doc comment.
  3. main.ts: enableCors({ origin: (origin, cb) => cb(null, !origin || isAllowedOrigin(origin, allowedOrigins(process.env),
     process.env.NODE_ENV)), credentials: true }). Compute allowedOrigins(process.env) once, before enableCors.
  4. .env.example, next to WEB_URL, add (comments in Thai like the rest of the file):
       # หลาย origin คั่นด้วยจุลภาค (ถ้าตั้ง จะใช้แทน WEB_URL) เช่น "http://localhost:3100,http://localhost:3190"
       # WEB_URLS=""
       # development: ยอมรับ http://localhost:<พอร์ตใดก็ได้> เพิ่มเติม; production ต้องเป็น production (ใช้แค่ WEB_URL/WEB_URLS)
       NODE_ENV="development"
  5. apps/api/test/origin.e2e-spec.ts (new), the test that proves it:
     - allowedOrigins({ WEB_URLS: ' http://localhost:3100/ , http://localhost:3190 ' }) -> ['http://localhost:3100', 'http://localhost:3190']
     - allowedOrigins({ WEB_URL: 'https://blulens.example/app' }) -> ['https://blulens.example']; allowedOrigins({}) -> ['http://localhost:3100']
     - allowedOrigins({ WEB_URLS: 'not a url' }) throws
     - isAllowedOrigin('http://localhost:3190', ['http://localhost:3100'], 'development') === true
     - the same with 'production' and with undefined === false (production unchanged)
     - in 'development': 'https://localhost:3190' false, 'http://localhost.evil.com' false, 'http://192.168.1.5:3100' false,
       'null' false
     - one HTTP check: build the app with process.env.WEB_URLS = 'http://localhost:3100,http://localhost:3190' and
       process.env.NODE_ENV = 'production', set BEFORE Test.createTestingModule; then POST /api/v1/auth/login with
       Origin http://localhost:3190 is NOT 403 ORIGIN_FORBIDDEN (expect 401 with wrong credentials), and Origin
       http://localhost:3555 IS 403 ORIGIN_FORBIDDEN. Restore both env vars in afterAll.

CONSTRAINTS:
  - Production (NODE_ENV not 'development') must accept only the configured origins, exactly as today.
  - No other files. No new dependencies. Never print .env values.

TOOLS:
  pnpm --filter @blulens/shared build; cd apps/api && pnpm test   (all suites green, including auth.e2e-spec.ts)

DONE:
  Push branch dev/bl-21-dev-origins to origin (`git push -u origin dev/bl-21-dev-origins`), one commit.
  Done message to Kevin: commit sha, the test command + result line, and the files changed.
