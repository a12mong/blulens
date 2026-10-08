# การ deploy blulens (bl-13)

> เอกสารออกแบบของการ deploy · ขั้นตอนลงมือทำอยู่ใน [runbook.md](runbook.md)
> หลักการ: Droplet เครื่องเดียว · ทุกอย่างรันด้วย Docker Compose · ไม่มีค่าลับใน repo

## 1. ภาพรวม

```
อินเทอร์เน็ต ──443──▶ caddy ──▶ web (Next.js :3000) ──/api/*──▶ api (NestJS :3001)
                         └────▶ minio (:9000)  ← โดเมนไฟล์ สำหรับ presigned URL ของคลิป
api ──▶ postgres 16 · redis 7 · minio        (เครือข่ายภายใน compose เท่านั้น)
```

| service | image | เปิดออกเน็ต | หมายเหตุ |
|---|---|---|---|
| `caddy` | `caddy:2-alpine` | 80/443 | ขอใบรับรอง HTTPS อัตโนมัติ (Let's Encrypt) · รันเฉพาะ instance live (`COMPOSE_PROFILES=edge`) |
| `web` | `blulens-web` | ผ่าน caddy | Next.js standalone · `/api/*` ส่งต่อไป `api:3001` (ฝังตอน build) |
| `api` | `blulens-api` | ไม่ | ตอนเริ่ม container: `prisma migrate deploy` → seed (เฉพาะ `SEED_ON_BOOT=1`) → API |
| `postgres` | `postgres:16-alpine` | ไม่ (127.0.0.1 เท่านั้น) | แอปต่อด้วย role `blulens_app` (ไม่ใช่ superuser) |
| `redis` | `redis:7-alpine` | ไม่ | appendonly |
| `minio` | `minio/minio` | ผ่าน caddy (โดเมนไฟล์) | bucket `clips` เป็น private · API สร้าง bucket เองเมื่ออัปโหลดครั้งแรก |

ข้อมูลถาวรอยู่ใน named volume: `postgres_data`, `redis_data`, `minio_data`, `caddy_data`, `caddy_config`

## 2. ไฟล์ใน `deploy/`

| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `docker-compose.yml` | stack production (ใช้ image จาก ghcr.io เมื่อมี CI) |
| `docker-compose.build.yml` | override: build image บน Droplet จาก repo (ใช้จนกว่าจะมี CI) |
| `docker-compose.verify.yml` + `verify-local.sh` | ทดสอบ stack production บนเครื่อง dev (พอร์ตว่าง, ค่าลับสุ่มทิ้ง) |
| `.env.example` | **ชื่อตัวแปร + คำอธิบายเท่านั้น** ค่าจริงอยู่ใน `.env` บน Droplet (`chmod 600`) |
| `Caddyfile` | โดเมนมาจาก env (`SITE_ADDRESS`, `FILES_ADDRESS`) ไม่มีโดเมนจริงในไฟล์ |
| `postgres-init.sh` | สร้าง role `blulens_app` ครั้งแรกที่ volume ว่าง |
| `setup-server.sh` | เตรียม Ubuntu 24.04 ครั้งเดียว: Docker, swap 2G, firewall (22/80/443), network `edge` |
| `backup.sh` | `pg_dump` + mirror bucket คลิปลงโฟลเดอร์ `BACKUP_DIR` |

## 3. การตัดสินใจ

- **Migration ตอนบูต** — `api` รัน `prisma migrate deploy` ทุกครั้งที่เริ่ม ไม่มีอะไรค้างก็ไม่ทำอะไร · migration ของ blulens เป็นแบบ additive เท่านั้น (กฎเจ้าของ) จึงรัน image ใหม่ทับ DB เดิมได้
- **Seed** — idempotent รันซ้ำได้ · เปิดด้วย `SEED_ON_BOOT=1` เฉพาะครั้งแรก (สร้าง Admin + rubric grading-v1) แล้วตั้งกลับเป็น `0` · `SEED_DEMO=1` ห้ามใช้กับ instance จริง
- **Rollback** — ย้อน image ได้ทันที (`IMAGE_TAG` ก่อนหน้า) · ย้อน schema ไม่ได้ (migration เดินหน้าอย่างเดียว) ถ้าข้อมูลเสียให้ restore จาก backup
- **คลิป** — เบราว์เซอร์อัป/ดูตรงกับ MinIO ผ่านโดเมนไฟล์ด้วย presigned URL อายุ 15 นาที · `S3_PUBLIC_ENDPOINT` ต้องเป็นโดเมนไฟล์ (ลายเซ็นผูกกับ host) · CORS ของ MinIO อนุญาตเฉพาะ `WEB_URL`
- **Image** — ตอนนี้ build บน Droplet (`docker-compose.build.yml`) · เมื่อเจ้าของตัดสินใจใช้ CI (GitHub Actions → ghcr.io) ค่อยเปลี่ยนเป็น `pull` ด้วย `GHCR_OWNER` + `IMAGE_TAG`

## 4. ขนาดเครื่องที่แนะนำ

Droplet 2 vCPU / 4 GB RAM / 80 GB SSD (+ swap 2G จาก `setup-server.sh`) — build Next.js บนเครื่องต้องใช้ RAM ~2–3 GB ·
พื้นที่คลิป: สูงสุด 500 MB/คลิป × 3 คลิป/คำขอ ถ้าคลิปเยอะให้เพิ่ม Volume ของ DigitalOcean แล้วย้าย `minio_data` ไปไว้บนนั้น

## 5. ตรวจบนเครื่อง dev

```bash
bash deploy/verify-local.sh     # build → up → ตรวจ /api/v1/health, หน้าแรก, /api/v1/rubric, minio ผ่าน caddy → down -v
```
ใช้พอร์ต `127.0.0.1:18080` (HTTP) และ `127.0.0.1:15432` (postgres) — ไม่แตะ stack dev ของเจ้าของ (3100/3101/5442/6389/9100)
