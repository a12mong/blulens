# Stitch prompt pack (project `blulens`)

> Pam · เตรียมไว้ก่อน Stitch MCP พร้อม · ใช้ร่วมกับ `../contract-alignment.md` (ยึดไฟล์นั้นเมื่อขัดกัน) · ภาษา UI = ไทย (ข้อความตัวอย่างเป็นไทย)
> ทุก prompt: "mobile 360px first, then desktop 1280; warm light theme tokens bg #f6f1ea panel #fffdf9 text #2b2238 accent #4b4fd6; radius 12; no emoji; Thai text in a normal sans font; focus ring 2px accent"

| Screen (โฟลเดอร์) | Spec | ใจความ prompt |
|---|---|---|
| `auth` | S02 | login + register, คอลัมน์เดียว, error ข้อความเดียว |
| `event-create` | S03 | wizard 5 ขั้น (stepper), ฟอร์มขั้น 1–2, ปุ่มถัดไป/ย้อน |
| `registration` | S05 | "สมัครอีเวนต์ด้วยเกรดที่อนุมัติแล้ว" + การ์ดเกรดตนเอง + CTA ขอประเมิน; หน้า S05a อัปโหลดคลิปอย่างเดียว (แถบความคืบหน้า, ≤3 คลิป, mp4 ≤500MB ≤5 นาที) |
| `review-scoring` | S07 | มือถือ: player ติดบน, rubric ด้านล่าง; ต่อหัวข้อ: 5 ปุ่ม tier → 3 ปุ่มขั้นย่อย (RK1..P+) + "ประเมินไม่ได้"; คอมเมนต์รวมเดียว; แถบล่าง "ร่างอยู่ในเครื่องนี้" + ส่ง. desktop 2 คอลัมน์ |
| `committee-dashboard` | S08/S09 | 4 stat tiles, heatmap kappa (ตัวเลขทุกช่อง + ไอคอนระดับ), ตารางผลพร้อม GradeBand score+lower–upper, drawer outlier read-only + 3 ปุ่ม อนุมัติ/ส่งกลับ/override |
| `bracket` | S10 | **pixel style bad8bit**: พื้น night #1c1926 panel #262234 line #7d7292, ตัวเลข/หัวรอบ Press Start 2P, เส้นสายมุมฉาก 2px, ไม่มีมุมโค้ง, ไม่มี GradeBand (Guest), ชื่อ+ทีม+ผลแมตช์, BYE, ผู้ชนะ badge; mobile = รายการตามรอบ |

ข้อกำหนดการส่งออก: HTML/CSS + screenshot ต่อหน้าจอ → `docs/design/stitch/<screen>/` (ไฟล์ `index.html`, `screenshot.png`) และลิงก์จากสเปกหน้าจอ. ห้ามใส่ API key ในไฟล์ใด ๆ.

## เพิ่ม (v3)

| Screen | Spec | ใจความ prompt |
|---|---|---|
| `umpire-matches` | S13 | มือถือ: รายการแมตช์ของฉัน + หน้ากรอกผลสองเกม ปุ่ม +/- ใหญ่ ตรวจรูปแบบ 2x15 / bo3x21 ป้ายรอยืนยัน |
| `results-queue` | S14 | desktop: ตารางผลรอยืนยัน ธง ปุ่มยืนยัน/ตีกลับ(เหตุผล) |
| `umpire-assignment` | S15 | แผงสนาม + chip Umpire + ตารางแมตช์ |
| `calibration` | S16 | ตารางคลิป × reviewer + bias |
| bracket เพิ่ม | S10 | แท็บรอบกลุ่ม ตารางอันดับ + ป้าย "รอยืนยัน" (pixel night ไม่มีเกรด) |
