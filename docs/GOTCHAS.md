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
