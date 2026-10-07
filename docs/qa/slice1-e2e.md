# วิธีรัน Playwright smoke ของ Slice 1 (bl-21)

> Dwight (Lead QA) · ครอบคลุมเส้นทาง: login → สร้างทัวร์นาเมนต์ (wizard) → เปิดรับสมัคร → Admin สร้าง entry คู่ (type-ahead ทีม) → forward → Committee reject/approve → Member เห็นเฉพาะ entry ที่อนุมัติ
> ผลที่คาดหวัง: **UI 13/13** (`--project=chromium`, ไม่นับ 3 setup) + **API 15/15** (`--project=api`)

## 1. เตรียมครั้งแรก
```bash
cp .env.example .env            # ห้าม commit .env — ค่า SEED_* ใน .env.example เป็นค่า dev เท่านั้น
docker compose up -d            # postgres 5442 / redis 6389 / minio 9100
pnpm install --frozen-lockfile
pnpm --filter @blulens/shared build
pnpm db:deploy
SEED_DEMO=1 pnpm db:seed        # admin(Admin+Committee), committee@blulens.local, member1..6@blulens.local, ทีม Blue Wing/Red Phoenix/Green Valley
pnpm --filter @blulens/web exec playwright install chromium
```
ตัวแปรที่ต้องมีในสภาพแวดล้อมตอนรัน test (อ่านจาก `.env`, **ห้ามพิมพ์ค่าลง log/แชท**): `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_DEMO_PASSWORD`

## 2. เปิดเซิร์ฟเวอร์ (ต้องใช้พอร์ตของตัวเอง ห้าม restart API กลางที่ 3101)
กฎ Origin: ตั้งแต่ develop 76a2270 (bl-21-10) เมื่อ `NODE_ENV=development` (ค่าเริ่มต้นใน `.env.example`) API ยอมรับ origin `http://localhost:<พอร์ตใดก็ได้>` — ไม่ต้องตั้ง `WEB_URL` ต่อพอร์ตอีก (ถ้าไม่ใช่ dev ให้ตั้ง `WEB_URLS` เป็นรายการคั่นด้วยจุลภาค); web ต้อง rewrite `/api/*` ไป API ของตัวเอง (ค่า `API_URL` ถูกอ่านตอน start ของ Next) — รีสตาร์ท API หลัง pull

ตัวอย่าง (web 3190, api 3191):
```bash
# API
cd apps/api && API_PORT=3191 WEB_URL=http://localhost:3190 pnpm exec nest start
# เพิ่ม DISABLE_RATE_LIMIT=1 เมื่อรันวนหลายรอบ (ไม่งั้นโดน 429)
# Web
cd apps/web && API_URL=http://localhost:3191 pnpm exec next dev --port 3190
curl http://localhost:3190/api/v1/health      # ต้องได้ {"success":true,...}
```
Dev server ของ Next คอมไพล์ครั้งแรกช้า — เปิดหน้า `/login` และ `/events` ทิ้งไว้ก่อนรันครั้งแรก

## 3. คำสั่งรัน
```bash
export PLAYWRIGHT_BASE_URL=http://localhost:3190      # ค่า default ถ้าไม่ตั้ง = http://localhost:3190
set -a; . ./.env; set +a                              # โหลด SEED_* โดยไม่แสดงค่า
pnpm --filter @blulens/web test:e2e                   # = playwright test ทุก project (setup → chromium; api แยก)
# หรือแยก:
cd apps/web
pnpm exec playwright test --project=api               # ส่วน API  → 15 passed
pnpm exec playwright test --project=setup --project=chromium   # ส่วน UI → 13 passed (+3 setup)
```

## 4. หมายเหตุสำคัญ
- **Login rate limit 10/นาที**: ขั้น `setup` ล็อกอิน 3 บทบาท (admin, committee, member1) ครั้งเดียวแล้วเก็บ state ที่ `apps/web/e2e/.auth/*.json` (gitignored). ถ้าวนรันซ้ำให้ใช้ `DISABLE_RATE_LIMIT=1` ฝั่ง API หรือ `--no-deps` (ใช้ state เดิม; access token อายุ 15 นาที — หมดแล้วต้องรัน setup ใหม่)
- แต่ละรอบสร้างทัวร์นาเมนต์ใหม่ (startsOn 2099-01-01 เพื่อให้อยู่หน้าแรกของรายการ) บน DB เดียวกัน — ไม่ลบข้อมูลเก่า; อย่า reset DB ที่ใช้ร่วมกัน
- Step ของ wizard และ publish ต้องผ่านจริง (ห้าม bypass); test จะ **fail** ถ้าหา id จาก response ไม่เจอ ไม่มี fallback เงียบ
- ผล Committee: หลัง reject/approve แถวหายจากคิว (คิวแสดงเฉพาะ `pending_committee`) — ยืนยันสถานะจริงด้วย step API cross-check
- รายงานผลแดงให้ระบุ: step, ข้อความ assertion, URL, และ response ของ API (console/network)

## 5. Mutation ที่ใช้พิสูจน์ว่า test จับได้ (ทำมือ ห้าม commit)
| การแก้ | step ที่ต้องแดง |
|---|---|
| เปลี่ยน testid `entry-forward` เป็นค่าผิดใน `e2e/selectors.ts` | Step 6 (forward) |
| ถอดตัวกรอง “Member เห็นเฉพาะ approved” ใน `entries.service.ts` | Step 10 (มุมมอง Member) |
| ให้ approve คืน 500 / ปิด API | Step 8 (approve) |

## 6. ห้ามรันบน DB เดโมที่ใช้ร่วมกัน — ใช้ DB แยกของ e2e (ตัดสินใจโดย god)
การรัน e2e ทุกรอบสร้างทัวร์นาเมนต์/entry ใหม่ จึงทำให้หน้า `/events` ของเดโมรก (Pam review #12-13) — ให้ใช้ฐานข้อมูลแยกชื่อ `blulens_e2e`:
```bash
docker exec blulens-postgres psql -U blulens -d postgres -c "CREATE DATABASE blulens_e2e OWNER blulens_app;"   # ครั้งแรก — ต้อง OWNER blulens_app ไม่งั้น migrate ขึ้น 'permission denied for schema public'
export DATABASE_URL="postgresql://<user>:<pass>@localhost:5442/blulens_e2e?schema=public"   # ใช้ user/pass จาก .env (อย่าพิมพ์ค่า)
pnpm db:deploy && SEED_DEMO=1 pnpm db:seed      # ก่อน start API ของ e2e (ตัวแปรนี้ใช้กับ API process ของ e2e เท่านั้น)
```
ถ้าจำเป็นต้องรันบน DB ร่วม ให้ล้างหลังรันด้วย `docs/qa/cleanup-qa-data.sql` (dry-run ก่อนด้วย `-v apply=0`, ลบจริง `-v apply=1`): ลบเฉพาะทัวร์นาเมนต์ชื่อ `QA Tourney %`, `Diag %`, `API Test Tournament %`, `Test Tournament` ที่ไม่มี assessment/draw/match ผูกอยู่ ไม่แตะ audit_log/users/teams

## 7. ข้อกำหนดที่เจ้าของตัดสินแล้ว
- เหตุผล reject ต้องยาว **อย่างน้อย 10 ตัวอักษร** (Jim; มี DB CHECK แล้ว): ปุ่ม submit ใน dialog ปิดจนกว่าจะครบ 10; ขอบที่ต้องทดสอบคือ 9 ตัว = ปิด, 10 ตัว = เปิด; API คืน 400 สำหรับ < 10

## 8. ผังฐานข้อมูลสุดท้าย (ตัดสินโดย god) — **ห้ามชี้ e2e มาที่ `blulens_demo` เด็ดขาด**
| ใช้ทำอะไร | DB | หมายเหตุ |
|---|---|---|
| เดโมของเจ้าของ | `blulens_demo` (ใหม่; `.env.example` ตั้งเป็นค่าเริ่มต้น, card bl-26) | ข้อมูลเก่าใน DB `blulens` ไม่ถูกลบ |
| API jest | `<DB ใน DATABASE_URL>_test` (override ด้วย `TEST_DATABASE_URL`) เช่น `blulens_demo_test` | สร้าง/migrate/seed (admin + rubric) อัตโนมัติ (bl-21-9) |
| Playwright e2e | `blulens_e2e` (seed ด้วย `SEED_DEMO=1`) | ตามข้อ 6 |
ก่อนรัน e2e ให้ตรวจ `DATABASE_URL` ของ API process ที่ใช้: ต้องลงท้าย `/blulens_e2e` เท่านั้น

## 9. หมายเหตุ UI ที่ test ต้องรู้
- กด Approve ใน Committee queue จะเปิด dialog ยืนยัน (`approve-confirm` / `approve-cancel`, bl-26-3) — test ต้องกดยืนยันก่อนรอ POST `/approve`
- Approve ของ entry ที่เกรดนอกช่วงใช้ dialog เหตุผล ≥ 20 ตัวอักษร
