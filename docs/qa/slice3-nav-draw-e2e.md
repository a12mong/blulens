# Slice 3 — เมนู/แชลล์ (nav smoke) และการจับกลุ่ม (group draw)

> Dwight (Lead QA) · ไฟล์ test: `apps/web/e2e/nav.spec.ts`, `apps/web/e2e/slice3-draw.spec.ts` (project `chromium`)
> ผลที่คาดหวังรวม `nav.spec` + `slice3-draw`: **19 passed** (setup 4 + nav 8 + draw 7) โดยมี test D7 เป็น "known bug" (`test.fail`) ที่นับว่าผ่านจนกว่าจะแก้ product

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
| D5 | หน้า `/events/{id}/bracket` (ผู้ใช้ทั่วไป) แสดงกลุ่มที่เผยแพร่แล้ว 3 แถว (แก้แล้วที่ develop 3e4941c: fallback เป็น standings เมื่อ bracket 404) |
| D6 | เผยแพร่แล้ว: preview ใหม่/เผยแพร่ซ้ำ → 409 `DRAW_ALREADY_LOCKED` |
| D7 | **KNOWN BUG**: หลังสร้าง preview ใหม่ ยังเผยแพร่ preview เก่าได้ (200) ทั้งที่ควร 409 `DRAW_VERSION_CONFLICT` (Thai text มีใน `lib/errors.ts` แต่ code นี้ถูกโยนเฉพาะกรณี race ตอนสร้างเวอร์ชัน) |

เมื่อแก้ D7 แล้วให้ลบ `test.fail(...)` ออก (test จะแดงเพื่อเตือน).
Mutation (ทำมือ ไม่ commit): เปลี่ยน label เมนู `ผลประเมิน` → N1 committee/admin, N3, N4 แดง; ถอดเงื่อนไข ack+เหตุผลของปุ่มเผยแพร่ → D2 แดง.

**เส้นทางสำหรับ STATUS (Jim) — จับกลุ่ม:** Committee เปิดประเภทการแข่ง → **จัดกลุ่ม** (`/committee/events/<รหัส>/groups`) → **จับกลุ่ม** → ดูกลุ่ม (ถ้ามีทีมชนกัน ติ๊ก รับทราบ + ใส่เหตุผล ≥ 5 ตัว หรือกด **สุ่มใหม่**) → **เผยแพร่** → ยืนยัน → ขึ้น "เผยแพร่แล้ว" (หน้าสายสาธารณะ `/events/<รหัส>/bracket` แสดงตารางกลุ่ม)
