# S16 ชุดคลิปมาตรฐาน (Calibration set)

> ⚠ ยึด `../contract-alignment.md` และ `../v3-umpire-grading-v2.md` เมื่อขัดกัน · อ้างอิง `grading.md` §12 · สถานะ: ร่าง [WAITING FOR OWNER APPROVAL]

- **บทบาท:** Committee สร้าง/ดูผล · Reviewer ประเมินชุด · อื่น ๆ 403 · **Route:** `/committee/calibration`
- ขึ้นกับ decision G19 ของ grading v2 (endpoint `/calibration-sets`)

## Committee

- รายการชุด: ชื่อ, จำนวนคลิป, รอบ (เช่น ไตรมาส), ความคืบหน้ากรรมการ x/y
- สร้างชุด: เลือกคลิป → กำหนด **เกรดอ้างอิง** ต่อคลิป (GradePicker) → เผยแพร่ให้ Reviewer
- ผลต่อ reviewer: ตาราง คลิป × reviewer เทียบเกรดอ้างอิง + **bias** (`reviewerBias`) เป็นขั้น พร้อมข้อความทิศทาง (ไม่ใช้สีอย่างเดียว)

## Reviewer

- ใช้ S07 โหมด calibration: ป้าย "ชุดมาตรฐาน — ไม่กระทบผลผู้เล่น"; ไม่เห็นเกรดอ้างอิงจนครบชุด; หลังครบเห็น bias ของตน

| State | แสดง |
|---|---|
| ไม่มีชุด | "ยังไม่มีชุดมาตรฐาน" + (Committee) ปุ่มสร้าง |
| ฉบับร่าง | แก้ได้; เผยแพร่แล้วแก้เกรดอ้างอิงไม่ได้ (เวอร์ชันใหม่) |
| ข้อมูลไม่พอ | bias แสดง "—" + คำอธิบาย |
| error/loading | มาตรฐาน |

Components: CalibrationSetCard, GradePicker, DataTable, BiasCell
