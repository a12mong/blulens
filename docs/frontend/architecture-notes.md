# blulens — บันทึกสถาปัตยกรรม Frontend (ร่าง)

> ผู้เขียน: Andy (Senior FE) · card bl-15 (prep) · สถานะ: **ร่าง** — ยังไม่มีโค้ด รอ API contract (bl-02) และ design spec (bl-05) ที่เจ้าของอนุมัติก่อนเริ่ม bl-08
> อ้างอิง pattern จาก `kpaccv2/apps/web` (next.config rewrite, middleware, providers) และ `bad8bit` (pixel style / design tokens)

## 1. โครงสร้าง `apps/web` (Next.js 15, App Router)

```
apps/web/
  app/
    layout.tsx            # html, ธีม (daylight/night), <Providers>
    providers.tsx         # QueryClientProvider + SessionProvider
    (public)/             # Guest: หน้าแรก, ตารางสาย/ผลแข่งสาธารณะ, login
    (member)/             # Member: โปรไฟล์, ผลประเมินของตัวเอง, สมัครแข่ง
    (reviewer)/review/    # Reviewer: คิวคลิป, หน้าประเมิน
    (committee)/committee/# Committee: kappa/outlier, อนุมัติผล, draw
    (admin)/admin/        # Admin: ผู้ใช้, role, ทีม, ตั้งค่าระบบ
    403/  not-found.tsx
  components/ui/          # primitives: Button, Input, Panel, Tabs, Badge, Table ...
  components/layout/      # AppShell, SideNav (ตาม role), TopBar
  features/<domain>/      # api.ts (hooks), components/, schema (zod จาก packages/shared)
  lib/api.ts              # fetch wrapper (same-origin /api, credentials include)
  lib/session.ts          # useSession, canAccess(role, area)
  middleware.ts
  next.config.ts
```

หลักการ: route group แยกตาม role เพื่อให้แต่ละกลุ่มมี `layout.tsx` ของตัวเอง (nav + guard); โค้ดที่ใช้ร่วมอยู่ `components/` และ `features/`; type/zod schema มาจาก `packages/shared` ที่เดียว (ไม่นิยามซ้ำฝั่ง web)

### Role → พื้นที่ที่เข้าได้ (ร่าง — รอ Jim ยืนยันตาราง permission)

| Role | public | member | reviewer | committee | admin |
|---|---|---|---|---|---|
| Guest | ✔ | | | | |
| Member | ✔ | ✔ | | | |
| Reviewer | ✔ | ✔ | ✔ | | |
| Committee | ✔ | ✔ | ✔ | ✔ | |
| Admin | ✔ | ✔ | ✔ | ✔ | ✔ |

(สมมติลำดับสิทธิ์แบบ superset — ต้องยืนยัน ดูคำถามข้อ Q3)

## 2. Auth / session

- Session เป็น **httpOnly cookie** ที่ API ตั้ง (same-origin ผ่าน rewrite จึงไม่ต้องยุ่ง CORS) — frontend ไม่เก็บ token ใน localStorage
- `middleware.ts`: ชั้นแรกเท่านั้น — ไม่มี cookie → redirect `/login?next=…`; มี cookie แต่เข้าหน้า login → ไป home ของ role. **การตรวจสิทธิ์จริงอยู่ที่ API เสมอ** (ตาม kpaccv2)
- `GET /api/auth/me` → `{ id, name, role, teamId }` โหลดครั้งเดียวด้วย TanStack Query (`['session']`, staleTime ยาว) ผ่าน `SessionProvider`/`useSession()`
- แต่ละ route group มี `layout.tsx` (server/client guard) เช็ก `canAccess(role, area)`; ไม่ผ่าน → `/403`. 401 จาก API ใด ๆ → clear cache `['session']` แล้ว redirect login (จัดการใน `lib/api.ts` จุดเดียว)
- ปุ่ม/เมนูซ่อนตาม role เป็นเพียง UX ไม่ใช่ security
- Reviewer ต้องไม่เห็นคะแนนของ reviewer คนอื่นก่อนส่งของตัวเอง (blind review) — UI แค่ไม่ขอ field นั้น; การบังคับอยู่ที่ API (Q4)

## 3. TanStack Query

- `QueryClient` เดียวใน `providers.tsx`: `staleTime` 30s, `retry` 1 (ไม่ retry 401/403/404), `refetchOnWindowFocus` ปิดในหน้าประเมิน (กันฟอร์มที่กำลังกรอกถูก refetch ทับ)
- Query key มาตรฐาน: `[domain, resource, params]` เช่น `['clips', 'queue', {status}]`; สร้างผ่าน key factory ใน `features/<domain>/keys.ts`
- ทุก hook อยู่ใน `features/<domain>/api.ts` (`useXxx` / `useXxxMutation`) — component ห้ามเรียก `fetch` ตรง
- Mutation สำเร็จ → `invalidateQueries` ตาม key ของ domain; optimistic update เฉพาะที่จำเป็น (เช่นบันทึกคะแนนร่าง)
- Response parse ด้วย zod จาก `packages/shared` ใน `lib/api.ts` — schema ไม่ตรง = error ชัดเจน ไม่ปล่อยค่าเพี้ยนเข้า UI

## 4. Next rewrites + Docker network + Caddy

```ts
// next.config.ts (pattern เดียวกับ kpaccv2)
const API_URL = process.env.API_URL ?? 'http://localhost:3001'; // docker: http://api:3001
rewrites: [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }]
output: process.env.BUILD_STANDALONE === '1' ? 'standalone' : undefined
```

- Browser เรียก **same-origin `/api/*` เท่านั้น** → Caddy `reverse_proxy web:3000` → Next rewrite ไป `http://api:3001` ภายใน Docker network. API ไม่เปิดพอร์ตสู่ภายนอก, ไม่มี CORS
- **`API_URL` เป็น build-time** (ยืนยันโดย Kevin, README หัวข้อ Q7): rewrite ถูก bake ตอน `next build`; image web bake `http://api:3001`; browser เรียกแค่ same-origin `/api/*`; dev ใช้ `.env` `API_URL=http://localhost:3101` (web 3100) — เปลี่ยนค่าต้อง rebuild image
- ข้อจำกัด: rewrite proxy ของ Next มี body limit/timeout → **อัปโหลดคลิปห้ามผ่าน Next** (ดูข้อ 5)
- Caddyfile ใช้ pattern `deploy/Caddyfile` ของ kpaccv2 (`encode gzip`, `reverse_proxy web:3000`); MinIO อยู่โดเมนแยก `files.<domain>` หลัง Caddy (`FILES_ADDRESS` → `minio:9000`) ให้ browser ดึง/อัปโหลดคลิปด้วย presigned URL; Caddy ส่ง Host ผ่านเพื่อให้ SigV4 ตรวจผ่าน และ block files ไม่เปิด gzip เพื่อให้ Range ทำงาน; bucket `clips` เป็น private, ไม่เปิด console

## 5. Video player — คลิปประเมินมือ (MinIO signed URL)

- Flow เล่น: หน้าประเมินเรียก `GET /api/clips/:id/playback` → `{ url, expiresAt, mime }` (presigned GET ของ MinIO) → `<video src={url}>` เล่นตรง ไม่ผ่าน Next
- Component `VideoPlayer` (shell, bl-08): native `<video controls playsInline preload="metadata">`, ปุ่ม speed (0.5/1/1.5/2), step ±1 เฟรม/±5 วิ, loop ช่วง, keyboard (space, ←/→, J/L). ไม่ดึง library หนัก (ถ้าจำเป็นค่อย `hls.js` ภายหลัง — Q6 ถามว่าคลิปเป็น mp4 ตรงหรือ HLS)
- URL หมดอายุ: เก็บใน Query (`staleTime` = expiresAt − 60s); เมื่อ `<video>` error / `expiresAt` ใกล้ถึง → refetch แล้วเล่นต่อที่ `currentTime` เดิม
- Signed URL (GET/PUT) อายุ **15 นาที** ลงนามกับ `S3_PUBLIC_ENDPOINT` = `https://files.<domain>` (dev `http://localhost:9100`) — ไม่ใช่ `minio:9000` ภายใน; รองรับ Range (seek ได้). _ปิดแล้ว: Q5 host/TTL/Range, Q7_
- อัปโหลด: presigned PUT ตรงไป MinIO (ผ่าน `POST /api/clips/upload-url`) พร้อม progress bar; ยืนยันด้วย `POST /api/clips/:id/complete`
- ไม่มี autoplay; ไม่แสดง URL ให้ผู้ใช้คัดลอกง่าย (ไม่ใช่ DRM — อย่างน้อย TTL สั้น)

## 6. การแสดงผล lower / upper / score

ตาม TEAM.md §6 (รูปแบบผลลัพธ์จาก bad8bit `GradeProjection`): ทุกผลประเมิน = `score` + `lower` + `upper` (grade key 15 ขั้น RK1..P) — web **ไม่คำนวณ** แค่แสดง

- `GradeBand` component: แถบ 15 ช่องตามบันไดเกรด (สี tier Rookie/Beginner/Standard/Neutral/Professional จาก tokens), ไฮไลต์ช่วง `lower..upper`, มาร์กเกอร์ที่ตำแหน่ง center/`score`
  - `lower == upper` → ช่องเดียว (exact); คนละช่องติดกัน → straddle; ห่างกว่า → wide (ถ้า API ส่ง `kind` มาก็ใช้ตามนั้น ไม่ derive เอง)
- ป้ายข้อความ (`txt`) ใช้ที่ API ส่งมา; fallback `"{lower}–{upper}"`
- Accessibility: ไม่พึ่งสีอย่างเดียว — มี text label + `aria-label="เกรด {lower} ถึง {upper} คะแนน {score}"`
- มุมมอง Committee: ซ้อนคะแนนต่อ reviewer เป็นจุดบนแถบ + badge kappa/outlier (รูปแบบรอ Pam)
- Reviewer ที่ยังไม่ส่ง: ไม่แสดง band รวม (blind)

## 7. UI primitives + style

- Pixel style ตาม `bad8bit/team/style-guide-pixel.md` + `design-tokens.md`; token อยู่ `app/globals.css` (Tailwind v4 `@theme`), ธีม daylight เป็น default / night ผ่าน `[data-theme]` + `prefers-color-scheme` (ตามที่ bad8bit T5 กำหนด) — **ค่าจริงของ blulens รอ Pam (bl-05)** ไม่คัดลอกสีมาเอง
- กฎจาก bad8bit ที่นำมาใช้แน่นอน: focus `:focus-visible` outline 2px, ขอบ control ≥ 3:1, target ≥ 24×24 (มือถือ 44×44 สำหรับ action หลัก)
- ทุก primitive มี story/ตัวอย่างใน `/dev/ui` (เฉพาะ dev) ให้ Dev FE เปิดดูได้

## 8. Testing (ฝั่ง FE)

- Unit/component: Vitest + Testing Library (1 component = 1 test file); mock fetch ผ่าน MSW ที่ระดับ `lib/api.ts`
- Contrast test ของ token (แบบ bad8bit `contrast.test.ts`) เมื่อได้ token จาก Pam
- E2E ให้ Dwight/Toby (Playwright) — ไม่อยู่ในขอบเขตนี้

## 9. คำถามที่ต้องตอบก่อน bl-08

**ถึง Jim (API / permission)**
- Q1. รูปแบบ response/ error มาตรฐาน (envelope? `{error:{code,message}}`)? มี OpenAPI หรือ zod ใน `packages/shared` ให้ import?
- Q2. Auth: cookie ชื่ออะไร, login/logout/me endpoint, มี CSRF token ไหม (cookie same-site?), session หมดอายุ/refresh อย่างไร?
- Q3. ตาราง permission จริงของ 5 roles — เป็น superset ตามที่สมมติหรือแยก? Guest เห็นอะไรได้บ้าง? ผู้ใช้ 1 คนมีหลาย role ได้ไหม?
- Q4. Blind review บังคับที่ API ใช่ไหม; endpoint ผลรวมมี `lower/upper/score/kind/txt` ครบหรือต้อง derive ฝั่ง web?
- Q5. Playback: `GET /clips/:id/playback` ส่ง presigned URL ของ host ไหน, TTL เท่าไร, รองรับ Range request?
- Q6. คลิปเป็น mp4 (H.264) ตรงหรือ HLS? ขนาด/ความยาวสูงสุด, upload ผ่าน presigned PUT หรือ multipart ผ่าน API?
- Q7 (ร่วม Kevin). `API_URL` ใน Docker: อ่านตอน runtime ได้ไหมหรือต้อง build-arg; domain/route ของ MinIO หลัง Caddy
- Q8. pagination / filter / sort convention ของ list endpoints; realtime (SSE/polling) จำเป็นไหม (เช่นสถานะ draw)

**ถึง Pam (design)**
- P1. ชุด token ของ blulens (สี/radius/font) — ใช้ daylight/night แบบ bad8bit หรือชุดใหม่? พาเลต tier 5 กลุ่มของ grade band
- P2. Layout ต่อ role: nav (sidebar vs top), หน้า home ของแต่ละ role, breakpoints ที่ต้องรองรับ (มือถือสำหรับ Reviewer ไหม?)
- P3. หน้าประเมิน: ตำแหน่ง player vs rubric form, state ต่าง ๆ (loading/ร่าง/ส่งแล้ว/URL หมดอายุ)
- P4. รูปแบบ GradeBand ที่ Committee เห็น (หลาย reviewer + kappa/outlier) และ bracket/draw view
- P5. ภาษา UI (ไทยล้วน/สองภาษา?) และ font ที่รองรับไทยในสไตล์ pixel
