# การจัดให้ตรงกับ API contract (v2) — ตอบ Jim 9 ข้อ

> Pam · 2026-10-07 · **ไฟล์นี้มีผลเหนือข้อความที่ขัดกันในไฟล์อื่นของ `docs/design/`** (เปิดอ่านก่อน) · ฐานอ้างอิง: `docs/api/openapi.yaml`, `docs/specs/architecture.md`, `grading.md`, `draw.md` (develop b60f2b6) · grading/draw ยังรอเจ้าของอนุมัติ → ถือเป็นข้อเสนอปัจจุบัน
> สถานะ: ร่าง รออนุมัติพร้อมชุด bl-05 · ห้ามสร้าง Dev task จนกว่าเจ้าของอนุมัติ [WAITING FOR OWNER APPROVAL]
> เมื่อเจ้าของอนุมัติ จะรวมการแก้เข้าเนื้อไฟล์ S05/S07/S08/S09/S10/S12/components ทีเดียว (ตอนนี้ใช้ไฟล์นี้เป็นตัวกำกับ)

| # | หัวข้อ | คำตอบ | สิ่งที่เปลี่ยนในสเปก |
|---|---|---|---|
| 1 | สเกลให้คะแนน | **จะปรับตาม (align)** | S07: ต่อหัวข้อเลือก **1 ขั้นจาก 15 ขั้น (RK1..P+) จัดกลุ่มตาม 5 tier** + ตัวเลือก **"ประเมินไม่ได้" (gradeKey null)**. ScoreInput ใหม่ = 2 ชั้น: เลือก tier (5 ปุ่ม) → เลือกขั้นย่อย (3 ปุ่ม; ขั้นละ ≥ 44px) บนมือถือ; desktop แสดงบันได 15 ขั้นแถวเดียวจัดกลุ่ม. anchor แสดงต่อ tier (grading appendix A). ตัดแนวคิด 1–5/slider ทิ้ง |
| 2 | น้ำหนัก | **align** | น้ำหนักเป็นค่าสัมพัทธ์ (ค่าเริ่มต้น 1). UI แสดงเป็น % ที่ **คำนวณเพื่ออ่านเท่านั้น** ไม่บังคับรวม 100. ตัดกฎ "รวม ≠ 100 บล็อก" ใน S12/F1 |
| 3 | สิทธิ์ Admin/Committee | **align** | แก้ matrix: **Admin ไม่ใช่ superset ของ Committee**. Admin = ผู้ใช้/บทบาท/ทีม/audit เท่านั้น (ไม่ให้คะแนน ไม่อนุมัติ ไม่แก้ rubric ไม่จับสาย). **Committee** = สร้างทัวร์นาเมนต์/อีเวนต์ (S03), แก้ rubric (S12, สร้างเวอร์ชันใหม่), จับสาย/เผยแพร่ (S04), dashboard/อนุมัติ (S08/S09). ตารางด้านล่าง |
| 4 | Outlier | **align** | ไม่มี accept/return-for-review/exclude ต่อ item. Outlier ตรวจอัตโนมัติจากคะแนนรวมต่อ reviewer; UI แสดง **คำอธิบายอ่านอย่างเดียว** (`flags`, `excluded`, `robustZ`) + 3 action ระดับ assessment: **อนุมัติ / ส่งกลับให้รีวิวเพิ่ม / override** (เหตุผล ≥ 20 ตัวอักษร). OutlierTable = read-only; OutlierDrawer = คำอธิบาย + 3 ปุ่ม. แก้ D5: "ระบบตัดอัตโนมัติ (ตามกติกา G14) + Committee override ได้" |
| 5 | แหล่งคลิป | **align (ไม่มีลิงก์)** — ผมไม่ได้รับคำสั่งเจ้าของให้รองรับลิงก์ จึงถอนข้อเสนอลิงก์ | ClipInput = **อัปโหลดเท่านั้น** (presigned PUT → MinIO; mp4, ≤ 500 MB, ≤ 5 นาที, ≤ 3 คลิป) สถานะ `pending_upload/uploaded/rejected`. ตัด tab ลิงก์, ClipPlayer variant `embed`, allowlist host, D2 เดิม (แทนด้วยตัดสินใจ: ยืนยัน upload-only). เห็นด้วยว่าเป็นผลดีต่อ blind/retention/PDPA |
| 6 | Assessment vs Event | **align ชั่วคราวตามที่ Jim เสนอ** รอคำตอบเจ้าของ | แยก 2 flow: **(ก) ขอประเมิน** (Member: S05a อัปโหลดคลิป → ส่งขอ) และ **(ข) สมัครอีเวนต์** (S05: "สมัครด้วยเกรดที่อนุมัติแล้ว" + ถ้าไม่มี/นอกช่วง band → CTA "ขอประเมินเกรด"). F0/F2 ในไฟล์ flows ล้าสมัยในส่วนที่ผูกรีวิวกับอีเวนต์. สถานะอีเวนต์ `reviewing/approved` ถูกลบ (ดูข้อ 8) |
| 7 | สถานะรีวิว | **align** | สถานะที่ UI ใช้: `open / submitted / expired / declined`. **ไม่มี draft ฝั่งเซิร์ฟเวอร์**: ร่างเก็บใน browser storage เท่านั้น (บอกผู้ใช้ชัด: "ร่างอยู่ในเครื่องนี้เท่านั้น"; ห้ามอ้างว่าบันทึกข้ามอุปกรณ์). submitted = แก้ไม่ได้ (ตัด unlocked/ปลดล็อก, ตัด broken → ใช้ **"ปฏิเสธพร้อมเหตุผล"** เมื่อคลิปเล่นไม่ได้). โน้ต: **ช่องคอมเมนต์รวมเดียว**. **ขอ `CriterionScore.note` (optional) หรือไม่?** — ไม่จำเป็นสำหรับ v1; ตัดโน้ต/ปักเวลาต่อ item ออกจาก S07 (ถ้าเจ้าของอยากได้ ค่อยเพิ่มภายหลัง) |
| 8 | สถานะอีเวนต์ | **align** | ทัวร์นาเมนต์: `draft/open/closed/running/finished`; draw: `preview/published/superseded/locked`. ใช้ชื่อเหล่านี้ใน S04/S10; ตัดสถานะ `registration_*`, `reviewing`, `approved`, `bracket_published` ใน flows/S04 |
| 9 | Guest เห็นเกรดไหม | **ไม่เสนอให้เห็น band เป็นค่าเริ่มต้น — เห็นด้วยกับ architecture §3** | S10 สำหรับ Guest: ชื่อแสดง (ตามที่ผู้เล่นอนุญาต) + ทีม + คู่/ผลแมตช์ **ไม่มีเกรด**; เกรด band แสดงเฉพาะเมื่อเจ้าของโปรไฟล์ตั้งโปรไฟล์สาธารณะ (หรือ Member+ ตามที่ Jim กำหนด). เสนอเป็น owner decision แยก: "ผู้เล่นอนุญาตแสดงเกรดบน bracket สาธารณะ (opt-in) ไหม" (คำแนะนำ: opt-in) |

## Role × Screen (แทนตารางใน README)

| Screen | Guest | Member | Reviewer | Committee | Admin |
|---|:--:|:--:|:--:|:--:|:--:|
| S01 หน้าแรก/รายการอีเวนต์ | ✓ | ✓ | ✓ | ✓ | ✓ |
| S02 เข้าสู่ระบบ | ✓ | – | – | – | – |
| S03 สร้างทัวร์นาเมนต์/อีเวนต์ | – | – | – | ✓ | – |
| S04 จัดการอีเวนต์ + จับสาย | – | – | – | ✓ | ดูอ่านอย่างเดียว (TBD: Jim) |
| S05 สมัครอีเวนต์ด้วยเกรดที่อนุมัติ / S05a ขอประเมิน+อัปโหลดคลิป | – | ✓ | ✓* | ✓* | – |
| S06 คิวของ Reviewer | – | – | ✓ | ✓** | – |
| S07 หน้าให้คะแนน | – | – | ✓ | ✓** | – |
| S08 Dashboard | – | – | – | ✓ | – |
| S09 อนุมัติ/ส่งกลับ/override | – | – | – | ✓ | – |
| S10 สาย/สกอร์บอร์ดสาธารณะ | ✓ (ไม่มีเกรด) | ✓ | ✓ | ✓ | ✓ |
| S11 ผลของฉัน | – | ✓ | ✓ | ✓ | – |
| S12 Rubric (เวอร์ชัน) | – | – | – | ✓ แก้ | ดูอ่านอย่างเดียว |
| S13 ผู้ใช้/บทบาท/ทีม/audit (**ใหม่ — spec ภายหลัง**) | – | – | – | – | ✓ |

\* ห้ามสมัคร/ขอประเมินถ้ามีความขัดแย้งตามกฎ conflict · \*\* ถ้าได้รับมอบหมายเป็นกรรมการ (ต้องไม่ใช่ตนเอง/ทีมเดียวกัน)

## สิ่งที่ต้องเปลี่ยนใน components.md (สรุป)

| Component | การเปลี่ยน |
|---|---|
| ScoreInput | → `GradePicker`: props `value: GradeKey \| null`, `allowNA`, `anchorsByTier`, `onChange`; variants `tiered` (mobile: tier→ขั้น), `ladder` (desktop). state: empty/selected/na/locked |
| RubricItemCard | ตัด `note`, `requireNoteAtExtremes`, timestamp; น้ำหนักแสดงเป็นค่าสัมพัทธ์ |
| ClipInput | ตัด kind `link`, `allowedHosts`; props `maxSizeMB=500`, `maxDurationSec=300`, `maxClips=3`; state ตาม `Clip.status` |
| ClipPlayer | ตัด variant `embed`; ต้องรองรับ playback URL หมดอายุ (ตาม P3) |
| ReviewCard | status `open/submitted/expired/declined` (ตัด draft/unlocked/broken/overdue → `expired`) |
| OutlierTable / OutlierDrawer | read-only + 3 action (approve / return / override[reason ≥ 20]) |
| ApprovalRow | ตัดประเภท `unlock`, `brokenClip` |
| GradeBand | ใช้ชื่อ openapi: `score, margin, lower, upper, center, tier, kind, label` |
| ConfirmDialog | `minReasonLength` ค่าตั้งต้น 20 เมื่อใช้กับ override |
| ใหม่ | `AssessmentRequestCard`, `SaveLocalDraftNotice` (ป้ายร่างในเครื่อง) |

## การตัดสินใจเจ้าของ (แก้ชุดเดิม 5 ข้อ)

1. สไตล์ภาพ: pixel เฉพาะ S10 (เดิม D1)
2. คลิป: **upload-only** ตาม contract (แทน D2 เดิม)
3. Blind review: ซ่อนตัวตน/คะแนนคนอื่น; submitted ล็อกถาวร ไม่มีปลดล็อก (แก้ D3)
4. การแสดงเกรดต่อสาธารณะ: **opt-in ของเจ้าของโปรไฟล์** (แก้ D4)
5. Outlier: ระบบตัดอัตโนมัติตามกติกา + Committee ทำได้แค่ approve/ส่งกลับ/override พร้อมเหตุผล (แก้ D5)
6. (ส่งต่อจาก Jim) ขอบเขต: assessment แยกจาก event หรือผูกกัน

## คำถามกลับถึง Jim

- Admin เห็นหน้า S04/S12 แบบอ่านอย่างเดียวได้ไหม หรือไม่เห็นเลย (separation of duties)?
- บทบาทหลายอย่างในผู้ใช้คนเดียวได้ไหม (มีผลกับ role switcher และกฎ conflict)?
- Guest เห็นชื่อผู้เล่นบน bracket ได้เมื่อไร (ต้อง opt-in ด้วยไหม)?

## ผลตอบกลับจาก Jim (a)–(c) — ตกลงแล้ว

- **Admin อ่านอย่างเดียวบน S04/S12: ได้** — ซ่อน/ปิดทุกปุ่มที่แก้ข้อมูลสำหรับ Admin ที่ไม่มีบทบาท Committee
- **หลายบทบาทต่อผู้ใช้: ได้ (ข้อเสนอ A9 รอเจ้าของ)** — สิทธิ์เป็นยูเนียน, กฎ conflict ตรวจต่อการกระทำ; ใช้ role switcher หรือเมนูรวม
- **S10 สำหรับ Guest:** ชื่อแสดง + ทีม **สาธารณะโดยปริยาย**; **เกรด (score/lower/upper/label) ซ่อน** จนกว่าเจ้าของตอบเรื่อง opt-in. Member/Committee เห็นมุมมองเดียวกัน ยกเว้นเกรดของตนเอง (Member) และมุมมอง Committee. **ออกแบบ S10 ไม่มี GradeBand ไว้ก่อน**
