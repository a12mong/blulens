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
