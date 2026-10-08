# Slice 3 — คิวยืนยันผลแมตช์ของ Committee + ตารางคะแนนรอบแบ่งกลุ่ม

> Dwight (Lead QA) · ไฟล์ test: `apps/web/e2e/slice3-results.spec.ts` (project `chromium`) · ผลที่คาดหวัง: **R1–R5 ผ่าน** (+ setup 4)
> ผู้ใช้/ข้อมูล: seed เดโม (`SEED_DEMO=1`) มีรอบแบ่งกลุ่ม; test โคลนแมตช์ `scheduled` 2 แมตช์ต่อรอบ (court `e2e-<timestamp>-A/B`, SQL บน `blulens_e2e` เท่านั้น) แล้วให้ umpire1 รายงานผลผ่าน API

| Step | สิ่งที่ตรวจ |
|---|---|
| R1 | ผลที่เพิ่ง `reported` ยังไม่ถูกนับในตารางคะแนน (`GET /events/{id}/standings` ผลรวม `played` เท่าเดิม) |
| R2 | `/committee/events/{eventId}/results` แสดงทั้ง 2 แมตช์พร้อมคะแนน `15–11, 15–9` |
| R3 | ยืนยันผล R1: dialog ยืนยัน → `POST .../result/approve` 200 → แถวหายจากคิว, `status=confirmed`, มี audit `match.result.approve`, ตารางคะแนนนับเพิ่ม 2 (สองฝ่ายแข่งเพิ่มหนึ่งนัด) |
| R4 | ส่งกลับ R2: เหตุผล 4 ตัว = ปุ่มปิด, ≥ 5 = เปิด → `POST .../result/reject` 200 → กลับเป็น `scheduled`, `games`/`reported_by` ว่าง, มี audit `match.result.reject` พร้อมเหตุผล, ตารางคะแนนไม่เปลี่ยน |
| R5 | ยืนยันซ้ำแมตช์ที่ confirmed แล้ว / reject ไม่มีเหตุผล → ≥ 400 และสถานะไม่เปลี่ยน |

รัน (API ของตัวเอง `WEB_URL=<origin web>`, db `blulens_e2e`, ต้องมี `docker`):
```bash
set -a; . ./.env; set +a; export API_URL=http://localhost:3291 PLAYWRIGHT_BASE_URL=http://localhost:3290
cd apps/web && pnpm exec playwright test --project=setup --project=chromium slice3-results
```
Mutation (ทำมือ ไม่ commit): `minLength` ของ dialog ส่งกลับ 5→1 → R4 แดง; เปลี่ยน testid `confirm-submit` → R3 แดง.

**ยังไม่ครอบคลุม:** หน้าตารางคะแนนสาธารณะ (`group-standings`, `standing-row`) และสถานะ lock `STAGE_CONFIRMED` หลังยืนยันครบทั้งกลุ่ม.
**เส้นทางสำหรับ STATUS (Jim):** Committee เข้า `/committee/events/<รหัสประเภท>/results` → ดูผลที่กรรมการสนามรายงาน → **ยืนยันผล** (หรือ **ส่งกลับให้กรรมการ** พร้อมเหตุผลอย่างน้อย 5 ตัว) → ตารางคะแนนของกลุ่มอัปเดตเมื่อยืนยันแล้ว
