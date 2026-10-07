# v3 addendum: Umpire, ผลแมตช์ 2 ขั้น, grading v2 (provisional/disputed)

> Pam · 2026-10-07 · อ้าง `tournament-format.md` §5.1, `grading.md` §12 · สถานะ: ร่าง [WAITING FOR OWNER APPROVAL] · มีผลเหนือไฟล์เดิมเมื่อขัดกัน (รองจาก contract-alignment.md เฉพาะเรื่องที่ซ้ำกัน)

## 1. บทบาทที่ 6: Umpire

- ทำได้: S13 "แมตช์ของฉัน" กรอก/แก้ผลแมตช์ที่มอบหมายจนกว่ายืนยัน; ดู S10; ไม่เห็นเกรด/รีวิว
- Matrix เพิ่ม: S13 ✓ Umpire (Committee กรอกแทน) · S14/S15 Committee แก้, Admin ดูอ่านอย่างเดียว · S16 Committee/Reviewer · S10 ทุกบทบาท · หลายบทบาทต่อผู้ใช้ = union (A9)

## 2. S10 สาธารณะ: ตารางกลุ่ม + ป้าย "รอยืนยัน"

- แท็บใหม่ **"รอบกลุ่ม"**: ตารางต่อกลุ่ม: อันดับ · entry (ชื่อ+ทีม) · แข่ง · ชนะ/เสมอ/แพ้ · ผลต่างแต้ม · แต้ม; แถวเข้ารอบมีป้าย "เข้ารอบ" (ข้อความ+ไอคอน); pixel style (Press Start 2P เฉพาะตัวเลข)
- ตารางนับเฉพาะ `confirmed`; ผล `reported` แสดงในรายการแมตช์พร้อมป้าย **"รอยืนยัน"** (ไอคอนนาฬิกา+ข้อความ) และ tooltip "ยังไม่นับในตารางคะแนน"
- สายน็อคเอาท์: MatchCard status เพิ่ม `reported` (ผลชั่วคราว ขอบประ + ป้าย) ผู้ชนะไม่เลื่อนในสายจนกว่า `confirmed`
- Guest ยังไม่เห็นเกรด

## 3. Grading v2 ใน S05/S07/S08/S09/S11

| เรื่อง | UI |
|---|---|
| **provisional** (กรรมการ 1 คน) | ป้าย "ชั่วคราว" + GradeBand กว้าง (margin 1.0) + ข้อความ "ประเมินโดยกรรมการ 1 คน"; S09 มีปุ่ม **ยืนยัน** → approved; ผู้เล่นสมัคร/จัด seed ไม่ได้จนกว่ายืนยัน (S05: "รอ Committee ยืนยันเกรด") |
| **2 กรรมการ** | GradeBand ตาม margin ใหม่; ห่าง > 2.0 ขั้น → ธง `PAIR_DISAGREEMENT` + ปุ่ม "มอบหมายกรรมการคนที่ 3" |
| **disputed** | ป้าย "เห็นต่างกันมาก" + spread/margin; Committee: อนุมัติพร้อมหมายเหตุ / ส่งกลับ / override |
| **ความเห็นที่สอง** | Member ขอได้ 1 ครั้ง/14 วัน (S11 ปุ่ม + สถานะ); Committee เปิดได้เอง |
| S08 | StatTile ใหม่ "ชั่วคราว n", "เห็นต่าง n"; AgreementMatrix แสดง pairKappa ("—" เมื่อข้อมูลน้อย) + คอลัมน์ reviewerBias |

Flags: `SINGLE_REVIEWER`, `PAIR_DISAGREEMENT` (+ เดิม)

## 4. Contract changes ที่เจ้าของอนุมัติแล้ว (เข้า S05)

- A8 ทีม = combobox type-ahead + "ขอเพิ่มทีมใหม่" · A11 หลายทีมได้ + คำเตือนจำนวนทีมที่สังกัด · A13 เกรดถาวรใช้ข้ามอีเวนต์ แต่อีเวนต์ขอประเมินใหม่ได้ → สถานะ "ต้องประเมินใหม่สำหรับอีเวนต์นี้" · A14 การเห็นเกรด = ตั้งต่อ entry (ค่าเริ่มต้น ซ่อน) + Committee/Admin "เปิดเผยเพื่อความโปร่งใส" พร้อมเหตุผล (ปุ่มใน S08/S09 + บันทึก audit)

## 5. Components ใหม่

| Component | Props | Variants/States |
|---|---|---|
| MatchResultForm | `format`, `games`, `onSubmit`, `error` | `fixed_games` `best_of`; scheduled/reported/returned/confirmed |
| GameScoreStepper | `value`, `min`, `max`, `onChange` | ปุ่ม ≥ 56px |
| MatchFormatBadge | `format` | – |
| ResultStatusBadge | `status` (scheduled/reported/confirmed/void) | reported = ไอคอน+ข้อความ |
| ResultApprovalRow | `match`, `flags`, `onConfirm`, `onReturn(reason)` | blocked |
| GroupStandingsTable | `rows`, `advanceCount` | `pixel` |
| CourtPanel / UmpireChip | `court`, `umpires`, `onAdd/onRemove` | – |
| FlagChip | `code` | UMPIRE_TEAM_CONFLICT, SINGLE_REVIEWER, PAIR_DISAGREEMENT |
| ProvisionalBadge / DisputedBadge | `reason?` | – |
| BiasCell | `bias`, `n` | insufficient → "—" |
| CalibrationSetCard | `set`, `progress` | – |
| TeamCombobox | `value`, `onSearch`, `onRequestNew`, `teamCount` | A8/A11 |
| DiscloseGradeDialog | `onConfirm(reason)` | A14 |

## 6. การตัดสินใจเจ้าของ (เพิ่ม)

1. Umpire ใช้มือถือ + ร่างออฟไลน์ในเครื่อง (สนามสัญญาณอ่อน) ตกลงไหม
2. ผล `reported` แสดงสาธารณะพร้อมป้ายรอยืนยัน (ตามที่สั่ง) — ให้ปิดได้ต่อรายการไหม
3. ชุด calibration (G19) มีใน v1 หรือไม่
4. Admin เห็น S14/S15 อ่านอย่างเดียวหรือไม่เห็นเลย
