# Slice 3 — กรรมการสนามบันทึกผลแมตช์ (PUT /matches/{id}/result)

> Dwight (Lead QA) · ไฟล์ test: `apps/web/e2e/slice3-umpire.api.spec.ts` (project `api`) · ผลที่คาดหวัง: **U1–U5 ผ่าน (5 passed)**
> ระดับ API เท่านั้นในตอนนี้ — ขั้น UI รอ 2 เรื่องด้านล่าง

## 1. ที่ครอบคลุมแล้ว (API)
ข้อมูล: seed เดโม (`SEED_DEMO=1`) มี 3 แมตช์รอบแบ่งกลุ่ม (confirmed / reported / scheduled) รูปแบบ 2 เกม แต้มเต็ม 15 ไม่มี deuce. test โคลนแมตช์ `scheduled` ด้วย SQL ทุกรอบ (บน `blulens_e2e` เท่านั้น) จึงรันซ้ำได้.

| Step | สิ่งที่ตรวจ |
|---|---|
| U1 | umpire1 (Umpire + `event_umpires`) ส่งผล 15-11, 15-9 → 200, `status=reported`, `result=a_win`, มี audit `match.result.report`, อยู่ใน `GET /events/{id}/matches` |
| U2 | คะแนนไม่ถูกต้อง 3 แบบ (เกมแรกไม่จบ · 15-15 ไม่มี deuce · เกมไม่ครบ) → 422 `MATCH_SCORE_INVALID`, แมตช์ยัง `scheduled` |
| U3 | ผู้เล่นในแมตช์ที่มีบทบาท Umpire → 403 `UMPIRE_OWN_MATCH` |
| U4 | Umpire ที่ไม่ได้ถูกมอบหมาย (ไม่มี `event_umpires`) → 403 `UMPIRE_NOT_ASSIGNED` |
| U5 | Member ธรรมดา → 403 (role guard) |

รัน (API ของตัวเอง `WEB_URL=<origin web>`, db `blulens_e2e`, `docker` ต้องใช้ได้สำหรับ SQL):
```bash
set -a; . ./.env; set +a; export API_URL=http://localhost:3291
cd apps/web && pnpm exec playwright test --project=api slice3
```
test สร้าง `umpire1/2@blulens.local` (รหัสผ่านเดโมเดียวกับ member1) และให้ Umpire ชั่วคราวกับผู้เล่นของแมตช์เพื่อ U3 (ลบ role ที่เพิ่มใน afterAll).

## 2. สิ่งที่ยังขวางขั้น UI (develop a7c4ac6)
1. **ไม่มี `GET /umpire/matches`** — FE `useUmpireMatches()` เรียก endpoint นี้ แต่ API มีเพียง `GET /events/{id}/matches` และ `PUT /matches/{id}/result` (ตรวจแล้ว: umpire1 ได้ 404) → หน้า `/umpire` และหน้าแมตช์ไม่มีข้อมูลจริง
2. **seed เดโมไม่มีผู้ใช้ Umpire/EventUmpire** — เจ้าของล็อกอินเป็นกรรมการไม่ได้

เมื่อสองข้อนี้เสร็จ จะเพิ่มขั้น UI: เห็นแมตช์ในรายการ → stepper ใส่คะแนน (`score-a/b`, `step-*`) → ส่ง → `result-reported`; คะแนนผิดแสดงข้อความไทยของ `MATCH_SCORE_INVALID` (`result-error`); แมตช์ที่ตัวเองเล่นถูกบล็อก (`UMPIRE_OWN_MATCH`).
