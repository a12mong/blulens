# Demo slice 3 (bl-24): สายแข่ง + ตารางกลุ่ม · Umpire "แมตช์ของฉัน" · คิวยืนยันผล · Calibration

> Pam · 2026-10-07 · markdown-first พร้อมสร้าง · ชื่อฟิลด์/endpoint ตาม `docs/api/openapi.yaml` บน develop · **เป็นฉบับละเอียดแทน S10 / S13 / S14 / S15 / S16 / S18 ของชุดแรกในส่วนที่ซ้ำ** (ยึดไฟล์นี้) · ไม่แก้ slice 1–2
> สถานะ: [WAITING FOR OWNER APPROVAL] ทีละกลุ่ม (ดูรายการตัดสินใจท้ายแต่ละกลุ่ม)

## กลุ่ม B: สายแข่ง + ตารางกลุ่ม (สาธารณะ, สไตล์ pixel bad8bit)

### B1 หน้า bracket/standings สาธารณะ — `/events/:eventId/bracket`

- API: `GET /events/{eventId}/bracket` → `Bracket {eventId, drawVersion, rounds[{round, matches[{matchNo, top, bottom, winner, status scheduled|bye|reported|confirmed|walkover}]}]}` · `GET /events/{eventId}/standings` → `GroupStanding[] {groupId, entryId, rank, played, won, drawn, lost, points, pointsFor, pointsAgainst, diff, tiebreakNote, qualification qualified|best_third|best_third_contender|out, confirmed}` · `GET /events/{eventId}/groups` (กลุ่ม + ตารางแข่ง) · ชื่อ entry มาจาก `GET /events/{eventId}/entries` (ชื่อ+สโมสร; **ไม่แสดงเกรด** เว้นแต่ `gradeVisibility` ≠ hidden และ API ส่งมา)
- บทบาท: ทุกคน รวม Guest (ผลที่เผยแพร่เท่านั้น: draw `published`/`locked`); ไม่เผยแพร่ → หน้าว่าง
- **สไตล์:** โทเคน night (`bg #1c1926`, `panel #262234`, `panel-2 #2f2a40`, line `#7d7292`) พื้นหน้านี้เสมอ; ตัวเลข/หัวรอบ/อันดับใช้ Press Start 2P (ละติน/ตัวเลขเท่านั้น); **ข้อความไทยและชื่อคนใช้ sans ปกติ**; เส้นสายมุมฉาก 2px ไม่โค้ง; ไอคอน lucide; ไม่ใช้เงาแข็งบนกรอบ UI; reduced-motion ปิดแอนิเมชัน; contrast ≥ 4.5 / 3

```
 เชียงใหม่ โอเพ่น · MD S-–S+       อัปเดต 14:32 (รีเฟรชอัตโนมัติ 30 วิ)
 [รอบกลุ่ม] [สายน็อคเอาท์] [ตารางแข่ง]
 ── กลุ่ม A ─────────────────────────────────────
 # │ คู่                 │ แข่ง │ ช/ส/พ │ ผลต่าง │ แต้ม │
 1 │ สมชาย/วิภา          │  3   │ 3/0/0 │ +24    │  9   │ ✓ เข้ารอบ
 2 │ อนันต์/มาลี         │  3   │ 2/0/1 │ +6     │  6   │ ✓ เข้ารอบ
 3 │ …                    │  3   │ 1/0/2 │ -9     │  3   │ ◔ ลุ้นอันดับ 3
 4 │ …                    │  3   │ 0/0/3 │ -21    │  0   │ ✕ ตกรอบ
 ⏱ มี 1 แมตช์รอยืนยัน (ยังไม่นับในตาราง)
```

**รอบกลุ่ม (GroupStandingsTable):** 1 การ์ดต่อกลุ่ม; คอลัมน์ตาม GroupStanding; `qualification` → ป้ายข้อความ+ไอคอน: qualified "เข้ารอบ ✓", best_third "เข้ารอบ (อันดับ 3 ที่ดีที่สุด)", best_third_contender "ลุ้นอันดับ 3", out "ตกรอบ"; `tiebreakNote` แสดงเป็นเชิงอรรถ "เสมอแต้ม ตัดสินด้วย: ผลต่างแต้ม"; `confirmed=false` → ป้าย "ตารางชั่วคราว" (ยังมีแมตช์ไม่ยืนยัน); ผลที่ `reported` แสดงในรายการแมตช์ใต้ตารางพร้อมป้าย **"รอยืนยัน"** (ไอคอนนาฬิกา+ข้อความ+tooltip "ยังไม่นับในตารางคะแนน")

**สายน็อคเอาท์ (Bracket):** desktop = ต้นไม้ซ้าย→ขวาตามรอบ (`rounds[].round`) หัวรอบ R16/QF/SF/F; มือถือ = accordion รายการตามรอบ + ปุ่ม "ดูผังเต็ม" เลื่อนแนวนอน; MatchCard: คู่บน/ล่าง (ชื่อ+สโมสร), คะแนนต่อเกม, ผู้ชนะ = ข้อความ "ชนะ" + ไอคอน (ไม่พึ่งสี); `status`: scheduled "รอแข่ง" · bye "BYE" · reported "รอยืนยัน" (ขอบประ; ผู้ชนะยังไม่เลื่อน) · confirmed (ปกติ) · walkover "ไม่มาแข่ง"; ผู้เล่นถอนตัว = ขีดฆ่า+"ถอนตัว"; มีตารางข้อความสำรอง (visually-hidden) ให้ screen reader

**ตารางแข่ง:** รายการแมตช์ตามสนาม/รอบ (court, status) เฉพาะที่เผยแพร่

| State | แสดง |
|---|---|
| ยังไม่เผยแพร่ | หน้าว่างแบบ pixel "สายแข่งยังไม่ประกาศ" + ปุ่มกลับ; Committee เห็นลิงก์ "ไปจัดการ" |
| loading | skeleton กล่องแมตช์/แถวตาราง |
| ตารางว่าง (ยังไม่แข่ง) | แถวคู่ + "0" ทุกคอลัมน์ + ข้อความ "ยังไม่เริ่มแข่ง" |
| error | แบนเนอร์ + แสดงข้อมูลแคชถ้ามี |
| สายถูกปรับ (supersede) | แบนเนอร์ "สายถูกปรับปรุง HH:MM (เวอร์ชัน N)" |
| `completed` | หยุดรีเฟรชอัตโนมัติ; แสดงแชมป์ (PixelBadge champion/runner-up) |
| ผู้ใช้ล็อกอิน | คู่ของตนไฮไลต์ + ป้าย "คุณ" (ข้อความ) |

Components: Bracket (`rounds`, `entriesById`, `highlightEntryId`; layout tree|list; variant pixel), MatchCard (`match`, status; variant pixel), GroupStandingsTable (`rows`, `variant pixel`), QualificationBadge, ResultStatusBadge, PlayerTag, PixelBadge(champion/runnerUp), Tabs, EmptyState(pixel), ErrorBanner

**ตัดสินใจ (ไทย):** ① หน้าสาธารณะใช้ธีมกลางคืน+pixel เฉพาะหน้านี้ ② Guest เห็นชื่อ/สโมสร/ผลแมตช์/ตารางกลุ่ม แต่ไม่เห็นเกรด ③ ผลที่ Umpire รายงานแต่ยังไม่ยืนยันแสดงสาธารณะพร้อมป้าย "รอยืนยัน" และยังไม่นับในตาราง/ไม่เลื่อนรอบ ④ รีเฟรชอัตโนมัติ 30 วิ

---

## กลุ่ม U: Umpire + คิวยืนยันผล + มอบหมายสนาม

### U1 แมตช์ของฉัน — `/umpire` (mobile-first)

- API: `GET /umpire/matches` → `Match[]` ของ Umpire นั้น (ที่ได้รับมอบหมาย/อยู่ในสนามของตน) · เขียนผล `PUT /matches/{id}/result` `{outcome played|walkover_a|walkover_b, games[{a,b}], reason?}` (422 `MATCH_SCORE_INVALID`) · บทบาท: Umpire (Committee กรอกแทนได้ → `confirmed` ทันที + ธง `COMMITTEE_DIRECT_ENTRY`)
- แต่ละการ์ด: สนาม (`court`), รอบ/กลุ่ม (`stage`,`round`), คู่ (ชื่อ+สโมสร), `status` (ข้อความ+ไอคอน), ปุ่ม "กรอกผล"/"แก้ผล"; ฟิลเตอร์: ถึงคิว/รอกรอก/รายงานแล้ว/ยืนยัน; เรียงตามสนาม+ลำดับ
- ห้ามกรอกแมตช์ที่ตนเป็นผู้เล่น (ปุ่มปิด+เหตุผล); มีสโมสรเดียวกับผู้เล่น → กรอกได้ + ป้ายเตือน (เซิร์ฟเวอร์ตั้งธง `UMPIRE_TEAM_CONFLICT`)

```
┌────────────────────────┐
│ แมตช์ของฉัน  [สนาม 1 ▼] │
│ [ถึงคิว][รอกรอก][รายงานแล้ว][ยืนยัน]│
│ ┌ สนาม 1 · กลุ่ม A รอบ 2 ┐│
│ │ สมชาย/วิภา              ││
│ │      vs  อนันต์/มาลี    ││
│ │ [รอกรอกผล]    [กรอกผล]  ││
│ └─────────────────────┘│
└────────────────────────┘
```

### U2 กรอกผลแมตช์ — `/umpire/matches/:id`

- รูปแบบแมตช์จาก `EventFormat.groupMatchFormat/knockoutMatchFormat`: `MatchFormat {preset group_2x15|single_30|bo3_21|single_21|custom, mode fixed_games|best_of, games, pointsPerGame, deuce, cap, drawAllowed}` → ป้ายสรุปบนหัวหน้า เช่น "2 เกม × 15 แต้ม ไม่มีดิวส์ เสมอได้" / "2 ใน 3 เกม × 21 ดิวส์ถึง 30"
- GameScoreStepper ต่อเกม (ปุ่ม +/− ≥ 56px + ช่องตัวเลข); `fixed_games` = ต้องครบทุกเกม; `best_of` = หยุดเมื่อมีผู้ชนะครบ ซ่อนเกมที่เกิน; ตรวจแต้มสด (ครบ pointsPerGame, ห่าง 2 ถ้า deuce, cap) → error ใต้เกม ปิดปุ่มส่ง (คำตัดสินสุดท้ายจากเซิร์ฟเวอร์ `422 MATCH_SCORE_INVALID` แสดงข้อความเดียวกัน); น็อคเอาท์ห้ามเสมอ
- ปุ่มรอง "ไม่มาแข่ง (walkover)" เลือกฝ่ายที่ไม่มา → `outcome walkover_a|walkover_b`
- สรุป: ผู้ชนะ/เสมอ + ผลต่างแต้ม → "รายงานผล" (dialog ยืนยัน) → `reported`; แก้ได้จนกว่ายืนยัน

| State | แสดง |
|---|---|
| scheduled | ฟอร์มว่าง |
| reported | ผลที่ส่ง + ป้าย "รอ Committee ยืนยัน"; แก้ได้ |
| ถูกตีกลับ | แบนเนอร์เหลือง + เหตุผล (status กลับเป็น scheduled); กรอกใหม่ |
| confirmed | read-only "ยืนยันแล้ว"; ถ้ามีธง `CORRECTED` ข้อความ "แก้ไขหลังยืนยัน" |
| ออฟไลน์ | ร่างอยู่ในเครื่อง (ไม่ส่งขึ้นเซิร์ฟเวอร์) + "ยังไม่ได้ส่ง"; ส่งเมื่อกลับมา |
| ชนกัน | "แมตช์นี้ถูกยืนยันแล้ว" |
| 403/แมตช์ที่ตนเป็นผู้เล่น | ปุ่มปิด+เหตุผล |

Components: MatchResultForm, GameScoreStepper, MatchFormatBadge, ResultStatusBadge, FlagChip, StickyActionBar, ConfirmDialog, SaveLocalDraftNotice

### U3 คิวยืนยันผลแมตช์ (Committee) — `/committee/events/:id/results`

- API: รายการแมตช์ `status=reported` (จาก `GET /events/{id}/groups` + bracket หรือ endpoint รายการ — **TBD-API: ขอ `GET /events/{id}/matches?status=reported` จาก Jim**) · `POST /matches/{id}/result/approve` · `POST /matches/{id}/result/reject {reason}` · แก้ผลที่ confirmed = `PUT /matches/{id}/result` พร้อม `reason`
- แถว: แมตช์/สนาม/คู่ · ผลต่อเกม + ผู้ชนะ · ผู้รายงาน+เวลา (`reportedBy`,`reportedAt`) · ธง (`UMPIRE_TEAM_CONFLICT` "Umpire สโมสรเดียวกับผู้เล่น", `COMMITTEE_DIRECT_ENTRY` "Committee กรอกเอง", `CORRECTED` "แก้ไขหลังยืนยัน" + ลิงก์ audit `GET /audit-logs`) · ปุ่ม ยืนยัน / ตีกลับ (เหตุผลบังคับ) / แก้ผลเอง (เหตุผลบังคับ)
- ยืนยันกลุ่มเฉพาะแถวที่ไม่มีธง; "ยืนยันผลรอบกลุ่ม" (`POST /events/{id}/groups/confirm`) เปิดเมื่อทุกแมตช์กลุ่ม `confirmed/void` พร้อมสรุปผู้เข้ารอบก่อนกด
- States: ว่าง "ไม่มีผลรอยืนยัน" · มีธง → แบนเนอร์+ตัวกรอง · กำลังยืนยัน spinner/คืนค่าเมื่อผิดพลาด · ชนกัน "ดำเนินการแล้วโดย X" · Admin: อ่านอย่างเดียว

### U4 มอบหมาย Umpire/สนาม (Committee) — `/committee/events/:id/umpires`

- API: `GET/PUT /events/{id}/umpires` (`EventUmpire {userId, displayName, courts[]}` ว่าง = ทุกสนาม) · รายแมตช์ `PATCH /matches/{id}/assignment {court, umpireId}`
- UI: แผงสนาม + UmpireChip (เพิ่ม/ลบ), ตารางแมตช์ × (สนาม, Umpire) แก้ inline; ผู้เล่นในแมตช์เลือกเป็น Umpire ไม่ได้ (disabled+เหตุผล); สโมสรเดียวกัน = เลือกได้พร้อมคำเตือน; ปุ่ม "มอบหมายอัตโนมัติ" (ถ้ามี; TBD); แมตช์ที่ยังไม่มี Umpire = แบนเนอร์เตือน (ไม่บล็อก); บันทึก = PUT ทั้งชุด + toast; ว่าง "ยังไม่มี Umpire — เพิ่มจากรายชื่อผู้ใช้บทบาท Umpire" (ใช้ `GET /users?role=Umpire`)

Components: CourtPanel, UmpireChip, AssignmentTable (inline edit), ResultApprovalRow, ConfirmDialog(reason), FlagChip, DataTable, EmptyState, Toast

**ตัดสินใจ (ไทย):** ① Umpire กรอกผลบนมือถือ เก็บร่างในเครื่อง (สนามสัญญาณอ่อน) ② ผลที่ Umpire ส่งต้องให้ Committee ยืนยันก่อนนับ (ตามที่เจ้าของสั่ง) ③ Committee กรอก/แก้ผลเองได้แต่ต้องมีเหตุผลและมีธง "แก้ไขหลังยืนยัน" ④ Umpire ที่อยู่สโมสรเดียวกับผู้เล่นกรอกได้แต่ติดธงให้ Committee เห็น

---

## กลุ่ม K: Calibration (ชุดคลิปมาตรฐาน; G19 = (b) อนุมัติแล้ว)

### K1 รายการ/สร้างชุด (Committee) — `/committee/calibration`

- API: `GET /calibration-sets` · `POST /calibration-sets {name, period}` · เพิ่มคลิป `POST /calibration-sets/{setId}/clips/upload-url {fileName, contentType video/mp4|video/quicktime, sizeBytes ≤ 500MB, referenceKey}` → `{clipId, uploadUrl, expiresAt}` แล้ว PUT ตรงไป MinIO (เหมือน ClipUploader ของใบประเมิน) · มอบหมาย `POST /calibration-sets/{setId}/assign` · ผล `GET /calibration-sets/{setId}/results`
- รายการ: ชื่อ, รอบ (เช่น 2026-Q4), จำนวนคลิป, สถานะ (ร่าง/เผยแพร่/มอบหมายแล้ว), ความคืบหน้ากรรมการ x/y
- สร้างชุด (หน้าเดียว): ชื่อ+รอบ → ตารางคลิป: แถวต่อคลิป = ClipUploader (progress/ยกเลิก/ลองใหม่/rejected) + **GradePicker 1 ค่าเกรดอ้างอิงต่อคลิป (ภาพรวม ไม่ใช่ต่อหัวข้อ; บังคับก่อนอัปโหลด เพราะ API ต้องการ `referenceKey`)** → เลือกกรรมการ (multi-select; conflict ตามเซิร์ฟเวอร์) → "มอบหมาย"
- ผลชุด (`results`): ต่อกรรมการ `biasVsReference` (ขั้น + ข้อความทิศทาง เช่น "+0.4 ขั้น: ให้สูงกว่าเกณฑ์") และ `meanAbsError` (ขั้น); ตารางคลิป × กรรมการ เทียบเกรดอ้างอิง; ข้อมูลไม่พอ → "—"
- **กฎ blind:** ฝั่งกรรมการ calibration หน้าตาเหมือนงานจริงทุกประการ (ใช้ R2 เดิม; API ซ่อนชนิดงาน) — UI ห้ามมีป้าย/ข้อความ/เส้นทางที่เผยว่าเป็นชุดมาตรฐาน; กรรมการไม่เห็นเกรดอ้างอิงหรือ bias จนกว่า Committee เผยแพร่ผล (ถ้าจะเผย)

| State | แสดง |
|---|---|
| ไม่มีชุด | "ยังไม่มีชุดมาตรฐาน" + ปุ่มสร้าง |
| ร่าง | แก้ได้ (เพิ่ม/ลบคลิป เปลี่ยนเกรดอ้างอิง) |
| มอบหมายแล้ว | ล็อกคลิป+เกรดอ้างอิง (เวอร์ชันใหม่ถ้าต้องแก้) |
| อัปโหลดล้มเหลว/ถูกปฏิเสธ | ข้อความต่อแถว + ลองใหม่ |
| ผลยังไม่ครบ | แสดงเฉพาะที่ส่งแล้ว + "รอ x/y" |
| ไม่ใช่ Committee | 403 |

Components: CalibrationSetCard, ClipUploader (ใช้ซ้ำ), GradePicker (tiered), ReviewerMultiSelect, CalibrationResultsTable, BiasCell (`bias`, `n`; insufficient → "—"), ConfirmDialog, EmptyState, ErrorBanner

**ตัดสินใจ (ไทย):** ① กรรมการแยกไม่ออกว่าคลิปไหนเป็นชุดมาตรฐาน ② เกรดอ้างอิงเป็นเกรดภาพรวมต่อคลิป (1 ค่า) ③ เห็น bias/ความคลาดเคลื่อนเฉพาะ Committee ก่อน ผู้ถูกวัดจะเห็นของตนเองหรือไม่ให้ Committee เลือกภายหลัง

---

## ลำดับสร้างสำหรับ Andy

1. B: GroupStandingsTable + QualificationBadge + MatchCard + Bracket (pixel night) + หน้า B1 (ใช้ mock ถ้า draw ยังไม่เผยแพร่)
2. U: GameScoreStepper + MatchResultForm (validate ตาม MatchFormat) → U1/U2 → ResultApprovalRow → U3 → U4
3. K: ClipUploader (ใช้ซ้ำ) + GradePicker → K1 → CalibrationResultsTable

## คำถามเปิดสำหรับ Jim

1. `GET /events/{id}/matches?status=` (คิวผลรอยืนยัน + ตารางแข่ง) มีไหม — ถ้าไม่ ขอเพิ่ม
2. ชื่อ entry ในบรา็กเก็ต/ตาราง (`top`/`bottom`/`entryId`) ให้ผ่าน entries endpoint ที่ Guest เรียกได้หรือขอฟิลด์ย่อ `displayName`/`team` ใน Bracket/GroupStanding
3. มอบหมาย Umpire อัตโนมัติมีไหม
4. ผล calibration ให้กรรมการเห็นของตนเองได้ไหม (ตัวเลือกภายหลัง)
