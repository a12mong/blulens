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

## 1. ระบบจัดเกรด (Grading) — 28 เคส (20 + 8 โหมดกรรมการน้อย)

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

### 1.1 โหมดกรรมการน้อย (few-reviewer mode) — เจ้าของแจ้ง: จริง ๆ มี 1–2 คนต่อแมตช์/คู่ ไม่ใช่ `N_min = 3`
> ตัวเลขที่เป็น `<TBD v2>` รอ `grading.md` v2 ของ Jim · เคส GR-04/05/06/07/20 ข้างบนต้องอ่านใหม่ว่า "ต่ำกว่า N_min" = เข้าโหมดน้อย ไม่ใช่ insufficient เสมอไป (จะ reconcile เมื่อ v2 ออก)

| ID | เคส | Setup | พฤติกรรมที่คาดหวัง | Automated check |
|---|---|---|---|---|
| GR-21 | **n=1 provisional** | กรรมการ 1 คนส่งครบ | ผล `provisional`; `score/lower/upper` ครบ (INV-1/2) โดย lower–upper กว้างกว่าโหมดปกติด้วย margin `<TBD v2>`; ไม่คำนวณ kappa/outlier (สถานะ undefined ไม่ใช่ NaN); ต้อง Committee confirm จึง finalize | U: assert margin กว้างกว่า n=2 ที่คะแนนเท่ากัน; assert ไม่มี NaN; I: finalize ไม่ได้ถ้าไม่มี Committee confirm |
| GR-22 | **n=1 + Committee confirm** | จาก GR-21 Committee ยืนยัน | สถานะ finalized-with-confirm; audit บันทึกผู้ยืนยัน/เวลา; Reviewer/Member ยืนยันเองไม่ได้ (403) | I: role table |
| GR-23 | **n=2 เห็นพ้อง** | 2 คน คะแนนใกล้กัน (ภายใน `<TBD v2>`) | Cohen's kappa คู่คำนวณถูกตาม golden; ไม่ flag ขัดแย้ง; finalize ได้ตามสเปก | U: golden fixture appendix C |
| GR-24 | **n=2 ขัดแย้ง** | 2 คน ห่างกันเกินเกณฑ์ | flag disagreement; **ห้ามระบุ outlier** (ไม่มีเสียงข้างมาก — ตัดสินว่าใครผิดไม่ได้); ส่ง Committee ตัดสิน/มอบหมายคนที่ 3 ตามสเปก; ผลชั่วคราวแสดงช่วงครอบคลุมทั้งสอง | U: assert outlier = ว่าง; assert flag |
| GR-25 | **n=2 เหมือนกันทั้งหมด** | 2 คน ชุดเดียวกัน (P_e=1) | เหมือน GR-08 ในกรณีคู่: ไม่ NaN; ตามคำตอบ Q1 | U |
| GR-26 | **n=2 → n=3 (เพิ่มคนที่ 3)** | เพิ่มกรรมการหลัง flag | สลับเข้าโหมดปกติ Fleiss; outlier detector ทำงาน; ผลเดิมถูก supersede ไม่ลบ | I |
| GR-27 | **ขอบการสลับโหมด** | n = 0,1,2,3,4 ต่อเนื่อง | โหมดตรงตาราง (none / provisional / pair / normal / normal) ไม่มีช่องว่างหรือซ้อน | U: table-driven |
| GR-28 | **n=1 ที่ไม่เสร็จ** | กรรมการ 1 คนไม่ส่งจน `T_wait` | ไม่มีผล; pending/แจ้งเตือน ไม่ใช่ provisional เปล่า | I: fake clock |

## 2. ระบบจับสาย (Draw) — 19 เคส (อ้างอิง `docs/specs/draw.md` v1 · เจ้าของอนุมัติ D1–D8 ตามข้อเสนอ)

ค่าที่ล็อกแล้ว: ขนาดสาย S = 2^k ≥ N; มือวางตาม §3 ของสเปก (N 3–8→2, 9–16→4, 17–32→8, 33–64→16, 65+→16); bye = S−N วางที่อันดับเสมือน N+1..S; ลำดับช่อง S=8 = `1,8,4,5,2,7,3,6`, S=16 = `1,16,8,9,4,13,5,12,2,15,7,10,3,14,6,11`; ทีมใหญ่สุด t > S/2 → `minimumPossibleConflicts = t − S/2` (เดี่ยว); คู่ชน ⟺ ชุดทีมซ้ำ ≥ 1 ทีม (D7); คู่ seedScore = ค่าเฉลี่ย (D2); ขีดค้น 200,000 ขั้น, สาย 256 < 1 วินาที; PRNG ระบุใน ruleset `draw-v1` (ห้าม `Math.random`); publish ที่ conflicts > 0 ต้อง `acknowledgeConflicts` มิฉะนั้น `DRAW_CONFLICTS_NOT_ACKNOWLEDGED`; ข้อมูลเปลี่ยนหลัง preview → `DRAW_INPUT_CHANGED`; สุ่มใหม่ = Committee เท่านั้น + เหตุผล, ล็อกหลังแมตช์แรกเริ่ม (D8)
ระดับ U ทดสอบกับ pure function ใน `packages/shared/src/draw` (bl-18) — Kelly รันแบบ property/many-seed

| ID | เคส | Setup | พฤติกรรมที่คาดหวัง | Automated check |
|---|---|---|---|---|
| DR-01 | **กรณีปกติ** | 16 entry 4 ทีม ทีมละ 4 | `conflicts = []` ทุก seed; ทุก entry อยู่ช่องเดียว | U: 1,000 seeds → 0 คู่ทีมเดียวกันรอบแรก |
| DR-02 | **เลี่ยงไม่ได้** | N=4: A1,A2,A3,B1 (ภาคผนวก ข); และ N=16 ทีม A 9 คน | `minimumPossibleConflicts` = 1 (กรณีแรก) และ 9−8 = 1 (กรณีสอง); สายที่ได้ `conflicts.length` = ค่านี้; คู่ที่ชนเป็นผู้ไม่ใช่มือวาง/seedScore ต่ำสุดก่อน; ไม่ throw, ไม่วนค้าง | U: assert ความยาว conflicts = minimum; terminate < 1 วินาที |
| DR-03 | **ขอบ feasibility** | t = S/2 พอดี และ t = S/2 + 1 (S = 4,8,16,32) | t = S/2 → conflicts 0; +1 → minimum = 1 | U: ตารางหลาย S |
| DR-04 | **ทีมเดียวทั้งหมด** | N entry ทีมเดียว | minimum = N − S/2 (เดี่ยว) คำนวณถูก | U |
| DR-05 | **จำนวน entry ไม่ลงตัว (bye)** | N = 3,5,6,7,9,15,17 | bye = S−N อยู่ช่องอันดับเสมือน N+1..S; bye ตกกับมือวางอันดับสูงก่อน; bye ไม่ชนกับ bye; ไม่มีคู่ทีมเดียวกัน | U: ตรวจตำแหน่ง bye ทุก N |
| DR-06 | **ตารางขนาดสาย/มือวาง** | N = 2,3,4,5,8,9,16,17,32,33,64,65,256 | S และจำนวนมือวางตรงตาราง §3 ทุกแถว (รวมขอบ) | U: table-driven 13 ค่า |
| DR-07 | **ลำดับช่องมาตรฐาน** | S = 2,4,8,16,32,64,128,256 | ตรงสูตรภาคผนวก ก; r เจอ S+1−r; อันดับ 1–2 คนละครึ่ง, 1–4 คนละ quarter, 1–8 คนละ eighth; อันดับ 1 อยู่ช่อง 1; S=8 = `1,8,4,5,2,7,3,6` | U: property + golden 2 ค่า |
| DR-08 | **ฟิกซ์เจอร์ภาคผนวก ข** | ชายเดี่ยว N=6 (A1 8.2, B1 8.0, A2 7.6, C1 7.4, A3 7.1, B2 6.9) | ช่อง1=A1, ช่อง5=B1, bye ช่อง 2,6; A2 กับ A3 ไม่อยู่คู่เดียวกัน (3v4, 7v8); conflicts = 0 | U: golden + กรณีผิด (A2 v A3) ต้องถูกจับโดย validator |
| DR-09 | **ผู้เข้าแข่งขันประเภทคู่** | entry คู่ชุดทีม {A,B} vs {B,C}; {A,B} vs {C,D} | ชนเมื่อมีทีมซ้ำ ≥ 1 (D7) → คู่แรกนับเป็น conflict, คู่สองไม่; seedScore = ค่าเฉลี่ย (D2) | U |
| DR-10 | **ผู้เล่นไม่มีทีม** | ผู้เล่น team = null ล้วน/ผสม | ไม่ชนกับใคร (ไม่นับ null=null เป็นทีมเดียวกัน) | U: ทุกคน null → conflicts 0 |
| DR-11 | **Determinism / verify** | snapshot + seed เดิม; สลับลำดับ input; verify | สายเดียวกัน 100% ทุกช่อง; ปุ่ม verify "ตรงกัน"; ไม่ขึ้นกับลำดับ input; ไม่เรียก `Math.random`/`Date` | U: สลับลำดับ 20 ครั้ง; static grep ห้าม Math.random ใน `draw/` |
| DR-12 | **ความเป็นธรรมของการสุ่ม** | 10,000 seeds, 8 คน ไม่มีทีม | การกระจายช่อง (ไม่ใช่มือวาง) ไม่เบี้ยว chi-square; seeding ใช้ seed คงที่ ไม่ flaky | U |
| DR-13 | **คะแนนเท่ากัน (ties)** | seedScore เท่ากันหลายคน | ตัดสินด้วย PRNG แบบ deterministic ต่อ seed | U |
| DR-14 | **ขีดค้นหมด** | กรณีหนักที่ backtracking เกิน 200,000 ขั้น | คืนสายที่ดีที่สุดที่เจอ + แฟล็ก "ยังไม่พิสูจน์ว่าน้อยสุด"; เวลา < 1 วินาที (S=256) | U: mock ขีดจำกัดต่ำ + assert แฟล็ก |
| DR-15 | **วงจรเวอร์ชัน: preview/publish** | preview → publish; เปลี่ยนรายชื่อแล้ว publish; conflicts>0 publish ไม่ติ๊ก | เปลี่ยนข้อมูล → `DRAW_INPUT_CHANGED`; ไม่ติ๊ก → `DRAW_CONFLICTS_NOT_ACKNOWLEDGED`; ติ๊กแล้ว audit บันทึก; 1 event มี published ได้ 1 เวอร์ชัน | I |
| DR-16 | **สุ่มใหม่ (re-draw)** | preview ซ้ำ; supersede หลังเผยแพร่; หลังแมตช์แรกเริ่ม | preview ใหม่ต้องมีเหตุผล + ทุก preview ใน audit (D5); supersede เฉพาะ Committee + เหตุผล, เวอร์ชันเก่า `superseded` ไม่ลบ; หลัง locked → 409; Admin ที่ไม่ใช่ Committee → 403 (D8) | I: role × state table |
| DR-17 | **ถอนตัวหลังเผยแพร่** | entry ถอน; มี/ไม่มีตัวสำรอง | ไม่สุ่มใหม่; ตัวสำรองลงช่องเดิม; ไม่มี → คู่แข่ง walkover (D6) | I |
| DR-18 | **ข้อมูลเข้า** | N = 0,1; entry ไม่มีเกรดอนุมัติ; ก่อนปิดรับสมัคร | 4xx รหัสนิยาม; `NO_APPROVED_GRADE`; ไม่สร้างสายว่าง | I |
| DR-19 | **concurrent + สิทธิ์** | Committee 2 คนกด preview/publish พร้อมกัน; Reviewer/Member/Guest เรียก | ไม่มีสอง published; ตัวที่สองได้ 409; role อื่น 403 | I: Promise.all + role table |

> รอบแบ่งกลุ่ม (groups of 4, round robin, N advance + best third, scoring formats) — เพิ่มเคส GS-* เมื่อสเปก bl-17 ออก

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
3. ~~Q3~~ (ตัดสินแล้ว D3: ชนน้อยสุด + Committee ยอมรับ) draw เป็นไปไม่ได้ (DR-02): ปฏิเสธ หรือ conflict น้อยสุดให้ Admin ยืนยัน
4. **Q4** ชื่อทีม: เลือกจากรายการ หรือพิมพ์อิสระ + alias ที่ Admin ผูก (ไทย/อังกฤษเดาอัตโนมัติไม่ได้)
5. **Q5** outlier: ตัดออก หรือลดน้ำหนัก? สูงสุดกี่คนต่อคลิป
6. ~~Q6~~ (ตัดสินแล้ว D8: Committee เท่านั้น ห้ามหลัง locked) re-draw: ใครสั่งได้ และอนุญาตหลังมีผลแข่งหรือไม่

## 6. สรุปจำนวนเคส

| ระบบ | จำนวน |
|---|---|
| Grading (GR) | 28 |
| Draw (DR) | 19 |
| Registration (RG: ชื่อทีม 7 + อัปโหลด 5) | 12 |
| Cross-system (X) | 3 |

## 7. เกณฑ์ผ่านของชุดทดสอบ
- ทุกเคสมี test ที่ชื่อ describe ขึ้นต้นด้วย ID (trace กลับแผนนี้ได้)
- แต่ละ test พิสูจน์ว่า fail ได้ (แก้เงื่อนไขในโค้ดด้วยมือแล้วเห็น red) — Toby แนบหลักฐาน
- Golden fixtures ของ kappa/draw ต้องมีผู้ลงชื่อรับรองค่า (Jim/เจ้าของ)
- ไม่ flaky: สุ่มด้วย seed คงที่, เวลาใช้ fake clock
- รายงานมีคำสั่งจริง + ผลลัพธ์ (รูปแบบเดียวกับ test baseline ของ bad8bit)
