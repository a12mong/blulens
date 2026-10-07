# blulens — ชุดสเปกดีไซน์ (bl-05)

> ⚠ **ถูกกำกับโดย `contract-alignment.md` (v2)** — ข้อความที่ขัดกับไฟล์นั้น (สเกล 15 ขั้น, upload-only, สิทธิ์ Admin/Committee, outlier, สถานะรีวิว/อีเวนต์, การมองเห็นเกรดของ Guest) ให้ยึดไฟล์นั้น

> ผู้เขียน: Pam (Lead Design) · สถานะ: **ฉบับร่างรออนุมัติ — [WAITING FOR OWNER APPROVAL]**
> ห้ามสร้าง task ให้ Dev จากเอกสารนี้ จนกว่า god จะแจ้งว่าเจ้าของอนุมัติ
> ชื่อฟิลด์/endpoint ทั้งหมดที่ติด `TBD-API` ยังไม่ผูกกับ `openapi.yaml` ของ Jim (ยังไม่ออก ณ 2026-10-07) — ต้องจัดให้ตรงกันก่อนส่ง Andy

## สารบัญ

| ไฟล์ | เนื้อหา |
|---|---|
| `flows.md` | flow ครบทุกบทบาท (mermaid) |
| `screens/S01-public-home.md` … `S12-rubric-editor.md` | สเปกต่อหน้าจอ: วัตถุประสงค์ · บทบาท · wireframe · states · empty/error · ข้อมูล |
| `contract-alignment.md` | **v2: จัดให้ตรง API contract (ยึดไฟล์นี้ก่อน)** |
| `v3-umpire-grading-v2.md` | v3: Umpire, ผล 2 ขั้น, provisional/disputed, S13–S16 |
| (S17 S18 เพิ่มใน v3) | `screens/S17-team-requests.md`, `S18-group-draw-standings.md` |
| `demo-slice-1.md` | **bl-21: login / สร้างอีเวนต์ / สมัคร+ทีม type-ahead / รายชื่อผู้สมัคร (พร้อมสร้างทันที)** |
| `fe-questions.md` | คำตอบ P1–P5 ของ Andy |
| `components.md` | ชื่อ component · props · variants · state (หน่วยงานของ Andy → 1 component = 1 packet) |

## บทบาท (5 บทบาท)

| บทบาท | คือใคร | สิ่งที่ทำได้ (สรุป) |
|---|---|---|
| **Guest** | ผู้ชมที่ไม่ล็อกอิน | ดูรายการอีเวนต์สาธารณะ, สายแข่ง, สกอร์บอร์ด (เฉพาะที่เผยแพร่แล้ว) |
| **Member** | นักกีฬา/ผู้สมัครที่ล็อกอิน | สมัครอีเวนต์ แนบคลิป (ลิงก์/อัปโหลด) ดูสถานะและผลของตนเอง |
| **Reviewer** | กรรมการประเมินคลิป | ดูคิวคลิปที่ได้รับมอบหมาย ให้คะแนนตาม rubric (แบบ blind) |
| **Committee** | Super-Committee | ดู dashboard ความสอดคล้อง/outlier, อนุมัติผล, มอบหมาย reviewer, สั่งจับสาย |
| **Admin** | ผู้ดูแลระบบ | ทุกอย่างของ Committee + สร้างอีเวนต์, rubric, จัดการผู้ใช้/บทบาท |

หลักการ: บทบาทซ้อนกันแบบขยาย (Admin ⊇ Committee ⊇ Reviewer-view ⊇ Member ⊇ Guest) **ยกเว้น** กฎ blind-review: Committee/Admin ที่เป็น Reviewer ของคลิปนั้นเอง ต้องเห็นเหมือน Reviewer (ไม่เห็นคะแนนคนอื่นจนกว่าจะล็อกคะแนนตัวเอง) และผู้ใช้เห็นคลิปของตัวเองเป็น Reviewer ไม่ได้ (conflict of interest)

### Role × Screen matrix

| Screen | Guest | Member | Reviewer | Committee | Admin |
|---|:--:|:--:|:--:|:--:|:--:|
| S01 หน้าแรกสาธารณะ/รายการอีเวนต์ | ✓ | ✓ | ✓ | ✓ | ✓ |
| S02 เข้าสู่ระบบ/สมัครสมาชิก | ✓ | – | – | – | – |
| S03 สร้างอีเวนต์ (wizard) | – | – | – | – | ✓ |
| S04 จัดการอีเวนต์ | – | – | – | ✓ (ดู+จัดสาย/มอบหมาย) | ✓ (ทั้งหมด) |
| S05 ฟอร์มสมัคร + คลิป | – (ชวนล็อกอิน) | ✓ | ✓ | ✓ | ✓ |
| S06 คิวของ Reviewer | – | – | ✓ | ✓ | ✓ |
| S07 หน้าให้คะแนน | – | – | ✓ (เฉพาะที่ได้รับมอบหมาย) | ✓ | ✓ |
| S08 Dashboard Super-Committee | – | – | – | ✓ | ✓ |
| S09 คิวอนุมัติ | – | – | – | ✓ | ✓ |
| S10 สายแข่ง/สกอร์บอร์ดสาธารณะ | ✓ | ✓ | ✓ | ✓ | ✓ |
| S11 ผลของฉัน | – | ✓ | ✓ | ✓ | ✓ |
| S12 ตัวแก้ rubric | – | – | – | ดู | ✓ |

## สมมติฐาน (Assumptions)

1. คะแนนผลลัพธ์ใช้รูปแบบ bad8bit: `score` + `lower` + `upper` (grade key ขอบล่าง/บน) — UI **แสดงเท่านั้น** ไม่คำนวณเอง (สมการอยู่ที่ bl-03 รออนุมัติ)
2. คะแนนต่อ rubric item เป็นจำนวนเต็มบนสเกลที่ Admin กำหนดต่อ item (ค่าเริ่มต้น 1–5) — ถ้า bl-03 เปลี่ยนสเกล ต้องแก้ S07/C-ScoreInput
3. Reviewer ให้คะแนนแบบ blind: ไม่เห็นชื่อ/ทีม/คะแนนของ reviewer คนอื่น
4. คลิปอัปโหลดเก็บใน MinIO ผ่าน presigned URL (ผู้ใช้อัปโหลดตรง ไม่ผ่าน API proxy); คลิปลิงก์ภายนอกเก็บเป็น URL
5. ภาษา UI เริ่มที่ไทย (+อังกฤษ) ตัวอักษร pixel (Press Start 2P) ใช้กับตัวเลข/ละติน ห้ามใช้กับข้อความไทย (ตาม style guide)
6. Visual: แอปทั่วไปใช้โทเคน "daylight/night" (design-tokens T5) ส่วน **S10 สายแข่ง/สกอร์บอร์ด** ใช้สไตล์ pixel 'bad8bit' เต็มรูปแบบ (ธีม night + court + เงาแข็ง) — ดูข้อ O1
7. Mobile-first สำหรับ S05 และ S07 (ออกแบบที่ 360 px ก่อน, แล้วขยาย ≥768 px); เป้าสัมผัส ≥ 44×44 บนปุ่มหลัก (T4)
8. Accessibility: contrast ≥ 4.5:1 (ข้อความ) / ≥ 3:1 (ขอบ control, focus) ตาม T5.2; ไม่ใช้สีอย่างเดียวสื่อความหมาย (outlier ต้องมีไอคอน+ข้อความ)

## การตัดสินใจที่เจ้าของต้องทำ (สรุป 5 ข้อ — รายละเอียดใน Open Questions ท้ายไฟล์)

| # | เรื่อง | คำแนะนำของ Pam |
|---|---|---|
| D1 | **สไตล์ภาพ**: pixel เต็มทั้งแอป หรือเฉพาะสายแข่ง/สกอร์บอร์ด | pixel เฉพาะ S10 (+badge/ไอคอนเกม); ที่เหลือใช้ daylight/night เพื่ออ่านง่ายกับข้อความไทยและฟอร์มยาว |
| D2 | **คลิป**: รับทั้ง "ลิงก์" และ "อัปโหลด"? จำกัดแหล่งลิงก์/ขนาด/ความยาว | รับทั้งสอง · ลิงก์เฉพาะ YouTube/Google Drive/Vimeo/TikTok · อัปโหลด ≤ 200 MB, ≤ 90 วินาที, mp4/mov/webm · เล่นลิงก์แบบ embed (ถ้า embed ไม่ได้ → ปุ่มเปิดแท็บใหม่) |
| D3 | **Blind review**: ซ่อนตัวตนผู้สมัครและคะแนนคนอื่นจากกรรมการ; ล็อกคะแนนแล้วแก้ไม่ได้? | ซ่อนทั้งคู่ · reviewer บันทึกร่างได้ แต่ "ส่ง" แล้วล็อก (Committee ปลดล็อกได้พร้อมเหตุผล + audit log) |
| D4 | **การเผยแพร่ผล**: ใครกดเผยแพร่สายแข่ง/ผลสู่ Guest และ Guest เห็นระดับไหน (ชื่อ+เกรด band หรือแค่ลำดับ) | Committee อนุมัติ (S09) → เผยแพร่; Guest เห็นชื่อแสดง + เกรด band (lower–upper) ไม่เห็นคะแนนต่อ rubric/คะแนนต่อ reviewer |
| D5 | **การจัดการ outlier**: ระบบแค่ "ติดธง" หรือตัดคะแนนอัตโนมัติ | ติดธงเท่านั้น; Committee ตัดสินใจ (ยอมรับ/ขอ re-review/ตัดออก) ใน S09 — ไม่มีการตัดอัตโนมัติ |

## คำถามเปิด (Open Questions)

| # | คำถาม | ผลต่อสเปก |
|---|---|---|
| O1 | = D1 | S10, components (tokens) |
| O2 | = D2 | S05, C-ClipInput, C-ClipPlayer |
| O3 | = D3 | S07 (state locked), S09 |
| O4 | = D4 | S09, S10, S11 |
| O5 | = D5 | S08, S09 |
| O6 | สมัครสมาชิกเอง (self-signup) หรือ Admin เชิญเท่านั้น? (Reviewer/Committee เป็นแบบเชิญเสมอ — สเปกสมมติว่า Member สมัครเองได้) | S02 |
| O7 | อีเวนต์เป็นทีม หรือรายบุคคล? (กติกาจับสาย "ห้ามทีมเดียวกันเจอกันรอบแรก" บ่งว่ามี `team`) — S05 มีช่อง team (TBD-API) | S05, S10 |
| O8 | สายแข่งหลังตัดเกรดจากคลิป: คลิปประเมินใช้ seed/แบ่งกลุ่มสายหรือไม่? (ขึ้นกับ bl-04) | S04, S10 |
| O9 | เกณฑ์ของ "ค่าความสอดคล้องดี/เตือน/แย่" (สีและข้อความบน dashboard) ต้องมาจาก bl-03 | S08 |

## การจัดแนวกับ API (TBD-API)

ชื่อที่ใช้ในสเปกนี้ (ปรับให้ตรง Jim ภายหลัง): `Event`, `Registration`, `Clip {kind: link|upload, url|objectKey, durationSec}`, `Rubric/RubricItem`, `Assignment`, `Review/ItemScore`, `Result {score, lower, upper}`, `Agreement {kappa, n}`, `OutlierFlag`, `Approval`, `Bracket/Match`.
