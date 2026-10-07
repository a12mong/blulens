# S16 ชุดคลิปมาตรฐาน (Calibration set)

> ⚠ ยึด `../contract-alignment.md` และ `../v3-umpire-grading-v2.md` เมื่อขัดกัน · อ้างอิง `grading.md` §12 · สถานะ: ร่าง [WAITING FOR OWNER APPROVAL]

- **บทบาท:** Committee สร้าง/ดูผล · Reviewer ประเมินชุด · อื่น ๆ 403 · **Route:** `/committee/calibration`
- ขึ้นกับ decision G19 ของ grading v2 (endpoint `/calibration-sets`)

## Committee

- รายการชุด: ชื่อ, จำนวนคลิป, รอบ (เช่น ไตรมาส), ความคืบหน้ากรรมการ x/y
- สร้างชุด: เลือกคลิป → กำหนด **เกรดอ้างอิง** ต่อคลิป (GradePicker) → เผยแพร่ให้ Reviewer
- ผลต่อ reviewer: ตาราง คลิป × reviewer เทียบเกรดอ้างอิง + **bias** (`reviewerBias`) เป็นขั้น พร้อมข้อความทิศทาง (ไม่ใช้สีอย่างเดียว)

## Reviewer

- ดู "รายละเอียดเพิ่ม" ท้ายไฟล์ (ห้ามบอก Reviewer ว่าเป็นชุดมาตรฐาน)

| State | แสดง |
|---|---|
| ไม่มีชุด | "ยังไม่มีชุดมาตรฐาน" + (Committee) ปุ่มสร้าง |
| ฉบับร่าง | แก้ได้; เผยแพร่แล้วแก้เกรดอ้างอิงไม่ได้ (เวอร์ชันใหม่) |
| ข้อมูลไม่พอ | bias แสดง "—" + คำอธิบาย |
| error/loading | มาตรฐาน |

Components: CalibrationSetCard, GradePicker, DataTable, BiasCell

## รายละเอียดเพิ่ม (G19 = (b) อนุมัติแล้ว; grading v2 frozen)

**สร้างชุด (Committee):** ชื่อชุด/รอบ → เพิ่มคลิปทีละคลิปด้วย ClipUploader เดิมจาก S05 (ขอ upload-url ด้วย fileName/contentType/sizeBytes/referenceKey แล้ว PUT ตรงไป MinIO; สถานะคลิป pending_upload/uploaded/rejected ตาม S05) + **GradePicker เลือกเกรดอ้างอิง 1 ค่าต่อคลิป (ภาพรวม ไม่ใช่ต่อหัวข้อ)** → มอบหมายกรรมการ → เผยแพร่ (หลังเผยแพร่แก้เกรดอ้างอิง/คลิปไม่ได้)

**ผล:** ต่อ reviewer แสดง `biasVsReference` (ขั้น พร้อมข้อความทิศทาง) และ `meanAbsError` (ขั้น); ตารางคลิป × reviewer เทียบเกรดอ้างอิง; ข้อมูลน้อย → "—"

**Reviewer:** ต้องแยกไม่ออกจากการประเมินจริงในหน้าตา S07 (ห้ามมีป้าย "calibration" ที่ทำให้รู้ว่าเป็นชุดมาตรฐาน — ตาม GR-33 ของ Dwight); ลบข้อความป้าย "ชุดมาตรฐาน" ที่ระบุข้างต้นออก และไม่เห็นเกรดอ้างอิง/bias จนกว่า Committee เผยแพร่ผล
