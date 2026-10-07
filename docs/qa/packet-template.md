# Packet template — Dwight (Lead QA) → Toby (Tester)

> 1 packet = 1 เคส (หรือกลุ่มเคสเล็กที่ใช้ fixture เดียวกัน) · ขาดช่องใด Toby `query` กลับ ห้ามเดา
> ห้ามส่งจนกว่าสเปก bl-03/bl-04 ที่เกี่ยวข้องได้รับอนุมัติจากเจ้าของ

```
TO: tester-toby-<suffix>      FROM: dwight-muxsq5jb      CARD: bl-12 (sub: <case-id>)
SUBJECT: <case-id> <ชื่อเคสสั้น ๆ>

GOAL:
  เขียน automated test ที่พิสูจน์เคส <case-id> ตาม docs/qa/test-plan.md §<n>
  (1 เคส · 1 ไฟล์ test)
STATE:
  - สเปกอนุมัติแล้ว: <docs/specs/...> ฉบับ <hash/วันที่>
  - โค้ดที่ทดสอบ: <path> (branch <ของ Dev> / ยังไม่มี → เขียน test ให้ fail ก่อน)
  - ค่าตัวเลขจากสเปก: N_min=<> K_out=<> T_wait=<> ...
SOURCES:
  - test-plan.md แถว <case-id> (setup / expected)
  - fixture/golden: <path> (ค่าลงชื่อโดย <ใคร>)
  - ตัวอย่างรูปแบบ test เดิม: <path>
CONSTRAINTS:
  - ห้ามแก้ product code; พบบั๊ก → รายงาน อย่าแก้
  - describe ต้องขึ้นต้นด้วย <case-id>
  - สุ่ม: seed คงที่ · เวลา: fake clock · ห้าม sleep จริง
  - ห้ามพิมพ์ค่าจาก .env; ห้ามแตะ DB/MinIO ของ production
  - branch tester/bl-12-<case-id>-<slug>; conventional commits; ไม่ commit ลง main/develop
TOOLS:
  - รัน: <pnpm --filter ... test> (unset NODE_ENV)
  - ระดับ: U | I | E · ต้องใช้ compose: <postgres/redis/minio ?>
DONE:
  - ไฟล์ test: <path>
  - หลักฐาน red→green: คำสั่ง + ผลก่อน/หลัง (หรือ mutation แล้วเห็น fail)
  - รันซ้ำ 3 ครั้งไม่ flaky (แนบผล)
  - สิ่งที่ไม่ได้ตรวจ / คำถามค้าง
  - ส่ง done message กลับ dwight: paths, คำสั่ง+ผล, unverified, open
```

## ตัวอย่างที่กรอกแล้ว (GR-08)
- GOAL: test ว่ากรรมการทุกคนให้คะแนนเหมือนกัน (Cohen n=2, Fleiss n=5) ไม่เกิด NaN/Infinity และผลมี score/lower/upper ครบ
- STATE: Q1 ตัดสินแล้ว (ผลที่เจ้าของเลือก) · โค้ด `packages/shared/src/grading/kappa.ts`
- DONE: `kappa.identical.spec.ts` + red→green + รัน 3 ครั้ง
