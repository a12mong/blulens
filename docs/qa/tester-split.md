# การแบ่งงาน Tester: Toby / Kelly

> Dwight (Lead QA) · 2026-10-07 · อ้างอิง `test-plan.md` · packet ยังถูกระงับจนกว่า god relay ว่าเจ้าของอนุมัติ bl-03/bl-04

| Tester | Model | ขอบเขต | เคส |
|---|---|---|---|
| Toby (`toby-muxsx85u`) | Claude | ระบบจัดเกรด: simulation, สูตร kappa, golden fixtures, outlier, สถานะ pending/insufficient, สิทธิ์ของการส่งคะแนน | GR-01..GR-20 |
| Kelly (`kelly-muxtbxnh`) | Gemini 3.8 Flash | ระบบจับสาย (ล่าการชนกันของทีม, property test หลาย seed, re-draw, concurrent) + ชื่อทีม + อัปโหลดคลิป | DR-01..DR-19, RG-01..RG-12 |
| ร่วมกัน | — | X-01..X-03 (e2e): Toby เขียน X-01, Kelly เขียน X-02/X-03 | X-* |

## เหตุผล
- GR ต้องการความแม่นยำเชิงตัวเลข (สูตร/ปัดเศษ) และเป็นงานที่ก้อนเดียวกัน (fixture ชุดเดียว) → ให้คนเดียวถือเพื่อลดความไม่สอดคล้อง
- DR + RG-01..07 ใช้ตัวช่วยเดียวกัน (`normalizeTeam`, ตัวสร้างผู้เล่นสุ่ม) และ RG-03 ผูกกับ DR-01..04 โดยตรง → อยู่ฝั่งเดียวกัน
- แยกโมเดลทำให้ได้ "ตาที่สอง" ต่างสายตา: ทุก test ที่คนหนึ่งเขียน ให้อีกคน review แบบ cross-review (ดูด้านล่าง)

## กติกา
1. ไม่มีไฟล์ทับกัน: Toby เขียนใต้ `*/grading/**` และ `e2e/grading*`; Kelly เขียนใต้ `*/draw/**`, `*/teams/**`, `*/clips/**` (path จริงตามโครง repo เมื่อ Kevin ยืนยัน)
2. Fixture กลาง (ตัวสร้างผู้เล่น/ทีม, seeded RNG, fake clock helper) ให้ Toby เขียนก่อนในแพ็กแรก แล้ว Kelly ใช้ — Kelly ห้ามทำสำเนาของตัวเอง
3. Cross-review: คู่ GR↔DR สลับกัน review (Toby review 3 test ของ Kelly, Kelly review 3 test ของ Toby ต่อรอบ) โดยโจมตีว่า test ผ่านแม้โค้ดผิดหรือไม่ (mutation มือ)
4. Gemini Flash มีแนวโน้มเขียน assert หลวม: packet ของ Kelly ต้องระบุ "ค่าที่คาดหวังเป็นตัวเลขจริง" และ DONE ต้องแนบ red→green เสมอ; Dwight ตรวจสุ่มก่อนรับ
5. ทั้งคู่ถามขึ้น Dwight เท่านั้น; พบบั๊กให้รายงานไม่แก้ product code

## ลำดับแพ็ก (หลังอนุมัติ)
| ลำดับ | Toby | Kelly |
|---|---|---|
| 1 | fixture กลาง + GR-12 (shape invariant) | RG-01, RG-02, RG-04 (`normalizeTeam` table) |
| 2 | GR-08, GR-06, GR-07 (undefined/ขั้นต่ำ) | DR-06, DR-07, DR-08 (ตารางสาย/ลำดับช่อง/ฟิกซ์เจอร์) แล้ว DR-01..03 |
| 3 | GR-01..03 (outlier), GR-11 (golden kappa) | DR-04, DR-05, DR-09, DR-10, DR-11, DR-12, DR-13, DR-14 |
| 4 | GR-04, GR-15..20 (I) | DR-15..19, RG-03, RG-06..12 (I) |
| 5 | X-01 | X-02, X-03 |
