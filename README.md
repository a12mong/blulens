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
| API | http://localhost:3101/api (Swagger: `/api/docs`) |
| PostgreSQL | 5442 |
| Redis | 6389 |
| MinIO | 9100 (API) · 9101 (console) |

## วงจรการพัฒนา (dev loop)

```bash
cp .env.example .env          # ครั้งแรกครั้งเดียว — ห้าม commit .env
pnpm install
docker compose up -d          # postgres / redis / minio (รอจน healthy)
pnpm dev                      # build shared + prisma generate แล้วรัน web + api แบบ watch
curl http://localhost:3100/api/health   # → {"success":true,"data":{"status":"ok"}}
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

## Deploy (สรุป)

`deploy/setup-server.sh` เตรียม Droplet ครั้งแรก → วาง `deploy/docker-compose.yml`, `Caddyfile`,
`postgres-init.sh` และ `.env` (จาก `deploy/.env.example`) ที่ `/opt/blulens` (live) และ
`/opt/blulens-dev` (dev) → `docker compose up -d` — ยังไม่มี CI workflow (ต้องรออนุมัติก่อนเปิด)
