# Component guidelines (รวมศูนย์ v3) — blulens

> Pam · 2026-10-07 · **ไฟล์นี้แทนที่ components.md เดิมทั้งหมด** · แหล่งความจริงของ token = โค้ดที่ merge แล้ว `apps/web/app/globals.css` (ธีมอ่านง่ายแบบ shadcn; เจ้าของยืนยัน "ธีมอะไรก็ได้ UX เป็นหลัก") — **ไม่ใช้พาเลต daylight ของ bad8bit ในแอปทั่วไปอีกต่อไป** ใช้เฉพาะหน้าสาธารณะสายแข่ง (pixel/night, §2.3)
> ชื่อ/สถานะสเปกหน้าจออยู่ใน `demo-slice-1.md`, `demo-slice-2.md`, `demo-slice-3.md`, `mock-assessment-result.md` (ยึดสี่ไฟล์นี้ก่อน `S01–S18`) · ฟิลด์ตาม `docs/api/openapi.yaml`

## 1. หลักการ (ทุก component)

1. **UI แสดงอย่างเดียว ไม่คำนวณ**: score/lower/upper/label/kappa/bias/standings มาจาก API
2. **ไม่ใช้สีอย่างเดียวสื่อความหมาย**: ทุกสถานะ/ธง/ระดับ = ไอคอน + ข้อความ (+ สี)
3. **keyboard + screen reader**: ลำดับ Tab สมเหตุผล, `:focus-visible` ใช้ `--color-ring` 2px offset 2px, ทุกปุ่ม/ช่องมี accessible name, error ใช้ `role=alert`, สถานะบันทึกใช้ `aria-live=polite`
4. **เป้าสัมผัส**: ≥ 44×44 บนมือถือสำหรับการกระทำหลัก (≥ 56 สำหรับตัวนับแต้ม), ≥ 24 ที่อื่น; ห้ามเป้าทับกัน
5. **Mobile-first** (ฐาน 360): หน้า Reviewer/Umpire/Admin-เพิ่มคู่ ต้องใช้งานบนมือถือครบ; ตารางกว้างเปลี่ยนเป็นการ์ด < 768
6. **Component ฐาน (`components/ui`) รับ props เท่านั้น ไม่เรียก API**; data fetching อยู่ที่หน้า/hook
7. ทุก component ต้องมีตัวอย่าง/เทสต์ครบ state ตาม §3 และ contrast ผ่าน (§2.2)
8. ข้อความทุกตัวผ่าน i18n (ค่าเริ่มต้นไทย) ตามกฎ §4

## 2. Design tokens

### 2.1 ที่มีอยู่ในโค้ด (ใช้เป็นชื่อมาตรฐาน — ห้ามเพิ่ม hex ใหม่นอกตารางนี้ ถ้าต้องการสีใหม่ให้ขอ Pam เพิ่ม token)

| กลุ่ม | token (`--color-*`) | ใช้กับ |
|---|---|---|
| พื้น/ตัวอักษร | `background`, `foreground`, `card`, `card-foreground`, `muted`, `muted-foreground` | พื้นหน้า, ข้อความหลัก, การ์ด, ข้อความรอง/ป้ายเล็ก |
| การกระทำ | `primary(+foreground)`, `secondary(+foreground)`, `accent(+foreground)` | ปุ่มหลัก, ปุ่มรอง, ไฮไลต์/แถวเลือก |
| สถานะ | `success`, `warning`, `destructive` (+`-foreground`) | สำเร็จ/ยืนยัน, เตือน/ชั่วคราว, ผิดพลาด/ปฏิเสธ/ลบ |
| เส้น/โฟกัส | `border` (เส้นตกแต่ง), `input` (ขอบ control), `ring` (focus) | |
| เมนู | `sidebar*`, `sidebar-admin*` | แถบข้างตามบทบาท |
| รัศมี | `--radius-sm/md/lg` (0.3/0.45/0.6rem) | |
| ฟอนต์ | `--font-sans` = IBM Plex Sans Thai → Sarabun → system | ข้อความทั้งหมด (ไทยรองรับ) |

หน่วยระยะ: ใช้สเกล 4px (4/8/12/16/24/32/48); ความกว้างข้อความอ่านสบาย ≤ 72 ตัวอักษร; ปุ่มสูง 40 (md) / 44 (lg มือถือ)

### 2.2 Contrast (ตรวจตอน review)
- ข้อความ ≥ 4.5:1 บนพื้นที่วาง; ขอบ control และ focus ring ≥ 3:1
- ข้อความบน `warning` ใช้ `warning-foreground` เสมอ (เหลืองไม่ใช้เป็นสีข้อความบนพื้นขาว)
- ถ้าชนิดใดไม่ผ่าน ให้แก้ที่ token ไม่ใช่ที่ component; รายงานให้ Pam

### 2.3 หน้าสาธารณะสายแข่ง/ตารางกลุ่ม (pixel bad8bit) — token แยก
- พื้นกลางคืน: bg `#1c1926`, panel `#262234`, panel-2 `#2f2a40`, line `#7d7292`, text `#f3eee6`, muted `#a99fb4`, focus `#8f93ff`
- ฟอนต์: Press Start 2P **เฉพาะตัวเลข/ตัวย่อเกรด/หัวรอบ (ละติน)**; ข้อความไทยและชื่อคนใช้ `--font-sans` ห้าม pixel font กับอักษรไทย
- เส้นมุมฉาก 2px, ไม่โค้ง, ไม่ใช้เงาแข็งบนกรอบ UI; ขนาดภาพ/badge เป็นพหุคูณ 16 (`image-rendering: pixelated`); ปิดแอนิเมชันเมื่อ `prefers-reduced-motion`
- ขอบเขต: ใช้ใน `Bracket`, `MatchCard`, `GroupStandingsTable`, `PixelBadge`, `EmptyState` variant `pixel` เท่านั้น (scope ด้วย class/ตัวห่อ ไม่ปนกับ token แอป)

### 2.4 สีเกรด 5 tier (ใช้กับ GradeBand/LadderBar/GradePicker)
| Tier | ขั้น | สีฐาน (ชื่อ) | หมายเหตุ |
|---|---|---|---|
| Rookie | RK1–RK3 | เขียว | |
| Beginner | BG1–BG3 | น้ำเงิน | |
| Standard | S- S S+ | ม่วง | |
| Neutral | N- N N+ | ส้ม | |
| Professional | P- P P+ | เหลืองทอง (เป็นพื้น ข้อความบนพื้นใช้สีเข้ม) | |
- ตัวย่อเกรด (RK1…P+) และชื่อ tier เป็นข้อความเสมอ; สีเป็นตัวช่วย; ค่า hex ของ tier ต้องเพิ่มเป็น token (`--color-tier-1..5`) ในโค้ดก่อนใช้ (Andy: แพ็คเก็ตเล็ก; Pam ให้ค่า OKLCH ที่ผ่าน contrast เมื่อถูกขอ)

## 3. สถานะมาตรฐาน (ทุก component/หน้าที่เกี่ยวข้องต้องรองรับ)

| State | กติกา |
|---|---|
| default / hover / active | ตามปกติ; hover ไม่ใช่ตัวสื่อสารเดียว |
| focus-visible | วงแหวน `ring` 2px |
| disabled | ลดความเข้ม + **บอกเหตุผลที่อ่านได้** (tooltip/ข้อความใต้ปุ่ม) เมื่อผู้ใช้อาจสงสัยว่าทำไมกดไม่ได้ |
| loading (ปุ่ม) | disabled + spinner + `aria-busy`; คงความกว้างปุ่ม |
| loading (หน้า/ส่วน) | skeleton รูปร่างเดียวกับเนื้อหา ไม่ใช้ spinner เต็มหน้า |
| empty | ข้อความบอกว่า "ว่างเพราะอะไร" + ทางไปต่อ (ปุ่มหลัก 1 ปุ่มถ้ามีสิทธิ์) |
| error (ช่อง) | ข้อความใต้ช่อง ผูก `aria-describedby`; ไอคอน + ข้อความ |
| error (ส่วน/หน้า) | `ErrorBanner` + "ลองใหม่"; คงข้อมูลที่ผู้ใช้กรอก; ไม่ล้างฟอร์ม |
| ชนกัน/stale | "ดำเนินการแล้วโดย X / ข้อมูลเปลี่ยน" + รีเฟรชแถว/หน้า |
| 403 | หน้า "ไม่มีสิทธิ์" + ปุ่มกลับ; ไม่เผยว่ามีทรัพยากรอยู่หรือไม่ |
| 404 | "ไม่พบ" + ปุ่มกลับ |
| ออฟไลน์ | แบนเนอร์ค้าง; ร่างที่เก็บในเครื่องไม่หาย |
| สำเร็จ | `Toast` (aria-live) ข้อความสั้น + ไปต่อที่หน้าถัดไปที่ควรไป |

### 3.1 Empty / Error ที่ใช้บ่อย (ข้อความมาตรฐาน)
| สถานการณ์ | ข้อความ |
|---|---|
| รายการว่าง | "ยังไม่มี{สิ่งนั้น}" + ปุ่ม "{สร้าง/เพิ่ม}{สิ่งนั้น}" (เฉพาะผู้มีสิทธิ์) |
| ค้นหาไม่พบ | "ไม่พบ{สิ่งนั้น}ที่ตรงกับ “{คำค้น}”" + "ล้างการค้นหา" |
| ข้อมูลไม่พอสถิติ | "—" + tooltip "ข้อมูลไม่พอ ต้องมีอย่างน้อย …" (ห้ามแสดง 0 หรือ 1.0 แทน) |
| โหลดไม่สำเร็จ | "โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง" + ปุ่ม "ลองใหม่" |
| เครือข่ายหลุด | "เชื่อมต่อไม่ได้ ข้อมูลที่กรอกยังอยู่" |
| ไม่มีสิทธิ์ | "คุณไม่มีสิทธิ์เข้าหน้านี้" |
| ผลยังสรุปไม่ได้ (`latestResult` null) | "ยังสรุปผลไม่ได้" + สถานะ |

## 4. กฎข้อความไทย (Thai copy)

1. ภาษาสุภาพกระชับ ไม่ใช้ "คุณ" ซ้ำทุกประโยค; ปุ่ม = **กริยา + กรรม** ("สร้างทัวร์นาเมนต์", "ส่งให้ Committee", "ยืนยันผล") ไม่ใช้ "ตกลง/OK/Submit" ลอย ๆ
2. ปุ่มทำลาย/ย้อนไม่ได้ ระบุผลชัด ("ส่งและล็อก", "ถอนตัว") + dialog ยืนยันที่สรุปสิ่งที่จะเกิด
3. คำศัพท์คงที่ (ใช้ทั้งระบบ):
   - **คู่** = entry (ผู้เล่น 2 คน) · **สโมสร/ทีม** = teams · **กรรมการ** = Reviewer · **กรรมการสนาม (Umpire)** · **Committee** (เขียนอังกฤษตามที่ทีมใช้) · **ผลประเมิน** = assessment · **เกรด** (ตัวย่อ RK1…P+ เขียนอังกฤษเสมอ) · **ช่วงเกรด** = lower–upper
   - สถานะ: draft "ร่าง" · pending_committee "รอ Committee ตรวจ" · approved "อนุมัติแล้ว" · rejected "ถูกปฏิเสธ" · withdrawn "ถอนตัว" · provisional "ชั่วคราว (กรรมการ 1 คน)" · disputed "เห็นต่างกันมาก" · pending_approval "รออนุมัติ" · needs_reviewers "ต้องหากรรมการเพิ่ม" · reported "รอยืนยัน" · confirmed "ยืนยันแล้ว" · walkover "ไม่มาแข่ง"
4. ตัวเลข: ใช้เลขอารบิก; วันที่แสดงแบบไทย "7 ต.ค. 2569" (พ.ศ.) ในหน้าไทย, ISO ใน payload; เวลา 24 ชม. "16:05"; ทศนิยมของ score 2 ตำแหน่ง, margin 2 ตำแหน่ง, kappa 2 ตำแหน่ง
5. ข้อความ error: บอก **อะไรผิด + ทำอย่างไรต่อ** ("ปิดรับสมัครแล้ว — ติดต่อ Committee หากต้องการเพิ่มคู่"); ไม่ใช้รหัสดิบกับผู้ใช้ (แสดงรหัส 409 ใน details พับได้เฉพาะ Admin/Committee)
6. ห้ามอีโมจิ (ใช้ไอคอน lucide); ห้ามตัวพิมพ์ใหญ่ทั้งประโยค; ไม่ตัดคำไทยด้วยตัวเอง (ใช้ `word-break` ปกติของเบราว์เซอร์ + `overflow-wrap:anywhere` ในช่องชื่อ)
7. ความยาวป้าย/ปุ่ม ≤ 24 ตัวอักษรไทย; หัวข้อหน้า ≤ 40; ใช้ tooltip อธิบายคำเทคนิค (kappa, margin, outlier) ที่ที่ปรากฏครั้งแรก
8. อังกฤษ (สลับภาษา): คำศัพท์คู่ขนานในไฟล์ i18n เดียว ห้ามฝังข้อความในคอมโพเนนต์

## 5. แค็ตตาล็อก component

สถานะ: ✅ มีในโค้ดแล้ว (`apps/web/components`) · 🔲 ต้องสร้าง · ตรวจชื่อจริงในโค้ดก่อนเริ่ม; ถ้าชื่อต่างจากนี้ ให้ยึดชื่อในโค้ด

### 5.1 ฐาน/เลย์เอาต์
| Component | Props หลัก | Variants/State | สถานะ |
|---|---|---|---|
| AppShell / AuthedShell / SideNav / RoleGuard | `role(s)`, `user`, `children`; เมนูตาม `Me.permissions` | `app` `bare` `admin` | ✅ |
| Button | `label`, `onClick`, `disabled`, `loading`, `icon?` | `primary` `secondary` `ghost` `destructive`; `md` `lg` | ตรวจ/🔲 |
| TextField / Select / Toggle / Checkbox / RadioGroup | `label`, `value`, `onChange`, `error?`, `hint?`, `required?` | ตาม §3 | 🔲 |
| DateField / DateTimeField | `value`, `onChange`, `min?`, `max?` | | 🔲 |
| Tabs | `items[{id,label,count?}]`, `activeId` | `line` `pill`; deep link | 🔲 |
| StatusBadge | `status`, `label?` | `neutral info success warning danger`; ไอคอน+ข้อความ | 🔲 |
| ProgressBar / SaveIndicator | `value,max` / `state saving|saved|error` | `aria-live` | 🔲 |
| EmptyState / ErrorBanner / Toast | ตาม §3 | EmptyState `pixel` | 🔲 |
| ConfirmDialog | `title`, `body`, `confirmLabel`, `onConfirm`, `requireReason?`, `minReasonLength?` | `default` `destructive` | ✅ (ReasonDialog) |
| Stepper | `steps`, `current`, `onStep?` | `compact` | ✅ |
| DataTable | `columns`, `rows`, `onSort`, `loading`, `empty` | `table` `cards`(< 768) | 🔲 |
| StickyActionBar | `children` | safe-area | 🔲 |
| AuditTrail | `entries[{who,when,action,reason?}]` | | 🔲 |
| StatTile | `label`, `value`, `level?`, `onClick?` | ใช้เป็นตัวกรองได้ | 🔲 |
| FlagChip | `code` | `MULTI_TEAM` `UMPIRE_TEAM_CONFLICT` `COMMITTEE_DIRECT_ENTRY` `CORRECTED` `SINGLE_REVIEWER` `PAIR_DISAGREEMENT` `OUTLIER_EXCLUDED` `HIGH_DISAGREEMENT` `LOW_RATER_COUNT` `OVERRIDE` — ข้อความไทยตามตาราง §4.3 + tooltip | 🔲 |

### 5.2 เกรด/การประเมิน
| Component | Props | Variants/State | สถานะ |
|---|---|---|---|
| GradeBand | `score`, `margin?`, `lower`, `upper`, `center?`, `kind?`, `label?`, `tier?` | `compact` `default` `detail` (score±margin); null → GradeHiddenChip | ✅ |
| GradeRangeSelect | `min`, `max`, `onChange` | บันได 15 ขั้นจัดกลุ่ม 5 tier; min ≤ max | ✅ |
| GradeHiddenChip | – | ไอคอนล็อก + "ซ่อนอยู่" | 🔲 |
| GradePicker | `value: GradeKey|null`, `allowNA`, `anchorsByTier`, `onChange`, `disabled` | `tiered` (มือถือ: tier→ขั้นย่อย) `ladder` (desktop 15 ปุ่ม); empty/selected/na/locked | 🔲 |
| LadderBar | `lower`, `upper`, `score?`, `markers?` | `default` `compact` | 🔲 |
| RubricItemCard | `criterion{key,nameTh,weight,anchorsTh}`, `value`, `onChange`, `readOnly` | น้ำหนักเป็นข้อความเล็ก ไม่บังคับรวม 100 | 🔲 |
| ReviewCard | `assignmentId`, `state`, `dueAt`, `onOpen` | `open submitted expired declined` | 🔲 |
| ClipUploader | `maxSizeMB=500`, `maxDurationSec=300`, `maxClips=3`, `onUploaded` | `idle validating uploading(progress) uploaded rejected error` ; presigned PUT | 🔲 |
| ClipPlayer | `clips`, `onError`, `onTimeUpdate?` | `native`; ย้อน 5 วิ, 0.5/1/1.5x; URL หมดอายุ → ขอใหม่ 1 ครั้ง | 🔲 |
| SaveLocalDraftNotice | `savedAt?` | "ร่างอยู่ในเครื่องนี้เท่านั้น" | 🔲 |
| AgreementMatrix | `reviewers`, `cells[{a,b,kappa?,n,band}]`, `onCellClick?` | `empty insufficient ready`; ตัวเลข+ระดับข้อความทุกช่อง | 🔲 |
| ReviewerScoreList | `rows[{name,overall,excluded,robustZ,bias,pairKappa}]` | แกนเดียวกับ GradeBand | 🔲 |
| RaterTable / BiasCell | `rows` / `bias`,`n` | insufficient → "—" | 🔲 |
| AssessmentTable / AssessmentHeader | ตาม slice 2 | | 🔲 |
| AssignReviewerDialog / CalibrationResultsTable | | | 🔲 |

### 5.3 อีเวนต์/คู่/ผู้เล่น
| Component | Props | Variants/State | สถานะ |
|---|---|---|---|
| TournamentCard | `tournament`, `onOpen` | status `draft open closed running finished` | 🔲 |
| EventTypeCard / PresetRadioCards / SummaryList | | wizard ขั้น ③–④ | 🔲 |
| PlayerPicker / PlayerResultRow | `value`, `onSearch`, `onSelect`, `excludeIds`, `loading` | disabled: เลือกแล้ว/อยู่คู่อื่นแล้ว | 🔲 |
| TeamCombobox / TeamChip | `value`, `onSearch`, `onSelect`, `onRequestNew`, `teamCount` | ต้องเลือกจากรายการ; เตือนหลายสโมสร | 🔲 |
| WarningBanner | `variant (multiTeam…)`, `children` | | 🔲 |
| EntryApprovalRow / EntryRow | `entry`, `flags`, `onApprove`, `onReject(reason)`, `blocked` | status ตาม EntryStatus | ✅ (CommitteeQueue/AdminEntries ตรวจชื่อจริง) |
| PlayerTag | `name`, `team?`, `highlight?`, `withdrawn?` | `compact` `full` | 🔲 |

### 5.4 แมตช์/สาย/ตารางกลุ่ม
| Component | Props | Variants/State | สถานะ |
|---|---|---|---|
| MatchResultForm / GameScoreStepper / MatchFormatBadge | `format`, `games`, `onSubmit`, `error` / `value,min,max` / `format` | `fixed_games` `best_of`; scheduled/reported/returned/confirmed | 🔲 |
| ResultStatusBadge / ResultApprovalRow | `status` / `match,flags,onConfirm,onReturn(reason)` | scheduled reported confirmed walkover void bye | 🔲 |
| CourtPanel / UmpireChip / AssignmentTable | | | 🔲 |
| MatchCard | `match`, `entriesById` | `pixel`; status; ผู้ชนะ = ข้อความ+ไอคอน | 🔲 |
| Bracket | `rounds`, `entriesById`, `highlightEntryId?` | layout `tree` `list`; `pixel` | 🔲 |
| GroupStandingsTable / QualificationBadge | `rows`, `entriesById` / `qualification` | `pixel` | 🔲 |
| PixelBadge | `kind champion|runnerUp|third`, `size 16|32` | | 🔲 |

## 6. Definition of Done ต่อ component (ใช้ในทุก packet)

1. รองรับ state ตาม §3 ที่เกี่ยวข้อง และมีเทสต์ครอบ (อย่างน้อย: render ปกติ, loading/disabled, error, keyboard)
2. ข้อความมาจาก i18n; ไม่มี hex ใหม่; contrast ตาม §2.2
3. a11y: accessible name, role ถูกต้อง, ไม่พึ่งสีอย่างเดียว
4. ไม่เรียก API ใน `components/ui`
5. พิสูจน์บนมือถือ 390 (ไม่มี horizontal scroll ยกเว้นที่ตั้งใจ)
6. Pam review (ภาพ/พฤติกรรม) ก่อน merge สำหรับ component ที่ลูกค้าเห็น (GradeBand, Bracket, หน้า mock)

## 7. ลำดับสร้าง (เหลือ)

1. ฐาน 🔲 (Button/TextField/Select/Toggle/Tabs/StatusBadge/EmptyState/ErrorBanner/Toast/DataTable/FlagChip/StatTile)
2. GradePicker, LadderBar, RubricItemCard, ClipPlayer, ClipUploader, SaveLocalDraftNotice (slice 2 + mock)
3. PlayerPicker, TeamCombobox (+ wizard ชิ้นส่วน) (slice 1 ส่วนที่เหลือ)
4. Bracket/MatchCard/GroupStandingsTable (pixel scope) และชุด Umpire (slice 3)
