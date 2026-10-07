# S17 คำขอทีมใหม่ (Committee)

> ⚠ ยึด `../contract-alignment.md` และ `../v3-umpire-grading-v2.md` · สถานะ: ร่าง [WAITING FOR OWNER APPROVAL] · ชื่อฟิลด์ตาม openapi.yaml บน develop

- **บทบาท:** Committee แก้ · Admin จัดการทีมถาวร (ตาม architecture §3) ดูคิวนี้แบบอ่านอย่างเดียว · **Route:** `/committee/teams/requests`
- ที่มา: Member กด "ขอเพิ่มทีมใหม่" ใน TeamCombobox (S05)

## ตาราง

| คอลัมน์ | เนื้อหา |
|---|---|
| ชื่อที่ขอ | ข้อความที่ผู้ขอพิมพ์ + ผู้ขอ + เวลา |
| ทีมที่คล้าย | รายการทีมที่มีอยู่ที่ชื่อใกล้เคียง (ระบบแนะนำ) |
| การกระทำ | **สร้างทีมใหม่** · **ผูกเป็นชื่อเรียกอื่น (alias) ของทีมที่มีอยู่** (เลือกทีม) · **ปฏิเสธ** (เหตุผลบังคับ) |

## States

| State | แสดง |
|---|---|
| ว่าง | "ไม่มีคำขอทีม" |
| ซ้ำกับทีมที่มีอยู่ | แสดง match + ปุ่ม alias เป็นค่าแนะนำ |
| หลังตัดสิน | ผู้ขอได้รับแจ้ง; entry ที่รอทีมถูกผูกอัตโนมัติ (TBD-API) |
| ชนกัน | "ถูกดำเนินการโดย X แล้ว" |

Components: TeamRequestRow, DataTable, ConfirmDialog(reason), TeamPicker
