# Slice 3 — กรรมการสนามบันทึกผลแมตช์ (PUT /matches/{id}/result)

> Dwight (Lead QA) & Kelly · ไฟล์ test: `apps/web/e2e/slice3-umpire.api.spec.ts` (project `api`) + `apps/web/e2e/slice3-umpire.spec.ts` (project `chromium`)
> ผลที่คาดหวัง: **API 5/5 + UI 4/4 ผ่านทั้งหมด (9 passed)** บน seeded `umpire1@blulens.local` (develop `1d1320e`, Kevin `bl-25-6`)

---

## 1. การครอบคลุมระดับ API (`slice3-umpire.api.spec.ts`)
ข้อมูล: seed เดโม (`SEED_DEMO=1`) สร้างผู้ใช้ `umpire1@blulens.local` (role `Umpire`), กำหนด `event_umpires` ในทัวร์นาเมนต์เดโม (`ศึกลูกขนไก่ชิงถ้วยประธานชมรม ครั้งที่ 3`), และมี 3 แมตช์รอบแบ่งกลุ่ม (confirmed / reported / scheduled) รูปแบบ 2 เกม แต้มเต็ม 15 ไม่มี deuce. test โคลนแมตช์ `scheduled` ด้วย SQL ทุกรอบ (บน `blulens_e2e` เท่านั้น) จึงรันซ้ำได้อย่างปลอดภัยและเป็นอิสระต่อกัน.

| Step | สิ่งที่ตรวจ |
|---|---|
| U1 | umpire1 (Umpire + `event_umpires` จาก seed) ส่งผล 15-11, 15-9 → 200, `status=reported`, `result=a_win`, มี audit `match.result.report`, อยู่ใน `GET /events/{id}/matches` |
| U2 | คะแนนไม่ถูกต้อง 3 แบบ (เกมแรกไม่จบ · 15-15 ไม่มี deuce · เกมไม่ครบ) → 422 `MATCH_SCORE_INVALID`, แมตช์ยัง `scheduled` |
| U3 | ผู้เล่นในแมตช์ที่มีบทบาท Umpire → 403 `UMPIRE_OWN_MATCH` |
| U4 | Umpire ที่ไม่ได้ถูกมอบหมาย (`umpire2@blulens.local` ไม่มี `event_umpires`) → 403 `UMPIRE_NOT_ASSIGNED` |
| U5 | Member ธรรมดา → 403 (role guard) |

---

## 2. การครอบคลุมระดับ UI (`slice3-umpire.spec.ts`)
ทดสอบ workflow ของผู้ตัดสินสนามบน Web UI (`apps/web/features/umpire/*`):

| Step | สิ่งที่ตรวจ |
|---|---|
| UI-1 | umpire1 เปิดหน้า `/umpire` เห็นการ์ดแมตช์ (`umpire-match`) สถานะ `'รอกรอกผล'` (`umpire-match-status`) พร้อมปุ่ม action `'กรอกผล'` (`umpire-match-action`) คลิกแล้วนำทางไปที่ `/umpire/matches/[id]` ถูกต้อง |
| UI-2 | หน้ารายงานผล: แสดง stepper แต่ละเกม (`game-stepper`, `score-a`, `score-b`), กรอกคะแนนถูกต้อง 15-11, 15-9 → แสดงสรุปผล (`result-summary`) และปุ่มรายงานผล (`result-submit`) เปิดใช้งาน → กดส่ง → ยืนยันใน dialog (`result-confirm`) → PUT คืน 200 และสถานะในฐานข้อมูลเปลี่ยนเป็น `reported` |
| UI-3 | ตรวจสอบการตรวจสอบคะแนน: (a) แต้มไม่ครบ 15 แต้ม แสดง `'ยังไม่ครบ 15 แต้ม'` ใน `game-error` และปุ่มส่งปิด; (b) แต้มเสมอ 15-15 แสดง `'ผลเสมอไม่ได้'` ใน `game-error` และปุ่มส่งปิด; (c) เมื่อเซิร์ฟเวอร์ส่งกลับ 422 `MATCH_SCORE_INVALID` หน้าเว็บแสดงข้อความภาษาไทย `'คะแนนไม่ถูกต้องตามกติกา'` ใน `result-error` และแมตช์ยังคง `scheduled` |
| UI-4 | บล็อกการตัดสินแมตช์ที่ตนเองลงแข่ง (`UMPIRE_OWN_MATCH`): (a) บัญชีผู้เล่นที่มีบทบาท Umpire เปิด `/umpire/matches/[id]` ของแมตช์ตนเอง จะถูกปฏิเสธด้วย `umpire-match-missing` ('ไม่พบแมตช์นี้ หรือคุณไม่มีสิทธิ์'); (b) หากมีการพยายามส่งผลแมตช์ตนเอง API จะปฏิเสธ 403 `UMPIRE_OWN_MATCH` และแบบฟอร์มแสดงข้อความไทย `'ห้ามกรอกผลแมตช์ที่ตนเองเป็นผู้เล่น'` ใน `result-error` |

---

## 3. สรุปการปรับปรุง SQL Provisioning (Packet develop `1d1320e`)
- **SQL ที่ถอดออก:** ถอดคำสั่ง SQL ใน `beforeAll` ที่สร้างผู้ใช้ `umpire1@blulens.local`, บทบาท `Umpire`, และแถว `event_umpires` ใน `slice3-umpire.api.spec.ts`, `slice3-umpire.spec.ts`, และ `slice3-results.spec.ts` ออกทั้งหมด เนื่องจาก `apps/api/prisma/seed.ts` (`SEED_DEMO=1`, `bl-25-6`) มีข้อมูลเหล่านี้อยู่แล้ว
- **SQL ที่คงไว้:**
  1. การโคลนแมตช์ `scheduled` ต่อรอบการรัน (`cloneMatch()`) จากทัวร์นาเมนต์เดโมหลัก (`ศึกลูกขนไก่ชิงถ้วยประธานชมรม ครั้งที่ 3`) เพื่อให้การทดสอบเป็น idempotent
  2. การสร้าง `umpire2@blulens.local` (เฉพาะบทบาท Umpire ไม่มี `event_umpires`) ใน `slice3-umpire.api.spec.ts` เพื่อใช้ทดสอบกรณี U4 (`UMPIRE_NOT_ASSIGNED`)
  3. การให้บทบาท Umpire ชั่วคราวแก่ผู้เล่นของแมตช์เพื่อใช้ทดสอบกรณี U3 / UI-4 (`UMPIRE_OWN_MATCH`) และลบออกใน `afterAll`

---

## 4. คำสั่งรัน
รันบนพอร์ตของตนเอง (เช่น API 3391, Web 3390), DB `blulens_e2e`, ตั้ง `DISABLE_RATE_LIMIT=1` และ `WEB_URL=<origin web>`:

```bash
# เตรียมฐานข้อมูล (รันครั้งแรกหรือหลัง migrate)
DATABASE_URL="postgresql://blulens_app:blulens_app@localhost:5442/blulens_e2e?schema=public" SEED_DEMO=1 pnpm db:seed

# เทอร์มินัล 1 (API)
cd apps/api
API_PORT=3391 DATABASE_URL="postgresql://blulens_app:blulens_app@localhost:5442/blulens_e2e?schema=public" WEB_URL="http://localhost:3390" DISABLE_RATE_LIMIT=1 NODE_ENV=development node dist/main.js

# เทอร์มินัล 2 (Web)
cd apps/web
API_URL=http://localhost:3391 pnpm exec next dev --port 3390

# เทอร์มินัล 3 (Playwright Suite)
export PLAYWRIGHT_BASE_URL=http://localhost:3390
export API_URL=http://localhost:3391
pnpm --filter @blulens/web exec playwright test --project=api --project=chromium --no-deps e2e/slice3-umpire*
```

---

## 5. ผลการรัน 3 รอบติดต่อกันบน Develop Head (3x Green Runs)

### Run 1:
```text
Running 9 tests using 1 worker

  ok 1 [api] › e2e\slice3-umpire.api.spec.ts:99:7 › slice 3 umpire: PUT /matches/{id}/result (API) › U1 assigned umpire enters a valid score -> 200, status reported, games stored (666ms)
  ok 2 [api] › e2e\slice3-umpire.api.spec.ts:109:7 › slice 3 umpire: PUT /matches/{id}/result (API) › U2 invalid score -> 422 MATCH_SCORE_INVALID, match unchanged (354ms)
  ok 3 [api] › e2e\slice3-umpire.api.spec.ts:122:7 › slice 3 umpire: PUT /matches/{id}/result (API) › U3 umpire who plays in the match -> 403 UMPIRE_OWN_MATCH (272ms)
  ok 4 [api] › e2e\slice3-umpire.api.spec.ts:129:7 › slice 3 umpire: PUT /matches/{id}/result (API) › U4 umpire not assigned to the event/court -> 403 UMPIRE_NOT_ASSIGNED (328ms)
  ok 5 [api] › e2e\slice3-umpire.api.spec.ts:136:7 › slice 3 umpire: PUT /matches/{id}/result (API) › U5 a plain member cannot report (role guard) (212ms)
  ok 6 [chromium] › e2e\slice3-umpire.spec.ts:100:7 › slice 3 umpire: UI workflow › UI-1: umpire sees match in /umpire list and navigates to scoring page (2.1s)
  ok 7 [chromium] › e2e\slice3-umpire.spec.ts:124:7 › slice 3 umpire: UI workflow › UI-2: stepper enters valid score 15-11, 15-9 -> result-reported (1.5s)
  ok 8 [chromium] › e2e\slice3-umpire.spec.ts:167:7 › slice 3 umpire: UI workflow › UI-3: invalid score shows Thai MATCH_SCORE_INVALID text in result-error (1.7s)
  ok 9 [chromium] › e2e\slice3-umpire.spec.ts:227:7 › slice 3 umpire: UI workflow › UI-4: own-match is blocked (UMPIRE_OWN_MATCH) (4.8s)

  9 passed (25.4s)
```

### Run 2:
```text
Running 9 tests using 1 worker

  ok 1 [api] › e2e\slice3-umpire.api.spec.ts:99:7 › slice 3 umpire: PUT /matches/{id}/result (API) › U1 assigned umpire enters a valid score -> 200, status reported, games stored (782ms)
  ok 2 [api] › e2e\slice3-umpire.api.spec.ts:109:7 › slice 3 umpire: PUT /matches/{id}/result (API) › U2 invalid score -> 422 MATCH_SCORE_INVALID, match unchanged (380ms)
  ok 3 [api] › e2e\slice3-umpire.api.spec.ts:122:7 › slice 3 umpire: PUT /matches/{id}/result (API) › U3 umpire who plays in the match -> 403 UMPIRE_OWN_MATCH (295ms)
  ok 4 [api] › e2e\slice3-umpire.api.spec.ts:129:7 › slice 3 umpire: PUT /matches/{id}/result (API) › U4 umpire not assigned to the event/court -> 403 UMPIRE_NOT_ASSIGNED (395ms)
  ok 5 [api] › e2e\slice3-umpire.api.spec.ts:136:7 › slice 3 umpire: PUT /matches/{id}/result (API) › U5 a plain member cannot report (role guard) (267ms)
  ok 6 [chromium] › e2e\slice3-umpire.spec.ts:100:7 › slice 3 umpire: UI workflow › UI-1: umpire sees match in /umpire list and navigates to scoring page (2.9s)
  ok 7 [chromium] › e2e\slice3-umpire.spec.ts:124:7 › slice 3 umpire: UI workflow › UI-2: stepper enters valid score 15-11, 15-9 -> result-reported (2.4s)
  ok 8 [chromium] › e2e\slice3-umpire.spec.ts:167:7 › slice 3 umpire: UI workflow › UI-3: invalid score shows Thai MATCH_SCORE_INVALID text in result-error (4.6s)
  ok 9 [chromium] › e2e\slice3-umpire.spec.ts:227:7 › slice 3 umpire: UI workflow › UI-4: own-match is blocked (UMPIRE_OWN_MATCH) (9.9s)

  9 passed (1.0m)
```

### Run 3:
```text
Running 9 tests using 1 worker

  ok 1 [api] › e2e\slice3-umpire.api.spec.ts:99:7 › slice 3 umpire: PUT /matches/{id}/result (API) › U1 assigned umpire enters a valid score -> 200, status reported, games stored (740ms)
  ok 2 [api] › e2e\slice3-umpire.api.spec.ts:109:7 › slice 3 umpire: PUT /matches/{id}/result (API) › U2 invalid score -> 422 MATCH_SCORE_INVALID, match unchanged (578ms)
  ok 3 [api] › e2e\slice3-umpire.api.spec.ts:122:7 › slice 3 umpire: PUT /matches/{id}/result (API) › U3 umpire who plays in the match -> 403 UMPIRE_OWN_MATCH (545ms)
  ok 4 [api] › e2e\slice3-umpire.api.spec.ts:129:7 › slice 3 umpire: PUT /matches/{id}/result (API) › U4 umpire not assigned to the event/court -> 403 UMPIRE_NOT_ASSIGNED (393ms)
  ok 5 [api] › e2e\slice3-umpire.api.spec.ts:136:7 › slice 3 umpire: PUT /matches/{id}/result (API) › U5 a plain member cannot report (role guard) (230ms)
  ok 6 [chromium] › e2e\slice3-umpire.spec.ts:100:7 › slice 3 umpire: UI workflow › UI-1: umpire sees match in /umpire list and navigates to scoring page (1.6s)
  ok 7 [chromium] › e2e\slice3-umpire.spec.ts:124:7 › slice 3 umpire: UI workflow › UI-2: stepper enters valid score 15-11, 15-9 -> result-reported (2.3s)
  ok 8 [chromium] › e2e\slice3-umpire.spec.ts:167:7 › slice 3 umpire: UI workflow › UI-3: invalid score shows Thai MATCH_SCORE_INVALID text in result-error (2.0s)
  ok 9 [chromium] › e2e\slice3-umpire.spec.ts:227:7 › slice 3 umpire: UI workflow › UI-4: own-match is blocked (UMPIRE_OWN_MATCH) (4.6s)

  9 passed (25.3s)
```

---

## 6. ตาราง Mutation Testing (พิสูจน์แล้วและ revert ทั้งหมด)

### ตาราง Slice 3 Hand Mutations
| การแก้ (Mutation) | ตำแหน่งไฟล์ | ผลการทดสอบ (Step ที่แดง) | รายละเอียด Error ที่จับได้ |
|---|---|---|---|
| แก้ข้อความ `MATCH_SCORE_INVALID` เป็น `'คะแนนไม่ถูกต้องตามกติกา (MUTATED)'` | `apps/web/lib/errors.ts` | **UI-3** แดง | Expected: `"คะแนนไม่ถูกต้องตามกติกา"`, Received: `"คะแนนไม่ถูกต้องตามกติกา (MUTATED)"` |
| เปลี่ยน testid `umpire-match-action` เป็น `umpire-match-action-mutated` | `apps/web/features/umpire/UmpireMatchCard.tsx` | **UI-1** แดง | Locator `[data-testid="umpire-match-action"]` not found / timed out |

### ตรวจสอบซ้ำตาราง Mutation ของ Slice 1, Slice 2, Slice 2b (Dwight re-check)
- **Slice 1** (`docs/qa/slice1-e2e.md` ข้อ 5):
  1. เปลี่ยน testid `entry-forward` เป็นค่าผิดใน `e2e/selectors.ts` → Step 6 (forward) แดง
  2. ถอดตัวกรอง “Member เห็นเฉพาะ approved” ใน `entries.service.ts` → Step 10 (มุมมอง Member) แดง
  3. ให้ approve คืน 500 หรือปิด API → Step 8 (approve) แดง
- **Slice 2** (`docs/qa/slice2-e2e.md` ข้อ 4):
  1. ClipPlayer ไม่ยอมรับ status `uploaded` → S4 แดง
  2. ถอด `disabled` ของ `scoring-submit` เมื่อยังไม่ครบ → S4 แดง
  3. ไม่เก็บ draft ใน `useReviewDraft` → S5 แดง
  4. ข้าม dialog ยืนยัน / ไม่เรียก PUT → S6 แดง
  5. ให้ PUT ซ้ำสำเร็จ (ไม่ล็อก) → S7 แดง
- **Slice 2b** (`docs/qa/slice2-e2e.md` ข้อ 6):
  1. ถอดเงื่อนไขหมายเหตุ ≥ 5 ของปุ่ม approve-submit → C4 แดง
  2. เปลี่ยน testid `confirm-submit` → C6 แดง
  3. เปลี่ยน testid `assign-submit` → C8 แดง
  4. เปลี่ยน testid `assign-conflict` → C9 แดง

---

## 7. รายการที่ยังไม่ตรวจสอบ / ข้อยกเว้น (Unverified List)
1. **`umpire2@blulens.local` สำหรับ U4:** ใน seed หลักมีเฉพาะ `umpire1` ที่ผูกกับ event ไว้แล้ว เพื่อทดสอบกรณีผู้ใช้ที่มีบทบาท Umpire แต่ไม่ได้รับมอบหมายในงานนั้น (U4 `UMPIRE_NOT_ASSIGNED`) จึงยังคงสร้างผู้ใช้ `umpire2` เฉพาะบทบาท Umpire ผ่าน SQL ใน `slice3-umpire.api.spec.ts`
2. **การอัปโหลดคลิปวิดีโอผ่าน UI:** ปัจจุบันยังไม่มี endpoint อัปโหลดคลิป Slice 2 จึงยังคงใช้การแทรกแถว `clips` ผ่าน SQL บน DB `blulens_e2e` ตามข้อตกลงเดิม
