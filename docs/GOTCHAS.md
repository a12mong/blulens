# GOTCHAS — สิ่งที่สะดุดบ่อย (เพิ่มต่อท้ายได้ทุกคน)

## Web: Next.js เตือน "inferred your workspace root"
- อาการ: `pnpm dev` ของ `apps/web` เตือนว่า Next เดา workspace root เอง และแนะนำให้ตั้ง `outputFileTracingRoot`
- สาเหตุ: เครื่อง dev มี lockfile อื่นอยู่ในโฟลเดอร์แม่ Next จึงไม่แน่ใจว่า root ของ monorepo อยู่ไหน
- ผลกระทบตอนนี้: ไม่มี (dev ทำงานปกติ) แต่มีผลกับ standalone build ใน Docker ถ้าเดาผิด
- จะแก้ภายหลัง: ตั้ง `outputFileTracingRoot: path.join(__dirname, '../../')` ใน `apps/web/next.config.ts` (บันทึกโดย Kevin, bl-01)

## Web: `API_URL` เป็นค่าตอน build
- `rewrites()` ถูกฝังตอน `next build` — ตั้ง `API_URL` ตอน runtime ของ container ไม่มีผล (ดู README หัวข้อ API_URL)

## Windows / Git Bash
- `docker run -v` ใน Git Bash: ใช้ `MSYS_NO_PATHCONV=1` และ `$(pwd -W)` ไม่งั้น path ใน container ถูกแปลงเป็น `C:/Program Files/Git/...`
- heredoc ของ bash อาจกิน backslash ใน JSON (เช่น regex `\.` ใน jest config) — คัดลอกไฟล์ต้นฉบับแทนการพิมพ์ใหม่

## API e2e: env in Jest
- `process.loadEnvFile` inside a Jest setup file does not reach the test (Jest gives each test file its own copy of `process.env`). `apps/api/test/setup-env.ts` parses the root `.env` with `util.parseEnv` and assigns into `process.env` instead.
- e2e tests need the shared package built once in a fresh worktree: `pnpm --filter @blulens/shared build`.

## Web (เครื่อง dev นี้): `next build` ล้มด้วย `<Html> should not be imported outside of pages/_document`
- สาเหตุ: เครื่องตั้ง `NODE_ENV` เป็นค่าไม่มาตรฐาน — รันแบบ `NODE_ENV=production pnpm --filter @blulens/web build`
- `pnpm --filter @blulens/web typecheck` ต้อง `pnpm --filter @blulens/shared build` ก่อน (ไม่งั้นหา `@blulens/shared` ไม่เจอ)
- พอร์ต 3100 อาจถูกใช้อยู่ (เจ้าของรัน `pnpm dev`) — Dev ควรรัน dev server ของตัวเองที่พอร์ต 3190 (`next dev --port 3190`) แล้วปิดด้วย PID ของตัวเองเท่านั้น (บันทึกโดย Andy, bl-08)
## Windows: pnpm scripts run in cmd.exe
- No `>/dev/null`. In cmd `a || b && c` means `a || (b && c)`, so write `(a || b) && c` explicitly (same meaning in sh).
- **provenMinimal false claim (draw solver, merged bl-18-4):** when the search exhausts its node limit and falls back to first-fit, the result still says provenMinimal=true; draw.md §4 step 4 requires 'best found, not proven'. Owner of the fix: Kevin via bl-18-4b. Do not show 'minimum possible' in the UI until it is fixed.

- **Green jest does NOT mean the API boots (P0, 2026-10-07):** develop `9c06ee8` passed every jest suite, but `nest start` failed with TS7006 (an untyped CORS origin callback) in `apps/api/src/main.ts`, because no jest test ever imports/compiles `main.ts`. Dwight caught it running the e2e gate. The merge gate for apps/api MUST run `pnpm --filter @blulens/api build` (nest build) and smoke `GET /api/v1/health` on the built output; add `tsc --noEmit` for api and web once the seed.ts types are clean. Fixed in 865b6ba.
- **Demo seed rules (`SEED_DEMO=1 pnpm db:seed`, 2026-10-08):** the owner re-seeds `blulens_demo`, which already holds their data, so every seed step must be ADDITIVE (create only; no deletes, no migrations that need a fresh DB) and IDEMPOTENT (a marker row makes the second run log `exists` and create nothing). There is ONE approved exception (god, bl-25-13): the demo MD event's `events.format` is filled ONLY when it is NULL, so the groups page works after a re-seed. Never widen this into an overwrite: a non-null format may be the owner's own setting. Check new seed steps on a NEW scratch DB with `prisma migrate deploy` and two seed runs; never `prisma migrate reset`.
- **API e2e suite needs a FRESH test DB per run (floor rule, 2026-10-08):** `assessment_results`, `assessment_transitions`, `audit_logs` and `group_standings` are append-only (DB triggers), so test fixtures that touch them can never be cleaned up. On a shared `blulens_test` they pile up run after run until `GET /rater-stats` exceeds the 30 s jest timeout and list assertions fall off the first page (bl-30-1). Always run `cd apps/api && TEST_DATABASE_URL=<DATABASE_URL with the db name changed to a new *_test name> pnpm test` (global-setup runs `prisma migrate deploy`, which creates it). The merge gate does this on every run. Tests must also assert only on their own fixture ids, never on global counts or order.
- **provenMinimal false claim: FIXED** (bl-18-4b, test DR-14, f321fc7); the UI may show 'minimum possible' again.

## API e2e needs MinIO (bl-36-1, 2026-10-08)
- `test/storage.e2e-spec.ts` and every clip upload suite PUT real bytes to MinIO. Run `docker compose up -d minio`
  before `pnpm test`. Tests use the bucket `<S3_BUCKET>-test` (set in `test/setup-env.ts`, created on first use),
  never the dev `clips` bucket.
- Presigned PUT signs `Content-Type`: the browser must send exactly the type it declared to upload-url, or MinIO
  answers 403.
- Clip `objectKey` starting with `/` or `http(s)` is a seeded external file (demo sample clip) and is passed through
  as the viewUrl; every other key is a bucket key and gets a 15-min presigned GET.
