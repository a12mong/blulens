# Slice 3 — เมนู/แชลล์ (nav smoke) และการจับกลุ่ม (group draw)

> Dwight (Lead QA) · ไฟล์ test: `apps/web/e2e/nav.spec.ts`, `apps/web/e2e/slice3-draw.spec.ts` (project `chromium`)
> ผลที่คาดหวังรวม `nav.spec` + `slice3-draw`: **19 passed** (setup 4 + nav 8 + draw 7) ไม่มี known-bug test เหลือ

## 1. Nav smoke (bl-26-p10)
| Step | สิ่งที่ตรวจ |
|---|---|
| N1 ×4 | member1 / reviewer1 / committee / admin เห็นเมนูตามบทบาท (`ของฉัน`, `ตรวจประเมิน`, `ผลประเมิน`, `จัดการผู้ใช้`), ไม่เห็นเมนูที่ไม่มีสิทธิ์ (member ไม่เห็น 4 เมนูของบทบาทอื่น), มี `account-block` / `account-name` / `account-role`, เดสก์ท็อปไม่มีปุ่ม drawer |
| N2 | umpire1 เห็น `บันทึกคะแนน` (บัญชีสร้างด้วย SQL บน `blulens_e2e` ถ้า seed ยังไม่มี) |
| N3 | กดเมนูแล้วไปหน้านั้น; `logout-button` กลับ `/login` (ใช้ `dispatchEvent('click')` เพราะ Next dev indicator ทับปุ่มมุมซ้ายล่างเฉพาะโหมด dev) |
| N4 | 390px: เมนูซ่อน, `drawer-toggle` สูง ≥ 44px, เปิด/ปิด (`aria-expanded`), ลิงก์ใช้ได้, ไม่มี horizontal scroll |
| N5 | หน่วง `/auth/me` 2.5 วินาที → เห็น `menu-skeleton` และไม่มี `account-block` → แล้วเมนูจริง |

## 2. Group draw (bl-25-11)
สร้างทัวร์นาเมนต์ + ประเภท MD (format `groups_knockout`, groupSize 3) + 3 คู่ที่อนุมัติแล้วซึ่งใช้ทีมร่วมกัน (ชนทีมเดียวกันหลีกเลี่ยงไม่ได้) ผ่าน API จริง
| Step | สิ่งที่ตรวจ |
|---|---|
| D1 | ก่อนเผยแพร่ `GET /events/{id}/standings` ว่าง |
| D2 | `/committee/events/{id}/groups`: จับกลุ่ม → 201, `draw-summary`, `group-card`, `draw-conflicts`, ปุ่มเผยแพร่ปิด |
| D3 | สุ่มใหม่ (เหตุผล 4 ตัว = ปิด, ≥ 5 = เปิด) → preview เวอร์ชันใหม่ |
| D4 | ติ๊กรับทราบ + เหตุผล ≥ 5 → เผยแพร่ → ยืนยัน → `draw-published`; `GET /standings` มี 3 แถว played 0 |
| D5 | หน้า `/events/{id}/bracket` (ผู้ใช้ทั่วไป) แสดงกลุ่มที่เผยแพร่แล้ว 3 แถว (develop 3e4941c: fallback เป็น standings เมื่อ bracket 404) |
| D6 | เผยแพร่แล้ว: preview ใหม่/เผยแพร่ซ้ำ → 409 `DRAW_ALREADY_LOCKED` |
| D7 | ตาม spec (`draw.md` §6/§7): preview เก่ายังเผยแพร่ได้ (200) และการเผยแพร่นั้นทำให้ preview ที่ใหม่กว่าถูก discard (เผยแพร่ซ้ำ → 409 `DRAW_ALREADY_LOCKED`) |

รอ: Kevin เพิ่มบังคับ `reason` สำหรับ preview ครั้งที่สอง (400 VALIDATION_FAILED) — จะเพิ่ม step เมื่อได้ sha.
Mutation (ทำมือ ไม่ commit): เปลี่ยน label เมนู `ผลประเมิน` → N1 committee/admin, N3, N4 แดง; ถอดเงื่อนไข ack+เหตุผลของปุ่มเผยแพร่ → D2 แดง.

**เส้นทางสำหรับ STATUS (Jim) — จับกลุ่ม:** Committee เปิดประเภทการแข่ง → **จัดกลุ่ม** (`/committee/events/<รหัส>/groups`) → **จับกลุ่ม** → ดูกลุ่ม (ถ้ามีทีมชนกัน ติ๊ก รับทราบ + ใส่เหตุผล ≥ 5 ตัว หรือกด **สุ่มใหม่**) → **เผยแพร่** → ยืนยัน → ขึ้น "เผยแพร่แล้ว" (หน้าสายสาธารณะ `/events/<รหัส>/bracket` แสดงตารางกลุ่ม)

## 3. Re-preview ต้องมีเหตุผล (BE 5d8dac2, FE aea8c8a)
- D3: สุ่มใหม่ผ่าน UI (เหตุผล ≥ 5 ตัว) สำเร็จ — FE ส่ง `reason` ใน body แล้ว
- D8 (API, อีเวนต์ใหม่): preview ครั้งแรกไม่ต้องมีเหตุผล (201); ครั้งที่สองไม่มี/สั้น 4 ตัว/ยาว 2001 ตัว → 400 `VALIDATION_FAILED`; 5 ตัว → 201
- D3b **KNOWN ISSUE** (`test.fail`): หลังรีโหลดหน้า `/committee/events/{id}/groups` ที่มี preview อยู่แล้ว หน้าไม่แสดง preview เดิม และกด "จับกลุ่ม" ส่ง re-preview ที่ไม่มีเหตุผล → 400 แสดง "ข้อมูลไม่ถูกต้อง" (FE ควรโหลด preview ล่าสุดหรือขอเหตุผล). ลบ `test.fail` เมื่อแก้
- D2–D4 ใช้หน้าเดียวต่อเนื่องเพราะเหตุผลข้างต้น
