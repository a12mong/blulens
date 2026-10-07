# Component guidelines — blulens

> ⚠ **ถูกกำกับโดย `contract-alignment.md` (v2)** — ข้อความที่ขัดกับไฟล์นั้น (สเกล 15 ขั้น, upload-only, สิทธิ์ Admin/Committee, outlier, สถานะรีวิว/อีเวนต์, การมองเห็นเกรดของ Guest) ให้ยึดไฟล์นั้น

> สำหรับ Andy แตกเป็น packet 1 component = 1 งาน. ชื่อ props เป็นข้อเสนอ (TS-style ในตาราง = ชนิดข้อมูลเพื่ออธิบาย ไม่ใช่โค้ด). สถานะ: ร่างรออนุมัติ.

## กฎทั่วไป

- ชื่อ `C-Name` ในสเปก = component `Name` (PascalCase) ใน `apps/web/src/components/`; โมดูลเฉพาะโดเมนอยู่ใต้ `modules/<domain>/`
- สี/ระยะ/เงา/รัศมี ใช้โทเคนจาก `bad8bit/team/design-tokens.md` T5 (daylight/night) เท่านั้น ห้ามค่า hex ใหม่
- ทุก component: รองรับ keyboard, `:focus-visible` (`--color-focus`), เป้า ≥ 24px (primary mobile ≥ 44px), contrast ตาม T5.2
- ทุก component ที่แสดงสถานะ ต้องมีข้อความ/ไอคอนควบคู่สี
- ทุก component มี state ตามตาราง (default/hover/focus/disabled/loading/error ที่เกี่ยวข้อง) และ story/ตัวอย่างหน้าทดสอบ
- ข้อความ UI ผ่าน i18n (ไทยเริ่มต้น)
- Pixel font: เฉพาะตัวเลข/ละติน ใน C-Bracket, C-Scoreboard, C-PixelBadge, C-GradeBand(variant pixel)

## A. พื้นฐาน

| Component | Props หลัก | Variants | หมายเหตุ/Acceptance |
|---|---|---|---|
| **Button** | `label`, `onClick`, `disabled`, `loading`, `icon?`, `fullWidth?` | `primary` `secondary` `ghost` `danger`; size `md` `lg`(mobile 44) | loading = disabled + spinner + aria-busy |
| **TextField** | `label`, `value`, `onChange`, `error?`, `hint?`, `required?`, `type` | `text` `email` `password` `url` `multiline` | label เชื่อม input; error ผูก aria-describedby |
| **Checkbox / RadioGroup** | `options`, `value`, `onChange`, `label` | – | กลุ่ม radio รองรับลูกศร |
| **DateRangeField** | `start`, `end`, `onChange`, `error?` | – | ตรวจ end > start |
| **NumberField** | `value`, `min`, `max`, `step`, `onChange` | – | |
| **Tabs** | `items[{id,label,count?}]`, `activeId`, `onChange` | `line` `pill` | deep link ผ่าน URL |
| **StatusBadge** | `status`, `label?` | `neutral` `info` `success` `warning` `danger` | แสดงไอคอน+ข้อความเสมอ |
| **ProgressBar** | `value`, `max`, `label?` | `determinate` `indeterminate` | ใช้ aria-valuenow |
| **EmptyState** | `title`, `description?`, `action?` | `default` `pixel` | pixel ใช้ใน S10 |
| **ErrorBanner** | `message`, `onRetry?` | `inline` `page` | role=alert |
| **ConfirmDialog** | `title`, `body`, `confirmLabel`, `onConfirm`, `requireReason?`, `minReasonLength?`, `danger?` | `default` `danger` | จับโฟกัส, Esc ปิด; requireReason ใช้ใน S07/S08/S09 |
| **StickyActionBar** | `children` | – | ยึดล่างจอ mobile + safe-area |
| **DataTable** | `columns`, `rows`, `sort`, `onSort`, `loading`, `empty` | `dense` `comfortable` | mobile: เลื่อนแนวนอน หรือ card list |
| **Stepper** | `steps`, `current`, `onStep?` | – | ขั้นที่ผิดมีไอคอนเตือน |
| **AppShell** | `role`, `user`, `children` | `app` `bare` `pixel` | เมนูตามบทบาท (ดู README matrix) |
| **StatTile** | `label`, `value`, `hint?`, `level?`, `onClick?` | `default` `warn` `poor` | level แสดงไอคอน |
| **AuditTrail** | `entries[{who,when,action,reason?}]` | – | อ่านอย่างเดียว |
| **SaveIndicator** | `state: saving|saved|error`, `time?` | – | aria-live polite |

## B. โดเมน: คลิป

| Component | Props | Variants/States | หมายเหตุ |
|---|---|---|---|
| **ClipInput** | `value:{kind:'link'|'upload', url?, objectKey?, durationSec?}`, `onChange`, `allowedKinds`, `maxSizeMB`, `maxDurationSec`, `allowedHosts`, `error?` | tab `link`/`upload`; state `idle` `validating` `ready` `uploading` `processing` `error` | ตามตาราง S05; อัปโหลดต่อได้/ลองใหม่; ไม่ผูก endpoint จนกว่า Jim ปล่อย |
| **ClipPlayer** | `source:{kind, url}`, `onTimeUpdate?`, `onError`, `markers?`, `controls` | `embed` (link) `native` (MinIO); state `loading` `playing` `paused` `error` | ปุ่มย้อน 5 วิ, ความเร็ว 0.5/1/1.5, คีย์ Space/←/→; error → ปุ่มรายงาน + เปิดแหล่งเดิม |

## C. โดเมน: การให้คะแนน

| Component | Props | Variants/States | หมายเหตุ |
|---|---|---|---|
| **ScoreInput** | `min`, `max`, `value?`, `onChange`, `anchors?:Record<level,string>`, `disabled`, `ariaLabel` | `segmented`(default) `slider`(ตัวเลือก, ยังไม่ใช้); state `empty` `selected` `locked` | radio group; ปุ่ม ≥ 44px; แสดง anchor ของระดับที่เลือก; ปุ่มล้าง |
| **RubricItemCard** | `index`, `title`, `weightPct`, `scale`, `anchors`, `value?`, `note?`, `onChange`, `requireNoteAtExtremes?`, `readOnly?` | `edit` `locked` `preview` | ประกอบจาก ScoreInput + note + ปักเวลา |
| **ReviewCard** | `anonId`, `durationSec`, `status`, `dueAt?`, `progress?`, `onOpen` | status: `todo` `draft` `submitted` `unlocked` `broken` `overdue` | ไม่มีชื่อ/ทีม (blind) |
| **RubricItemEditor** | `item`, `onChange`, `onRemove`, `errors` | – | S12; ยอดน้ำหนักรวมแสดงที่ parent |
| **RubricSummary** | `rubric` | – | ใช้ใน S03 |

## D. โดเมน: ผลลัพธ์/สถิติ (แสดงอย่างเดียว — ห้ามคำนวณใน UI)

| Component | Props | Variants/States | หมายเหตุ |
|---|---|---|---|
| **GradeBand** | `score`, `lower`, `upper`, `kind?: exact|straddle|wide`, `label?` | variant `default` `pixel` `compact`; ขนาด `sm` `md` | แสดง `lower–upper` ด้วยข้อความ (+ แท่ง range); ค่า/ป้ายมาจาก API เท่านั้น ตามแบบ bad8bit `{low, high, center, kind}`; ชื่อ field ตรง bl-03/Jim (TBD-API) |
| **AgreementMatrix** | `reviewers[]`, `cells[{a,b,kappa?,n,level}]`, `onCellClick` | state `empty` `insufficient` `ready` | ทุกช่องมีตัวเลข+ไอคอนระดับ; ช่อง insufficient แสดง "—"; keyboard grid navigation |
| **OutlierTable** | `rows[{clipAnonId, reviewerName, itemName, given, othersMedian, deviation, status}]`, `onRowClick`, `filters` | status `open` `accepted` `rereview` `excluded` | ใช้ DataTable |
| **OutlierDrawer** | `clip`, `scoresByReviewer`, `onDecision(decision, reason)` | decision: `accept` `rereview` `exclude` | เหตุผลบังคับ ≥ 10 ตัว (ConfirmDialog) |
| **ResultsTable** | `rows[{participant, score, lower, upper, nReviews, flags}]` | – | ใช้ GradeBand |
| **ApprovalRow** | `item`, `selected`, `onSelect`, `onOpen`, `blocked?` | type `result` `outlier` `unlock` `brokenClip` | แถวมีธง = เลือกกลุ่มไม่ได้ |
| **AssignmentGrid** | `participants`, `reviewers`, `assignments`, `conflicts`, `onToggle` | – | conflict cell = disabled + เหตุผล |
| **Timeline** | `steps`, `currentIndex` | – | ข้อความบอกขั้นปัจจุบัน |

## E. โดเมน: อีเวนต์/สายแข่ง

| Component | Props | Variants/States | หมายเหตุ |
|---|---|---|---|
| **EventCard** | `event`, `role`, `primaryAction` | status ตามวงจรอีเวนต์ | CTA ตามบทบาท (S01) |
| **ApplicationCard** | `application`, `onEdit`, `onWithdraw` | – | S11 |
| **InviteList** | `invites`, `onAdd`, `onRemove` | – | S03 ขั้น 4 |
| **PlayerTag** | `name`, `team?`, `avatar?`, `highlight?`, `withdrawn?` | `compact` `full` | avatar ขนาด 32/64 |
| **MatchCard** | `a`, `b`, `scoreA?`, `scoreB?`, `status`, `winner?` | status `pending` `live` `done` `bye`; variant `pixel` | ผู้ชนะระบุด้วยข้อความ+ไอคอน |
| **Bracket** | `rounds[{name, matches[]}]`, `highlightPlayerId?` | layout `tree` (desktop) `list` (mobile); variant `pixel` | เส้นเชื่อมมุมฉาก 2px; มีตารางข้อความสำรองสำหรับ a11y; โฟกัสเคลื่อนตามแมตช์ |
| **BracketPreview** | `rounds` | – | ใช้ใน S04 (ไม่โต้ตอบ) |
| **Scoreboard** | `rows[{rank, player, team, gradeBand, record?}]`, `highlightId?` | variant `pixel` | ตัวเลข pixel font |
| **PixelBadge** | `kind: champion|runnerUp|third|tier`, `size: 16|32` | – | ใช้ assets จาก bad8bit badges-v1 (ต้องขออนุญาต/คัดลอกเป็นข้อมูล) |

## ลำดับที่แนะนำสำหรับ Andy (หลังเจ้าของอนุมัติ)

1. โทเคน/ธีม + AppShell + Button/TextField/Tabs/StatusBadge/EmptyState/ErrorBanner (ฐาน)
2. ConfirmDialog, StickyActionBar, ProgressBar, SaveIndicator, DataTable
3. ClipPlayer → ScoreInput → RubricItemCard → S07 (ค่าสูงสุดของระบบ; mobile)
4. ClipInput → S05
5. GradeBand → AgreementMatrix → OutlierTable/Drawer → S08/S09
6. Bracket/MatchCard/Scoreboard (pixel) → S10
7. ที่เหลือ (S01, S02, S03, S04, S06, S11, S12)

## ตารางตรวจรับต่อ component (Definition of Done สำหรับ packet)

- แสดงครบ states ตามตารางด้านบนบนหน้าตัวอย่าง
- contrast ผ่านตาม T5.2 ทั้ง daylight และ night
- ใช้ keyboard ครบ, มี accessible name
- ไม่มีโค้ดเรียก API ใน component ฐาน (รับ props เท่านั้น)
- Unit/visual test ตามที่ Dwight กำหนด
