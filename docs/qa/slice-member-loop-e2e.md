# Gate: ลูปผลประเมินของสมาชิก (detail + แจ้งเตือน)

ไฟล์: `apps/web/e2e/slice-member-loop.spec.ts` · ต้องมี MinIO · SQL อ่านอย่างเดียวบน `blulens_e2e` · ขั้นแจ้งเตือนต้อง build web ด้วย `NEXT_PUBLIC_NOTIFICATIONS=1` และมี `GET /me/notifications` (ถ้าไม่มี ขั้นนั้นจะ skip พร้อมเหตุผล)

| ขั้น | ตรวจ | ผลที่คาด |
|---|---|---|
| L1 | สมาชิกสร้างคำขอ + อัปโหลดคลิปจริง → ส่ง → กรรมการตรวจ 2 คนให้คะแนน | สถานะ `pending_approval` |
| L2 | **ปัญหาที่พบ (`test.fail`)** ก่อน Committee อนุมัติ หน้า `/me/assessments/{id}` ต้องไม่มีเกรด (`myassess-pending`) | ตอนนี้แสดง "ผลประกาศแล้ว" + เกรด เพราะ API ส่ง `latestResult.status = pending_approval` (สัญญาระบุ pending/approved/superseded) และ FE ถือว่า != pending คือประกาศแล้ว |
| L3 | Committee อนุมัติ → หน้า detail แสดงเกรด S | `myassess-grade` |
| L4 | `/me` → `myresult-open` | ไปหน้า detail |
| L5 | (รอ API) มี notification `assessment_approved` ลิงก์ `/me/assessments/{id}` ยังไม่อ่าน | — |
| L6 | (รอ API) กระดิ่งมี badge → `/notifications` → กดรายการ → ไปหน้า detail → จำนวนยังไม่อ่านลด | — |
