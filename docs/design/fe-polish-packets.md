# FE polish packets — #5, #6, #7, #10 (จาก review-slice-1) + R8

> Pam · 2026-10-08 · ส่งให้ Andy · อ้าง `components.md` §2.1 (Button, ErrorBanner, WarningBanner), `demo-slice-1.md` D3 · ไม่มีโค้ดในไฟล์นี้ · ไฟล์อ้างตามซอร์สบน develop e820b10

## P-5 หัวฟอร์มเพิ่มคู่มีบริบทอีเวนต์
- **GOAL:** Admin/Committee รู้ว่ากำลังเพิ่มคู่ให้ทัวร์นาเมนต์ไหน ประเภทใด ช่วงเกรดเท่าไร
- **STATE:** `app/(app)/admin/events/[eventId]/entries/new/page.tsx` หัวข้อคงที่ "เพิ่มคู่ผู้สมัคร"
- **ACCEPTANCE:** (1) หัวข้อ "เพิ่มคู่: {ชื่อทัวร์นาเมนต์} · {ประเภท} {gradeMin}–{gradeMax}" (2) ลิงก์ "← กลับไปรายการผู้สมัคร" (3) แถวผู้เล่นที่เลือกแล้ว: GradeBand compact + "N สโมสร" (ถ้า API ส่ง) (4) loading = skeleton, error = ErrorBanner ไทย (5) test: หัวข้อแสดงชื่อ event จาก mock
- **DONE:** unit test + 1 step ใน smoke ตรวจหัวข้อ

## P-6 การ์ดผู้เล่นที่ 1 / 2
- **GOAL:** ลดความสับสนลำดับช่องผู้เล่น/สโมสร
- **ACCEPTANCE:** (1) สองการ์ด "ผู้เล่นที่ 1" / "ผู้เล่นที่ 2" แต่ละการ์ดมี PlayerPicker + สโมสรของคนนั้น (2) ป้าย "สโมสรของ {ชื่อ}" (ก่อนเลือกผู้เล่น = disabled + คำใบ้ "เลือกผู้เล่นก่อน") (3) ข้อความช่วยเรื่องหลายสโมสรหนึ่งครั้งต่อฟอร์ม (4) ลำดับ tab: P1 picker → P1 สโมสร → P2 picker → P2 สโมสร (5) testid เดิม (`entry-forward` ฯลฯ) ไม่เปลี่ยน — ถ้าเปลี่ยนแจ้ง Dwight
- **DONE:** unit test + smoke slice 1 ยังเขียว

## P-7 โทเคนสีแทนคลาสสีดิบ
- **STATE:** ที่เหลือ: `components/ui/ClipPlayer.tsx` (`bg-blue-500`, `bg-red-500`, `text-gray-600`), `components/ui/GradePicker.tsx` (`bg-blue-100/green-100/red-100`, `text-gray-600/700`); ตรวจ AdminEntryForm ซ้ำ
- **ACCEPTANCE:** (1) ไม่มี `bg-(blue|green|red|gray)-NNN` / `text-gray-NNN` ใน 3 ไฟล์ (grep เป็นเกณฑ์) (2) ปุ่มหลัก `primary`, อันตราย `destructive`, ข้อความรอง `muted-foreground` (3) สี tier ของ GradePicker ใช้โทเคน tier ใน `components.md` (green/blue/purple/orange/yellow-gold) (4) สถานะไม่ใช้สีอย่างเดียว: ไอคอน+ข้อความ (5) ปุ่มย้อน 5 วิ / 0.5x / 1x / 1.5x และปุ่มขั้นย่อยของ GradePicker สูง ≥ 44px (R8)
- **DONE:** grep ว่าง + test เดิมผ่าน (testid ไม่เปลี่ยน)

## P-10 เมนู/บัญชีผู้ใช้
- **ACCEPTANCE:** (1) บล็อก "บัญชี" (ชื่อผู้ใช้ + บทบาทเป็นข้อความ + ออกจากระบบ) แยกจากรายการเมนู (2) ชื่อเมนูไม่ซ้ำกับชื่อบทบาท ("ผู้ดูแลระบบ" → "จัดการผู้ใช้"; "คณะกรรมการ" → "ผลประเมิน/คิวอนุมัติ" ตามหน้าปลายทาง) (3) กว้าง < 768: top bar + drawer (ปุ่มเมนู 44px, aria-expanded) (4) ระหว่างโหลด `/me` แสดง skeleton เมนู ไม่ใช่เมนูไม่ครบ (R10) (5) test AppShell/SideNav ปรับตามชื่อใหม่
- **DONE:** unit test + ตรวจที่ 390px (ขอ Pam ตรวจรอบสอง)
