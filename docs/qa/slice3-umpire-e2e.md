# Slice 3 — กรรมการสนามบันทึกผลแมตช์ (PUT /matches/{id}/result)

> Dwight (Lead QA) & Kelly · ไฟล์ test: `apps/web/e2e/slice3-umpire.api.spec.ts` (project `api`) + `apps/web/e2e/slice3-umpire.spec.ts` (project `chromium`)
> ผลที่คาดหวัง: **API 5/5 + UI 4/4 ผ่านทั้งหมด (9 passed)**

---

## 1. การครอบคลุมระดับ API (`slice3-umpire.api.spec.ts`)
ข้อมูล: seed เดโม (`SEED_DEMO=1`) มี 3 แมตช์รอบแบ่งกลุ่ม (confirmed / reported / scheduled) รูปแบบ 2 เกม แต้มเต็ม 15 ไม่มี deuce. test โคลนแมตช์ `scheduled` ด้วย SQL ทุกรอบ (บน `blulens_e2e` เท่านั้น) จึงรันซ้ำได้อย่างปลอดภัยและเป็นอิสระต่อกัน.

| Step | สิ่งที่ตรวจ |
|---|---|
| U1 | umpire1 (Umpire + `event_umpires`) ส่งผล 15-11, 15-9 → 200, `status=reported`, `result=a_win`, มี audit `match.result.report`, อยู่ใน `GET /events/{id}/matches` |
| U2 | คะแนนไม่ถูกต้อง 3 แบบ (เกมแรกไม่จบ · 15-15 ไม่มี deuce · เกมไม่ครบ) → 422 `MATCH_SCORE_INVALID`, แมตช์ยัง `scheduled` |
| U3 | ผู้เล่นในแมตช์ที่มีบทบาท Umpire → 403 `UMPIRE_OWN_MATCH` |
| U4 | Umpire ที่ไม่ได้ถูกมอบหมาย (ไม่มี `event_umpires`) → 403 `UMPIRE_NOT_ASSIGNED` |
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

## 3. คำสั่งรัน
รันบนพอร์ตของตนเอง (เช่น API 3391, Web 3390), DB `blulens_e2e`, ตั้ง `DISABLE_RATE_LIMIT=1` และ `WEB_URL=<origin web>`:

```bash
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

## 4. ผลการรัน 3 รอบติดต่อกัน (3x Green Runs)

### Run 1:
```text
Running 9 tests using 1 worker

  ok 1 [api] › e2e\slice3-umpire.api.spec.ts:103:7 › slice 3 umpire: PUT /matches/{id}/result (API) › U1 assigned umpire enters a valid score -> 200, status reported, games stored (586ms)
  ok 2 [api] › e2e\slice3-umpire.api.spec.ts:113:7 › slice 3 umpire: PUT /matches/{id}/result (API) › U2 invalid score -> 422 MATCH_SCORE_INVALID, match unchanged (285ms)
  ok 3 [api] › e2e\slice3-umpire.api.spec.ts:126:7 › slice 3 umpire: PUT /matches/{id}/result (API) › U3 umpire who plays in the match -> 403 UMPIRE_OWN_MATCH (225ms)
  ok 4 [api] › e2e\slice3-umpire.api.spec.ts:133:7 › slice 3 umpire: PUT /matches/{id}/result (API) › U4 umpire not assigned to the event/court -> 403 UMPIRE_NOT_ASSIGNED (215ms)
  ok 5 [api] › e2e\slice3-umpire.api.spec.ts:140:7 › slice 3 umpire: PUT /matches/{id}/result (API) › U5 a plain member cannot report (role guard) (205ms)
  ok 6 [chromium] › e2e\slice3-umpire.spec.ts:111:7 › slice 3 umpire: UI workflow › UI-1: umpire sees match in /umpire list and navigates to scoring page (998ms)
  ok 7 [chromium] › e2e\slice3-umpire.spec.ts:135:7 › slice 3 umpire: UI workflow › UI-2: stepper enters valid score 15-11, 15-9 -> result-reported (1.2s)
  ok 8 [chromium] › e2e\slice3-umpire.spec.ts:178:7 › slice 3 umpire: UI workflow › UI-3: invalid score shows Thai MATCH_SCORE_INVALID text in result-error (1.3s)
  ok 9 [chromium] › e2e\slice3-umpire.spec.ts:238:7 › slice 3 umpire: UI workflow › UI-4: own-match is blocked (UMPIRE_OWN_MATCH) (4.0s)

  9 passed (18.6s)
```

### Run 2:
```text
Running 9 tests using 1 worker

  ok 1 [api] › e2e\slice3-umpire.api.spec.ts:103:7 › slice 3 umpire: PUT /matches/{id}/result (API) › U1 assigned umpire enters a valid score -> 200, status reported, games stored (508ms)
  ok 2 [api] › e2e\slice3-umpire.api.spec.ts:113:7 › slice 3 umpire: PUT /matches/{id}/result (API) › U2 invalid score -> 422 MATCH_SCORE_INVALID, match unchanged (266ms)
  ok 3 [api] › e2e\slice3-umpire.api.spec.ts:126:7 › slice 3 umpire: PUT /matches/{id}/result (API) › U3 umpire who plays in the match -> 403 UMPIRE_OWN_MATCH (240ms)
  ok 4 [api] › e2e\slice3-umpire.api.spec.ts:133:7 › slice 3 umpire: PUT /matches/{id}/result (API) › U4 umpire not assigned to the event/court -> 403 UMPIRE_NOT_ASSIGNED (225ms)
  ok 5 [api] › e2e\slice3-umpire.api.spec.ts:140:7 › slice 3 umpire: PUT /matches/{id}/result (API) › U5 a plain member cannot report (role guard) (170ms)
  ok 6 [chromium] › e2e\slice3-umpire.spec.ts:111:7 › slice 3 umpire: UI workflow › UI-1: umpire sees match in /umpire list and navigates to scoring page (1.3s)
  ok 7 [chromium] › e2e\slice3-umpire.spec.ts:135:7 › slice 3 umpire: UI workflow › UI-2: stepper enters valid score 15-11, 15-9 -> result-reported (1.5s)
  ok 8 [chromium] › e2e\slice3-umpire.spec.ts:178:7 › slice 3 umpire: UI workflow › UI-3: invalid score shows Thai MATCH_SCORE_INVALID text in result-error (1.5s)
  ok 9 [chromium] › e2e\slice3-umpire.spec.ts:238:7 › slice 3 umpire: UI workflow › UI-4: own-match is blocked (UMPIRE_OWN_MATCH) (2.9s)

  9 passed (19.3s)
```

### Run 3:
```text
Running 9 tests using 1 worker

  ok 1 [api] › e2e\slice3-umpire.api.spec.ts:103:7 › slice 3 umpire: PUT /matches/{id}/result (API) › U1 assigned umpire enters a valid score -> 200, status reported, games stored (520ms)
  ok 2 [api] › e2e\slice3-umpire.api.spec.ts:113:7 › slice 3 umpire: PUT /matches/{id}/result (API) › U2 invalid score -> 422 MATCH_SCORE_INVALID, match unchanged (269ms)
  ok 3 [api] › e2e\slice3-umpire.api.spec.ts:126:7 › slice 3 umpire: PUT /matches/{id}/result (API) › U3 umpire who plays in the match -> 403 UMPIRE_OWN_MATCH (258ms)
  ok 4 [api] › e2e\slice3-umpire.api.spec.ts:133:7 › slice 3 umpire: PUT /matches/{id}/result (API) › U4 umpire not assigned to the event/court -> 403 UMPIRE_NOT_ASSIGNED (228ms)
  ok 5 [api] › e2e\slice3-umpire.api.spec.ts:140:7 › slice 3 umpire: PUT /matches/{id}/result (API) › U5 a plain member cannot report (role guard) (169ms)
  ok 6 [chromium] › e2e\slice3-umpire.spec.ts:111:7 › slice 3 umpire: UI workflow › UI-1: umpire sees match in /umpire list and navigates to scoring page (1.1s)
  ok 7 [chromium] › e2e\slice3-umpire.spec.ts:135:7 › slice 3 umpire: UI workflow › UI-2: stepper enters valid score 15-11, 15-9 -> result-reported (1.3s)
  ok 8 [chromium] › e2e\slice3-umpire.spec.ts:178:7 › slice 3 umpire: UI workflow › UI-3: invalid score shows Thai MATCH_SCORE_INVALID text in result-error (1.5s)
  ok 9 [chromium] › e2e\slice3-umpire.spec.ts:238:7 › slice 3 umpire: UI workflow › UI-4: own-match is blocked (UMPIRE_OWN_MATCH) (3.4s)

  9 passed (19.2s)
```

---

## 5. ตาราง Mutation Testing (พิสูจน์แล้วและ revert ทั้งหมด)

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

## 6. รายการที่ยังไม่ตรวจสอบ / ข้อยกเว้น (Unverified List)
1. **Seed user Umpire ถาวร (`bl-25-6`, Creed):** PR/branch `dev/bl-25-seed-umpire` ยังไม่ได้ merge เข้า `develop` ในขณะนี้ การทดสอบ E2E ทั้ง API และ UI จึงทำการสร้างบัญชี `umpire1@blulens.local` และกำหนดสิทธิ์ `event_umpires` แบบ idempotent ชั่วคราวบนฐานข้อมูล `blulens_e2e` ใน `beforeAll` เมื่อ `bl-25-6` merge เข้า `develop` จะสามารถสลับไปใช้ seed ข้อมูลหลักได้อย่างราบรื่น
2. **การอัปโหลดคลิปวิดีโอผ่าน UI:** ปัจจุบันยังไม่มี endpoint อัปโหลดคลิป Slice 2 จึงยังคงใช้การแทรกแถว `clips` ผ่าน SQL บน DB `blulens_e2e` ตามข้อตกลงเดิม
