# แผนทดสอบ blulens — ระบบจัดเกรด (grading), ระบบจับสาย (draw), การลงทะเบียน/อัปโหลด

> ผู้เขียน: Dwight (Lead QA) · ฉบับร่าง v0 · 2026-10-07 · card bl-06
> สถานะ: **ร่างจาก brief** — ตัวเลข (N_min, เกณฑ์ outlier, ขนาดสาย ฯลฯ) ใช้ตัวแปรสัญลักษณ์ รอ reconcile กับสเปก bl-03 (grading) / bl-04 (draw) ของ Jim
> ห้ามสร้าง packet ให้ Toby จนกว่าเจ้าของอนุมัติ bl-03/bl-04 `[WAITING FOR OWNER APPROVAL]`

## 0. หลักการและตัวแปร

| สัญลักษณ์ | ความหมาย | ค่า |
|---|---|---|
| `N_min` | จำนวนกรรมการขั้นต่ำที่ต้องส่งครบก่อนคำนวณผลสุดท้าย | **TBD (bl-03)** |
| `K_out` | เกณฑ์ตัดสิน outlier | **TBD (bl-03)** |
| `T_wait` | เวลารอสูงสุดก่อนถือว่ากรรมการ "ไม่ทำให้เสร็จ" | **TBD (bl-03)** |
| ผลลัพธ์ | `{ score, lower, upper }` (+ ป้ายที่ derive) ตาม TEAM.md §6 | บังคับมีเสมอ |

**ระดับการทดสอบ**: `U` = unit (pure function ใน `packages/shared`) · `I` = integration (API + Postgres จริง) · `E` = e2e (Playwright). เลือกระดับต่ำสุดที่พิสูจน์ได้ และทุกเคสต้องมี automated check ที่ fail ได้จริง (เห็น red ก่อน green)

**Invariant กลาง (property test ใช้กับทุกเคส grading)**
- INV-1: ผลที่ส่งออกมี `score`, `lower`, `upper` ครบ ไม่เป็น `null/undefined/NaN` ทุกสถานะ (รวมสถานะ "ยังไม่พอ")
- INV-2: `lower ≤ score ≤ upper` (ตามลำดับบันไดเกรด) และอยู่ในช่วงบันไดที่ถูกต้อง
- INV-3: deterministic — input เดียวกัน (สลับลำดับกรรมการ) ได้ผลเดียวกัน
- INV-4: ไม่มี exception หลุดจากการหารศูนย์/ช่วงว่าง — กรณี undefined คืนค่าสถานะที่นิยามไว้

## 1. ระบบจัดเกรด (Grading) — 20 เคส

| ID | เคส | Setup | พฤติกรรมที่คาดหวัง | Automated check |
|---|---|---|---|---|
| GR-01 | **กรรมการโดด 1 คน (lone outlier)** | กรรมการ ≥ `N_min`: n−1 คนใกล้กัน, 1 คนห่างเกิน `K_out` | flag outlier ระบุตัวคน; ตามสเปกอาจตัด/ลดน้ำหนัก; `lower/upper` ไม่กว้างผิดปกติ; audit log บันทึกว่าตัดใคร เหตุผลใด | U: fixture 5 คน (4+1) → assert flag และ score ตรงค่าคำนวณมือ; สลับลำดับ (INV-3) |
| GR-02 | **outlier ที่ขอบเกณฑ์พอดี** | ระยะ = `K_out`, `K_out−ε`, `K_out+ε` | boundary ชัด (≥ หรือ >) ตามสเปก | U: table-driven 3 ค่า |
| GR-03 | **หลาย outlier / แตก 2 ขั้ว** | กรรมการ 4 คน แบ่ง 2/2 ห่างกันมาก | ไม่ตัดครึ่งหนึ่งทิ้งสุ่ม ๆ; deterministic; flag "ไม่เห็นพ้อง" แทนเลือกข้าง | U: assert ไม่ลดจนเหลือ < `N_min`; assert flag |
| GR-04 | **กรรมการไม่ทำให้เสร็จ (never finish)** | มอบหมาย `N_min` คน แต่ 1 คนส่งไม่ครบ/ไม่ส่งจน `T_wait` | draft ไม่ถูกนับ; สถานะ `pending/insufficient`; พ้น `T_wait` ทำตามสเปก (แจ้ง/มอบหมายใหม่/ปิดด้วยคนที่มีถ้า ≥ `N_min`) | I: fake clock เลื่อนพ้น `T_wait`; assert สถานะ + job แจ้งเตือนเข้าคิว Redis; U: draft ไม่เข้าสูตร |
| GR-05 | **ไม่มีใครส่งเลย (0 submission)** | 0 ผู้ส่ง | `score/lower/upper` เป็นค่าสถานะ "ยังไม่ประเมิน" ที่นิยามไว้ (ห้าม null ที่ทำ FE พัง); kappa ไม่นิยาม | U+I: INV-1 |
| GR-06 | **กรรมการน้อยกว่าขั้นต่ำ** | ส่งเสร็จ `N_min−1` | ไม่ finalize; ผลชั่วคราวติดป้าย "ไม่เพียงพอ" + lower/upper ตามสเปก; ห้ามแสดงเป็นผลสุดท้าย | U: parametrize n=0..`N_min`−1 ไม่ finalize; n=`N_min` finalize |
| GR-07 | **กรรมการคนเดียว** | n = 1 | kappa ไม่นิยาม (ต้อง ≥2); ไม่มี outlier detection | U: assert สถานะ undefined ไม่ throw |
| GR-08 | **ทุกคนให้คะแนนเหมือนกันหมด (kappa undefined)** | n ≥ 2 ทุกคนชุดเดียวกัน (P_e = 1 → 0/0) | **ไม่ crash/NaN**; kappa คืน "ไม่นิยาม" หรือ 1.0 ตามสเปก (§5 Q1); score = ค่าที่ตรงกัน; lower=upper=score หรือช่วงแคบตามสเปก; ไม่ flag outlier | U: assert ไม่ NaN/Infinity, INV-1, INV-2; ทั้ง Cohen (n=2) และ Fleiss (n=5) |
| GR-09 | **เกือบเหมือนกัน (ต่าง 1 ข้อ)** | marginal เกือบ degenerate | kappa คำนวณได้ ไม่หารศูนย์; อยู่ใน [−1,1] | U: property test |
| GR-10 | **kappa ติดลบ** | กรรมการ 2 คนให้ตรงข้ามกัน | แสดง kappa < 0 ถูกต้อง ไม่ clamp เงียบ ๆ (เว้นสเปกกำหนด) | U: เทียบตัวอย่างมือ |
| GR-11 | **ความถูกต้องสูตร Cohen (n=2) / Fleiss (n≥3)** | ชุดตัวอย่างมาตรฐาน 2–3 ชุด | ตรงค่าอ้างอิงตามความละเอียดในสเปก | U: golden fixtures `packages/shared/test/fixtures/kappa/*.json` ที่ Jim/เจ้าของลงชื่อรับรอง |
| GR-12 | **รูปร่างผลลัพธ์ score/lower/upper เสมอ** | ทุกเส้นทาง: finalized, pending, insufficient, all-identical, outlier ถูกตัด | field ครบทุกกรณี, lower/upper เป็น grade key ที่มีจริง | U property (INV-1,2) + I: contract test response ด้วย zod schema จาก `packages/shared` |
| GR-13 | **ขอบบันได (clamp)** | คะแนนต่ำสุด/สูงสุด | lower ไม่ต่ำกว่าขั้นต่ำ, upper ไม่เกินขั้นสูงสุด | U: ค่าขอบ ±1 |
| GR-14 | **การปัดเศษ** | ค่ากึ่งกลางระหว่าง 2 ขั้น (.5) | กฎปัดตามสเปก ไม่ขึ้นกับ float error | U: ตาราง boundary |
| GR-15 | **ส่งซ้ำ (idempotent)** | กดส่งซ้ำ/retry | 1 กรรมการ = 1 submission ต่อคลิป; ซ้ำไม่นับสอง | I: POST 2 ครั้ง assert row = 1 |
| GR-16 | **ส่ง/แก้หลัง finalize** | ส่งหลังผลล็อก | ปฏิเสธ (4xx) หรือสร้าง revision ตามสเปก; ผลเดิมไม่เปลี่ยนเงียบ | I |
| GR-17 | **ข้อมูลไม่ถูกต้อง** | คะแนนนอกช่วง, ขาดข้อ, ชนิดผิด, NaN | 400 + รหัส error; ไม่เขียน DB | I: zod validation table |
| GR-18 | **ผลประโยชน์ทับซ้อน** | กรรมการทีมเดียวกับผู้ถูกประเมิน | ห้ามมอบหมาย/ส่งตามสเปก (§5 Q2) | I |
| GR-19 | **สิทธิ์ (Role)** | Member/Guest ส่งคะแนนหรืออ่านคะแนนรายคนก่อน finalize | 403; Reviewer เห็นเฉพาะของตัวเอง (blind) | I: role × endpoint |
| GR-20 | **กรรมการถูกถอดหลังส่ง** | 1 ใน `N_min` ถูกถอด | คำนวณใหม่; ต่ำกว่า `N_min` → insufficient + audit | I |

## 2. ระบบจับสาย (Draw) — 15 เคส

กฎ: รอบแรก **ห้ามคนทีมเดียวกันเจอกัน** (ทีม = ค่า canonical หลัง normalize ดู RG-01..06). ผู้เล่นไม่มีทีมไม่ถูกจำกัด

| ID | เคส | Setup | พฤติกรรมที่คาดหวัง | Automated check |
|---|---|---|---|---|
| DR-01 | **กรณีปกติ** | 16 คน 4 ทีม ทีมละ 4 | ไม่มีคู่รอบแรกทีมเดียวกัน; ทุกคนถูกจัดครั้งเดียว | U: 1,000 seeds → 0 violation |
| DR-02 | **เป็นไปไม่ได้ (infeasible)** | ทีมหนึ่งมากเกินช่อง (16 คน ทีม A 9 คน → A–A ≥ 1 คู่) | ไม่วนค้าง/ไม่ throw ดิบ; ตามสเปก bl-04: (ก) ปฏิเสธพร้อมรายงานทีมที่เกิน หรือ (ข) conflict น้อยสุด + ระบุคู่ขัดแย้ง + Admin ยืนยัน (§5 Q3) | U: คำนวณ feasibility ก่อนสุ่ม; terminate < 1 วินาที; conflict = ค่าต่ำสุดทางทฤษฎี |
| DR-03 | **ขอบ feasibility** | ทีมใหญ่สุด = ⌊n/2⌋ และ +1 | ขอบ: 0 conflict; +1: เข้า DR-02 | U: หลาย n |
| DR-04 | **ทีมเดียวทั้งหมด** | ทุกคนทีมเดียว | infeasible ชัด ข้อความตามสเปก | U |
| DR-05 | **ผู้เล่นคี่ / bye** | n = 15 | bye ตามกฎ; ไม่ทำให้เกิดคู่ทีมเดียวกัน; ไม่ลำเอียง | U: n = 3,5,7,15,17 |
| DR-06 | **ขนาดสายไม่ใช่ 2^k** | n = 12, 20 | bye = nextPow2(n) − n | U |
| DR-07 | **ผู้เล่นน้อยเกิน** | n = 0,1,2 | 4xx รหัสนิยาม ไม่สร้าง bracket ว่าง | I |
| DR-08 | **re-draw ก่อนเริ่มแข่ง** | มีสายแล้ว ยังไม่มีผล | เฉพาะ Admin/Committee; สายใหม่ผ่านกฎ; สายเก่าเก็บ history; บันทึก who/when/why | I: row ใหม่ + เก่า archived; audit |
| DR-09 | **re-draw หลังมีผลแข่ง** | มีแมตช์บันทึกผลแล้ว | ปฏิเสธ (409) หรือ flow พิเศษตามสเปก; ไม่ทำลายผล | I |
| DR-10 | **re-draw ซ้ำหลายครั้ง** | re-draw 10 ครั้ง | ทุกครั้งผ่านกฎ; seed บันทึกทุกครั้ง; (ถ้าสเปกต้องการ) ต่างจากเดิม | U+I |
| DR-11 | **Determinism ด้วย seed** | seed + รายชื่อเดียวกัน | สายเดียวกัน ไม่ขึ้นกับลำดับ input | U: สลับลำดับรายชื่อ |
| DR-12 | **ความเป็นธรรมของการสุ่ม** | 10,000 draws, 8 คน | การกระจายตำแหน่งไม่เบี้ยว (chi-square, seed คงที่) | U |
| DR-13 | **ผู้เล่นถอนตัว** | 1 คน withdrawn | ไม่รวมในการจับ; ประเมิน feasibility ใหม่ | I |
| DR-14 | **concurrent draw** | Admin 2 คนกดพร้อมกัน | เหลือ bracket active เดียว; คนที่สองได้ 409 | I: Promise.all |
| DR-15 | **สิทธิ์** | Reviewer/Member/Guest เรียก draw | 403; อ่านสายตาม visibility | I: role × endpoint |

## 3. การลงทะเบียน: ชื่อทีม + อัปโหลดคลิป — 12 เคส

### 3.1 ชื่อทีม (team identity) — ผูกกับ DR-01..04
ถ้าทีมเดียวกันสะกดต่างกันแล้วระบบมองเป็นคนละทีม กฎห้ามทีมเดียวกันเจอกันจะรั่วเงียบ ๆ — ความเสี่ยงสูง

| ID | เคส | Setup | พฤติกรรมที่คาดหวัง | Automated check |
|---|---|---|---|---|
| RG-01 | **ต่างกันที่ช่องว่าง** | `"Blue Wing"`, `"Blue  Wing"`, `" Blue Wing "`, `"BlueWing"` | trim + ยุบช่องว่างซ้ำ = ทีมเดียวกัน 3 แรก; `"BlueWing"` ตามสเปก (§5 Q4) | U: `normalizeTeam()` table; รวม NBSP U+00A0, zero-width U+200B, tab |
| RG-02 | **ต่างกันที่ตัวพิมพ์** | `"Blue Wing"` / `"BLUE WING"` / `"blue wing"` | ทีมเดียวกัน (case-insensitive); ชื่อแสดงผลตามที่ลงทะเบียนครั้งแรกหรือ Admin ตั้ง | U |
| RG-03 | **ไทย/อังกฤษ** | `"บลูวิง"` vs `"Blue Wing"` | ระบบ **เดาอัตโนมัติไม่ได้** → ต้องมีกลไก: ตาราง alias ที่ Admin ผูก หรือเลือกจาก dropdown (§5 Q4); ผูกแล้ว draw ถือเป็นทีมเดียว | I: ก่อนผูก → 2 ทีม; หลังผูก → 1 ทีม; draw ไม่จับ 2 คนนี้เจอกันรอบแรก |
| RG-04 | **normalize อักขระไทย** | ลำดับ combining ต่าง, NFC/NFD, เลขไทย `๑` vs `1` | NFC ก่อนเปรียบเทียบ; เลขไทย/อารบิกเท่ากัน (ตามสเปก) | U: golden pairs |
| RG-05 | **เครื่องหมาย/emoji/homoglyph** | `"Blue-Wing"`, `"Blue.Wing"`, `"Blue Wing 🏸"`, ซีริลลิกหน้าตาเหมือน | ตามกฎสเปก; homoglyph ไม่สร้างทีมซ้ำเงียบ ๆ (อย่างน้อย warn Admin) | U |
| RG-06 | **ว่าง / ยาวเกิน / ไม่มีทีม** | `""`, `"   "`, 500 ตัวอักษร, ไม่ระบุ | ว่างหลัง normalize = independent หรือปฏิเสธตามสเปก; ยาวเกิน 400; null ไม่ทำ draw พัง | I+U |
| RG-07 | **unique ระดับ DB (race)** | สร้างทีม 2 ชื่อที่ normalize เท่ากันพร้อมกัน | DB มี unique บนค่า normalized; ตัวที่สองได้ 409 | I: Promise.all |

### 3.2 อัปโหลดคลิป (MinIO) — ความล้มเหลว
สถานะ canonical ของ Clip (docs/api/openapi.yaml): `pending_upload | uploaded | rejected`
| ID | เคส | Setup | พฤติกรรมที่คาดหวัง | Automated check |
|---|---|---|---|---|
| RG-08 | **MinIO ล่ม/timeout** | หยุด MinIO หรือ mock S3 throw | ผู้ใช้เห็นข้อความล้มเหลว + retry ได้; **ไม่มี row คลิปชี้ object ที่ไม่มี** (ไม่ค้าง `uploaded` โดยไม่มี object; ค้างได้เฉพาะ `pending_upload`) | I (compose MinIO, stop กลางเทส) |
| RG-09 | **ขาดกลางทาง/ปิดเบราว์เซอร์** | multipart ไม่ครบ | row `pending_upload` ถูก job เก็บกวาด (expire) ลบ part ค้าง; คลิปไม่ถูกมอบหมายจนกว่า `uploaded` | I: fake clock + cleanup job |
| RG-10 | **ไฟล์ผิดชนิด/ใหญ่เกิน/ว่าง/เสีย** | `.exe` ปลอมเป็น `.mp4`, 0 byte, เกินขีดจำกัด, header เสีย | ตรวจ magic bytes ไม่เชื่อ extension/Content-Type; 413/415/422 หรือ clip `status = rejected` ตาม openapi; ไม่เก็บไฟล์ | I: fixture เล็กสร้างใน test |
| RG-11 | **อัปโหลดซ้ำ** | กดส่งซ้ำ/checksum เดียวกัน | idempotent: ไม่มีสองแถว; object key ไม่ชนข้ามผู้ใช้ | I |
| RG-12 | **สิทธิ์และ presigned URL** | Guest/Member อื่นขออัปโหลด/ดู; URL หมดอายุ | 403; URL หมดอายุใช้ไม่ได้; กรรมการเข้าถึงเฉพาะคลิปที่ถูกมอบหมาย | I |

## 4. ข้ามระบบ (e2e) — 3 เคส

| ID | เคส | Check |
|---|---|---|
| X-01 | ลงทะเบียน → อัปโหลดคลิป → กรรมการ ≥ `N_min` ให้คะแนน → เว็บแสดง score/lower/upper | E: Playwright happy path |
| X-02 | ผู้เล่นที่ผลยังไม่ finalize ถูกรวม/กันออกจาก draw ตามสเปก | I |
| X-03 | ทีมที่ผูก alias (RG-03) แล้ว draw (DR-01) ไม่เจอกัน | I |

## 5. คำถามค้าง (ส่ง god → เจ้าของ)

1. **Q1** kappa เมื่อทุกคนให้เหมือนกัน (GR-08): "ไม่นิยาม" หรือ 1.0? finalize ได้หรือไม่
2. **Q2** กรรมการทีมเดียวกับผู้ถูกประเมิน ห้ามประเมินหรือไม่ (GR-18)
3. **Q3** draw เป็นไปไม่ได้ (DR-02): ปฏิเสธ หรือ conflict น้อยสุดให้ Admin ยืนยัน
4. **Q4** ชื่อทีม: เลือกจากรายการ หรือพิมพ์อิสระ + alias ที่ Admin ผูก (ไทย/อังกฤษเดาอัตโนมัติไม่ได้)
5. **Q5** outlier: ตัดออก หรือลดน้ำหนัก? สูงสุดกี่คนต่อคลิป
6. **Q6** re-draw: ใครสั่งได้ และอนุญาตหลังมีผลแข่งหรือไม่

## 6. สรุปจำนวนเคส

| ระบบ | จำนวน |
|---|---|
| Grading (GR) | 20 |
| Draw (DR) | 15 |
| Registration (RG: ชื่อทีม 7 + อัปโหลด 5) | 12 |
| Cross-system (X) | 3 |

## 7. เกณฑ์ผ่านของชุดทดสอบ
- ทุกเคสมี test ที่ชื่อ describe ขึ้นต้นด้วย ID (trace กลับแผนนี้ได้)
- แต่ละ test พิสูจน์ว่า fail ได้ (แก้เงื่อนไขในโค้ดด้วยมือแล้วเห็น red) — Toby แนบหลักฐาน
- Golden fixtures ของ kappa/draw ต้องมีผู้ลงชื่อรับรองค่า (Jim/เจ้าของ)
- ไม่ flaky: สุ่มด้วย seed คงที่, เวลาใช้ fake clock
- รายงานมีคำสั่งจริง + ผลลัพธ์ (รูปแบบเดียวกับ test baseline ของ bad8bit)
