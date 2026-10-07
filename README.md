# blulens

ระบบประเมินฝีมือ จัดการงานแข่ง และจับสายการแข่งขัน — monorepo pnpm + turbo
(โครงยกมาจาก kpaccv2 โดยตัดโมดูลบัญชีออกทั้งหมด)

| ส่วน | ที่อยู่ | เทคโนโลยี |
|---|---|---|
| API | `apps/api` | NestJS 11 + Prisma (PostgreSQL 16) + Redis |
| Web | `apps/web` | Next.js 15 (App Router) — rewrite `/api/*` ไปหา API |
| Shared | `packages/shared` | zod schema + pure domain logic (สมการให้คะแนน, จับสาย) |
| Dev infra | `docker-compose.yml` | PostgreSQL 16 · Redis 7 · MinIO (เก็บคลิป) |
| Production | `deploy/` | Caddy + docker compose บน Droplet เดียว (live + dev) |
| เอกสาร | `docs/` | `specs/` (Jim) · `design/` (Pam) · `frontend/` · `qa/` (Dwight) |

## ต้องมีในเครื่อง

- Node.js 20+ และ pnpm 10 (`corepack enable`)
- Docker Desktop (docker compose)

## พอร์ตตอน dev

ขยับจากค่ามาตรฐานเพื่อไม่ชนกับโปรเจกต์อื่นบนเครื่องเดียวกัน

| บริการ | พอร์ต |
|---|---|
| Web | http://localhost:3100 |
| API | http://localhost:3101/api/v1 (Swagger: `/api/docs`) |
| PostgreSQL | 5442 |
| Redis | 6389 |
| MinIO | 9100 (API) · 9101 (console) |

## วงจรการพัฒนา (dev loop)

```bash
cp .env.example .env          # ครั้งแรกครั้งเดียว — ห้าม commit .env
pnpm install
docker compose up -d          # postgres / redis / minio (รอจน healthy)
pnpm dev                      # build shared + prisma generate แล้วรัน web + api แบบ watch
curl http://localhost:3100/api/v1/health   # → {"success":true,"data":{"status":"ok"}}
```

คำสั่งอื่น:

```bash
pnpm lint          # type-check ทุก package
pnpm test          # unit test (shared: vitest) + e2e (api: jest)
pnpm db:migrate    # prisma migrate dev (หลังแก้ apps/api/prisma/schema.prisma)
pnpm build         # build ทุก package
```

## กติกา git

- `main` = production, `develop` = dev — ห้าม commit ตรงทั้งสอง branch
- ทำงานบน branch `<role>/<card-id>-<slug>` เช่น `be/bl-02-prisma-schema`
- commit เล็ก ๆ แบบ conventional (`feat:`, `fix:`, `chore:` …) แล้วเปิด PR เข้า `develop`
- โค้ด / commit / ข้อความระหว่าง agent เป็นภาษาอังกฤษ; สเปกและเอกสารสำหรับเจ้าของเป็นภาษาไทย

## API_URL และโดเมนไฟล์ (คำตอบ Q7)

**`API_URL` เป็นค่าตอน build ไม่ใช่ runtime** — `rewrites()` ใน `apps/web/next.config.ts` ถูกประเมินตอน
`next build` แล้วฝังลง routes-manifest ของ standalone output การตั้ง env ตอนรัน container จึงไม่มีผล
- dev: อ่านจาก `.env` (`http://localhost:3101`) ตอน `pnpm dev`
- image: `apps/web/Dockerfile` ฝัง `API_URL=http://api:3001` (ชื่อ service ภายใน compose เหมือนกันทั้ง
  live และ dev) จึงใช้ image เดียวได้ทั้งสองฝั่ง — web คุยกับ api ผ่าน network ภายในเท่านั้น
- เบราว์เซอร์เรียก `/api/*` บนโดเมนเว็บเสมอ (same-origin, cookie ไม่ต้องยุ่ง CORS) ไม่มีวันเห็น host ของ api

**คลิปวิดีโอใช้โดเมนไฟล์แยก** (`files.<โดเมน>`) — Caddy `reverse_proxy` ไป MinIO (`deploy/Caddyfile`)
- api เซ็น presigned URL (PUT สำหรับอัป, GET สำหรับดู, อายุสั้น 15 นาที) ด้วย `S3_PUBLIC_ENDPOINT`
  ส่วนงานภายใน (สร้าง bucket, ตรวจไฟล์) ใช้ `S3_ENDPOINT=http://minio:9000`
- ลายเซ็น SigV4 ผูกกับ host — Caddy ส่ง Host เดิมต่อให้ MinIO โดยไม่แก้ จึงต้องเซ็นด้วยโดเมนสาธารณะเท่านั้น
- เบราว์เซอร์อัป/เล่นคลิปตรงกับโดเมนไฟล์ ไม่ผ่าน api (ไม่กินแรม/แบนด์วิดท์ของ Node); Range request ใช้ได้
- CORS: `MINIO_API_CORS_ALLOW_ORIGIN=${WEB_URL}`; bucket `clips` เป็น private, console ของ MinIO ไม่เปิดออกเน็ต
- ต้องมี DNS A record ของ `files.` (และ `files-dev.` ถ้าเปิด dev instance) ชี้ Droplet
- ตอน dev: `S3_PUBLIC_ENDPOINT=http://localhost:9100` (MinIO ตรง ไม่มี Caddy)

## Deploy (สรุป)

`deploy/setup-server.sh` เตรียม Droplet ครั้งแรก → วาง `deploy/docker-compose.yml`, `Caddyfile`,
`postgres-init.sh` และ `.env` (จาก `deploy/.env.example`) ที่ `/opt/blulens` (live) และ
`/opt/blulens-dev` (dev) → `docker compose up -d` — ยังไม่มี CI workflow (ต้องรออนุมัติก่อนเปิด)
