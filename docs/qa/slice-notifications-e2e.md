# Gate: การแจ้งเตือนในแอป (N1–N8)

ไฟล์: `apps/web/e2e/slice-notifications.spec.ts` · ต้องมี MinIO · SQL: อ่านอย่างเดียว + โคลนแมตช์ที่ยังไม่เล่น (เฉพาะ `blulens_e2e`)

| ขั้น | ตรวจ |
|---|---|
| N0 | API คืนเฉพาะของตนเอง, รูปแบบ `{items, unreadCount}`, ไม่มี session → 401 |
| N1 | `review_assigned` ถึงผู้ตรวจทุกคนที่ถูกมอบหมาย ลิงก์ `/review`, ข้อความ blind (ไม่มีชื่อผู้ถูกประเมิน/ไอดี), ผู้กระทำไม่ได้รับ |
| N2 | อนุมัติ → สมาชิกได้ `assessment_approved` ลิงก์ `/me/assessments/{id}` (ยังไม่อ่าน); Committee ผู้กระทำไม่ได้รับ |
| N3 | ส่งกลับ → `assessment_returned` พร้อมเหตุผลใน body |
| N4 | override → สมาชิกได้ลิงก์หน้า member, Committee/Admin คนอื่นได้ลิงก์ `/committee/assessments/{id}`, ผู้กระทำไม่ได้รับ |
| N5 | มอบหมายกรรมการ → `umpire_assigned`; อนุมัติ/ปฏิเสธผล → `match_result_approved/rejected` ลิงก์ `/umpire/matches/{id}` |
| N6 | กระดิ่ง `notification-badge` ตรงกับ unreadCount ของ API; หน้า `/notifications` แสดงยังไม่อ่านก่อน (`data-unread`) |
| N7 | กดรายการ `assessment_approved` → ไปหน้า detail ของสมาชิก, อ่านแล้ว, ยอดยังไม่อ่านลด 1 |
| N8 | `notif-read-all` → unread 0, badge หาย, ปุ่มถูก disable |

ยังไม่ครอบคลุม: `assessment_confirmed` (provisional), `knockout_published` (N9 รอ owner D2), การแบ่งหน้า `notif-load-more`, polling 60 วินาที
