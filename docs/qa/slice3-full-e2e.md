# Slice 3 — วงจรเต็ม: จับกลุ่ม → เผยแพร่ → กรรมการสนามรายงาน → Committee ยืนยัน → ล็อกรอบแบ่งกลุ่ม

> Dwight (Lead QA) · ไฟล์ test: `apps/web/e2e/slice3-full.spec.ts` (project `chromium`) · ผลที่คาดหวัง: **F1–F9 ผ่าน** (+ setup 4 = 13 passed)
> ประเภท MD ใหม่ทุกรอบ (groups_knockout, groupSize 3) + 3 คู่ที่ใช้ทีมร่วมกัน → 1 กลุ่ม 3 แมตช์

| Step | สิ่งที่ตรวจ |
|---|---|
| F1 | เตรียมข้อมูลผ่าน API จริง + `event_umpires` ของ `umpire1@blulens.local` (seed) ด้วย SQL |
| F2 | UI: จับกลุ่ม → รับทราบทีมชน + เหตุผล → เผยแพร่ → `draw-published` |
| F3 | เผยแพร่แล้วมี 3 แมตช์ `scheduled`; กดล็อกกลุ่มตอนนี้ → 409 `GROUP_MATCHES_INCOMPLETE` |
| F4 | umpire1 รายงานครบ 3 แมตช์ (15-9, 15-7) → `reported`; ล็อกยังไม่ได้ (409 เดิม) |
| F5 | UI: Committee ยืนยัน 3 แมตช์ในคิวผล |
| F6 | ตารางคะแนนสด: อันดับ 1–3, แข่งคนละ 2, `confirmed=false`; หน้าสาธารณะแสดง `standings-provisional` |
| F7 | `POST /events/{id}/groups/confirm` 200: snapshot `confirmed=true`, qualification = qualified, qualified, out; draw เป็น `locked`; audit `groups.confirm` |
| F8 | หลังล็อก: confirm ซ้ำ → 409 `DRAW_ALREADY_LOCKED`; reject ผล → 409 `STAGE_CONFIRMED`; รายงานผลใหม่ → 409 |
| F9 | หน้าสาธารณะ (ไม่ล็อกอิน) แสดงตาราง 3 แถวและไม่มี `standings-provisional` |

รัน: `cd apps/web && pnpm exec playwright test --project=setup --project=chromium slice3-full` (API ของตัวเอง `WEB_URL` ตั้งแล้ว, db `blulens_e2e`, seed เดโมรันแล้ว).
Mutation: เปลี่ยน testid `standings-provisional` → F6 แดง.

**ช่องว่างของ product ที่พบ (ใช้ workaround SQL ใน F3):** แมตช์ที่เกิดจากการเผยแพร่ไม่มี `court` และไม่มี API ตั้งสนาม ขณะที่กรรมการที่ผูกกับอีเวนต์แบบ `courts` ว่าง ถูกถือว่า "ไม่ได้รับมอบหมาย" (`UMPIRE_NOT_ASSIGNED`) ทั้งที่ schema ระบุว่าว่าง = ทุกสนาม → กรรมการรายงานผลของกลุ่มที่เพิ่งจับไม่ได้ในเส้นทางจริง.
**ยังไม่ครอบคลุม:** UI ของ groups/confirm (ยังไม่มีปุ่ม), best thirds, รอบ knockout.
