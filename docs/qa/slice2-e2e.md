# วิธีรัน Playwright gate ของ Slice 2 (เส้นทางกรรมการให้คะแนน)

> Dwight (Lead QA) · ไฟล์ test: `apps/web/e2e/slice2.spec.ts` (project `chromium`) · ผลลัพธ์ที่คาดหวัง: **S1–S7 ผ่านทั้งหมด** (+ setup 4 ขั้น)
> ไม่รวมหน้าแสดงผลคะแนนรวม (รอ aggregate-on-submit bl-10-3e)

## 1. เส้นทางที่ test ครอบคลุม
| Step | สิ่งที่ตรวจ |
|---|---|
| S1 | Member1 สร้าง assessment → แทรกแถว clip (status `uploaded`, object_key `/e2e/sample.mp4?c=<clipId>` — คอลัมน์ unique) ลง DB → submit → status `submitted` |
| S2 | Committee `POST /assessments/{id}/assign` กรรมการ reviewer1 + reviewer2 → `in_review` |
| S3 | reviewer1 เปิด `/review` เห็นงานในคิว (ปุ่ม "เริ่ม") |
| S4 | `/review/tasks/[id]`: clip player เล่นได้ (ไม่ขึ้น "ยังไม่พร้อม"), มี rubric card, ปุ่มส่งปิดอยู่จนกว่าจะครบ |
| S5 | เลือกเกรด + ความเห็น → reload → ร่างยังอยู่ (เก็บในเครื่อง) |
| S6 | ให้คะแนนครบ → ส่ง → ยกเลิก (ยังอยู่หน้าเดิม) → ส่งอีกครั้ง → ยืนยัน → `PUT /reviews/assignments/{id}` = 200 → กลับ `/review` และงานหายจากคิว |
| S7 | cross-check API: งานอยู่ใน `assignments/me?state=submitted`; ส่งซ้ำต้องถูกปฏิเสธ (≥ 400) |

## 2. เงื่อนไขก่อนรัน (ที่ยังไม่อยู่บน develop ณ 0e8276c)
1. **`GET /reviews/assignments/{id}`** (Kevin, P1) — ไม่มี endpoint นี้ หน้า task จะขึ้น `scoring-error` → S4–S6 แดงจนกว่าจะ merge
2. **บัญชี `reviewer1..3@blulens.local`** (Reviewer ไม่มีทีม) — seed เดโมจะเพิ่ม; ระหว่างรอให้รัน `docs/qa/slice2-e2e-seed.sql` บน `blulens_e2e` เท่านั้น
3. **วิดีโอตัวอย่าง** `/e2e/sample.mp4` ใต้ `apps/web/public` (Andy) — viewUrl ของคลิปใน e2e
4. ไม่มี endpoint อัปโหลดคลิป → test แทรกแถว `clips` ด้วย SQL (ผ่าน `docker exec` ไป DB `blulens_e2e` ตายตัวในโค้ด ห้ามชี้ `blulens_demo`)

## 3. เตรียมและรัน
ทำตาม `docs/qa/slice1-e2e.md` ข้อ 1–3, 6, 8 (DB `blulens_e2e`, API+web พอร์ตของตัวเอง, `DISABLE_RATE_LIMIT=1` เมื่อวนรัน) แล้ว:
```bash
docker exec -i blulens-postgres psql -U blulens -d blulens_e2e < docs/qa/slice2-e2e-seed.sql   # ครั้งเดียว (idempotent)
export API_URL=http://localhost:3191 PLAYWRIGHT_BASE_URL=http://localhost:3190
set -a; . ./.env; set +a
cd apps/web && pnpm exec playwright test --project=setup --project=chromium slice2
```
ตัวแปรเสริม: `E2E_PG_CONTAINER` (default `blulens-postgres`), `E2E_PG_USER` (default `blulens`). ห้ามพิมพ์ค่า password ลง log/แชท

## 4. Mutation ที่ใช้พิสูจน์ว่า test จับได้ (ทำมือ ห้าม commit)
| การแก้ | step ที่ต้องแดง |
|---|---|
| ClipPlayer ไม่ยอมรับ status `uploaded` | S4 |
| ถอด `disabled` ของ `scoring-submit` เมื่อยังไม่ครบ | S4 |
| ไม่เก็บ draft ใน `useReviewDraft` | S5 |
| ข้าม dialog ยืนยัน/ไม่เรียก PUT | S6 |
| ให้ PUT ซ้ำสำเร็จ (ไม่ล็อก) | S7 |

## 5. เส้นทางคลิปสำหรับ docs/STATUS.md (ให้ Jim)
เข้าสู่ระบบด้วย reviewer1@blulens.local → เมนู **รีวิว** (`/review`) → กด **เริ่ม** ที่งานในคิว → ดูคลิป → เลือกเกรดทุกเกณฑ์ → กด **ส่งและล็อก** → ยืนยัน → งานหายจากคิว

## 6. Slice 2b — เส้นทางคณะกรรมการตัดสิน (`apps/web/e2e/slice2-committee.spec.ts`)
เตรียมข้อมูลผ่าน API จริง (Member ส่ง → Committee มอบหมาย → reviewer1/2 ส่ง → aggregate-on-submit) แล้ว Committee ตัดสินใน UI. ผลที่คาดหวัง: **C1–C7 ผ่าน** (รันรวม `slice2` = setup 4 + 7 + 7 = 18 passed)

| Step | สิ่งที่ตรวจ |
|---|---|
| C1 | สร้าง 4 งาน: A `pending_approval` (S,S) · B `disputed` (RK1,S) · C `pending_approval` (S,S) · D `provisional` (event minReviewers=1, reviewer 1 คน) |
| C2 | `/committee/assessments` แสดงแถวทั้ง 4 พร้อมสถานะ (`assessment-status[data-status]`) |
| C3 | detail A: มีผลคะแนน + แถว reviewer 2 แถว; อนุมัติ (ไม่ต้องมีหมายเหตุ) → `approved`, result version 2 |
| C4 | B (disputed): API approve ไม่มี note → 422 `ASSESSMENT_APPROVE_NOTE_REQUIRED`; resultVersion เก่า → 409 `RESULT_VERSION_STALE`; return เหตุผลสั้น → 422 `REASON_REQUIRED`; UI: note 4 ตัว = ปิด, 5 = เปิด; ยกเลิกไม่เปลี่ยนสถานะ; return (4 ปิด / 5 เปิด) → `in_review` |
| C5 | C: override เหตุผล 19 ตัว → 422 `REASON_TOO_SHORT`; UI เลือกเกรด P + เหตุผล ≥ 20 → `overridden`, result `override/overridden`, มีแถว `audit_logs` (`assessment.override`, reason ตรง) |
| C6 | D (provisional): ยืนยันผล → `approved` |
| C7 | รายการและ API แสดงสถานะใหม่ครบ; A อนุมัติซ้ำ → 409 `ASSESSMENT_INVALID_TRANSITION` |

ต้องมี `SEED_ADMIN_*` และ `SEED_DEMO_PASSWORD`; API ต้องตั้ง `WEB_URL=<origin ของ web>` (ไม่งั้น `ORIGIN_FORBIDDEN`). SQL ไปที่ `blulens_e2e` เท่านั้น.

Mutation ที่พิสูจน์แล้ว (ทำมือ ไม่ commit): ถอดเงื่อนไขหมายเหตุ ≥ 5 ของปุ่ม approve-submit → C4 แดง; เปลี่ยน testid `confirm-submit` → C6 แดง.

**เส้นทางสำหรับ docs/STATUS.md (Jim):** เข้าสู่ระบบ committee@blulens.local → `/committee/assessments` → เปิดงานที่รออนุมัติ → ดูผลคะแนน/กรรมการ → **อนุมัติ** (หรือ **ส่งกลับ** ใส่เหตุผล ≥ 5 ตัว, **แก้ไขผล** เลือกเกรด + เหตุผล ≥ 20 ตัว, **ยืนยันผล** สำหรับผลชั่วคราว) → สถานะในรายการเปลี่ยนตามทันที
