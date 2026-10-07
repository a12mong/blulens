# S14 คิวยืนยันผลแมตช์ (Committee)

> ⚠ ยึด `../contract-alignment.md` และ `../v3-umpire-grading-v2.md` เมื่อขัดกัน · อ้างอิง `tournament-format.md` §5.1 · สถานะ: ร่าง [WAITING FOR OWNER APPROVAL]

- **บทบาท:** Committee (ยืนยัน/ตีกลับ) · Admin ดูอย่างเดียว · **Route:** `/committee/events/:id/results`
- นับเฉพาะผล `confirmed` ในตารางคะแนน/การเลื่อนรอบ (ข้อความอธิบายบนหน้า)

## ตาราง (desktop) / การ์ด (mobile)

| คอลัมน์ | เนื้อหา |
|---|---|
| แมตช์ | รอบ/กลุ่ม · สนาม · คู่แข่ง |
| ผลที่รายงาน | คะแนนต่อเกม + ผู้ชนะ · ผู้รายงาน (Umpire) + เวลา |
| ธง | `UMPIRE_TEAM_CONFLICT` (Umpire ทีมเดียวกับผู้เล่น) · `COMMITTEE_DIRECT_ENTRY` (Committee กรอกเองไม่มีรายงาน Umpire) · `CORRECTED` (Committee แก้คะแนนที่ confirmed แล้ว; ไม่ตั้งเมื่อ Umpire แก้ผล reported ของตนหรือเมื่อตีกลับ) — chip ไอคอน+ข้อความ; CORRECTED มี tooltip "แก้ไขหลังยืนยัน" + ลิงก์รายการ audit (ใคร/เมื่อไร/ก่อน-หลัง/เหตุผล) |
| การกระทำ | ยืนยัน · ตีกลับ (เหตุผลบังคับ) · แก้ผลเอง (เหตุผลบังคับ) |

- ยืนยันแบบกลุ่มได้เฉพาะแถวที่ไม่มีธง; แถวมีธงต้องเปิดรายละเอียดก่อน
- "ยืนยันผลรอบกลุ่ม" เปิดเมื่อทุกแมตช์ในกลุ่ม `confirmed`/`void` → อธิบายว่าจะสร้างสายน็อคเอาท์ต่อ
- แก้ผลที่ยืนยันแล้ว: ตามเงื่อนไข §5.1 (ปุ่มปิดพร้อมเหตุผลเมื่อเกินเงื่อนไข) + audit trail

## States

| State | แสดง |
|---|---|
| ว่าง | "ไม่มีผลรอยืนยัน" |
| มีธง | แบนเนอร์จำนวนธง + ตัวกรอง "มีธง" |
| กำลังยืนยัน | แถว spinner; ล้มเหลว → คืนค่า + ข้อความ |
| ชนกัน | "ถูกดำเนินการโดย X แล้ว" |
| ไม่ใช่ Committee | 403 (Admin: ซ่อนปุ่มทั้งหมด) |

Components: ResultApprovalRow, DataTable, ConfirmDialog(reason), AuditTrail, FlagChip, EmptyState
