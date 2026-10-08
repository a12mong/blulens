# Runbook: deploy / อัปเดต / ย้อนกลับ / กู้ข้อมูล (bl-13)

> ออกแบบและเหตุผลอยู่ใน [deploy.md](deploy.md) · ทุกคำสั่งรันบน Droplet ในโฟลเดอร์ `/opt/blulens/deploy` เว้นแต่ระบุ
> **การ deploy จริงต้องได้รับอนุมัติจากเจ้าของผ่าน god ทุกครั้ง**

## สิ่งที่เจ้าของต้องเตรียม (OWNER NEEDS)

- **Droplet** DigitalOcean Ubuntu 24.04 · 2 vCPU / 4 GB RAM / 80 GB SSD (เพิ่ม Volume ภายหลังถ้าคลิปเยอะ) · region สิงคโปร์ (SGP1)
- **โดเมน** + DNS A record 2 ชื่อชี้ IP ของ Droplet: `app.<โดเมน>` (เว็บ) และ `files.<โดเมน>` (ไฟล์คลิป)
- **SSH key** ของคนที่ได้สิทธิ์เข้าเครื่อง (root ครั้งแรก)
- **สิทธิ์อ่าน repo บน Droplet** (deploy key แบบ read-only ของ GitHub) เพื่อ `git clone`
- **ผู้ถือค่าลับ** (เก็บในตัวจัดการรหัสผ่านของเจ้าของ ไม่ส่งในแชต): `POSTGRES_PASSWORD`, `BLULENS_APP_PASSWORD`, `MINIO_ROOT_PASSWORD`, `S3_SECRET_KEY`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `SEED_ADMIN_PASSWORD` — ระบุชื่อคนถือ 1 คน + สำรอง 1 คน
- **อีเมล Admin คนแรก** (`SEED_ADMIN_EMAIL`)
- **ที่เก็บ backup นอกเครื่อง** (เช่น DigitalOcean Spaces หรือคอมของเจ้าของ) — ตัดสินใจภายหลังได้ แต่ก่อนเปิดใช้จริง

## 1. Deploy ครั้งแรก

```bash
# จากเครื่องผู้ดูแล
scp deploy/setup-server.sh root@<IP>:/root/ && ssh root@<IP> "bash /root/setup-server.sh"

# บน Droplet
git clone <repo> /opt/blulens && cd /opt/blulens && git checkout <release-tag>
cd deploy && cp .env.example .env && chmod 600 .env
nano .env   # ใส่ค่าทุกตัว: สุ่มค่าลับด้วย `openssl rand -hex 32` ทีละตัว
            # COMPOSE_PROJECT_NAME=blulens, EDGE_ALIAS=live, COMPOSE_PROFILES=edge, IMAGE_TAG=<release-tag>
            # SITE_ADDRESS=app.<โดเมน>, FILES_ADDRESS=files.<โดเมน>, WEB_URL=https://app.<โดเมน>
            # S3_PUBLIC_ENDPOINT=https://files.<โดเมน>, SEED_ON_BOOT=1, SEED_ADMIN_EMAIL/PASSWORD
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
docker compose logs -f api   # รอเห็น "[entrypoint] prisma migrate deploy" → seed → API พร้อม
```
ตรวจ: `https://app.<โดเมน>` เปิดหน้าแรกได้ · `https://app.<โดเมน>/api/v1/health` ตอบ 200 · ล็อกอิน Admin ได้

แล้ว **ตั้ง `SEED_ON_BOOT=0` ใน `.env`** และเปิด backup รายวัน:
```bash
crontab -e   # 15 3 * * * cd /opt/blulens/deploy && ./backup.sh >> /var/log/blulens-backup.log 2>&1
```

## 2. อัปเดตเวอร์ชัน

```bash
cd /opt/blulens/deploy && ./backup.sh                  # backup ก่อนทุกครั้ง
cd /opt/blulens && git fetch --tags && git checkout <new-tag>
cd deploy && sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=<new-tag>/' .env
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
docker compose ps && docker compose logs --tail 50 api
```
`api` รัน migration ใหม่เองตอนเริ่ม · ช่วงสลับ container เว็บจะหยุดไม่กี่วินาที

## 3. ย้อนกลับ (rollback)

```bash
cd /opt/blulens && git checkout <previous-tag>
cd deploy && sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=<previous-tag>/' .env
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d   # image เดิมยังอยู่ ไม่ต้อง build ใหม่
```
schema ไม่ถูกย้อน (migration เป็นแบบเพิ่มอย่างเดียว เวอร์ชันเก่าจึงอ่าน DB ใหม่ได้) · ถ้าข้อมูลเสียหาย → ข้อ 4

## 4. กู้ข้อมูล (restore)

```bash
cd /opt/blulens/deploy
docker compose stop api web
# ฐานข้อมูล: ไฟล์ล่าสุดใน $BACKUP_DIR/db/
docker compose exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner \
  < /var/backups/blulens/db/<ไฟล์>.dump
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO blulens_app; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO blulens_app;"
# คลิป: ส่ง mirror กลับเข้า bucket
docker run --rm --network blulens_default -e MC_HOST_dst="http://<MINIO_ROOT_USER>:<MINIO_ROOT_PASSWORD>@minio:9000" \
  -v /var/backups/blulens/clips:/backup minio/mc:latest mirror --overwrite /backup dst/clips
docker compose start api web
```
ทดสอบ restore อย่างน้อยไตรมาสละครั้งบน instance dev (`/opt/blulens-dev`) — backup ที่ไม่เคยลอง restore ถือว่ายังไม่มี

## 5. ปัญหาที่พบบ่อย

| อาการ | สาเหตุ / ทางแก้ |
|---|---|
| `api` restart วน · log มี `P1000` | `DATABASE_URL` ไม่ตรงกับ `BLULENS_APP_PASSWORD` (role ถูกสร้างครั้งแรกเท่านั้น ถ้าเปลี่ยนรหัสภายหลังต้อง `ALTER ROLE blulens_app PASSWORD '…'`) |
| อัปโหลดคลิปแล้ว 403 | เบราว์เซอร์ส่ง Content-Type ไม่ตรงกับที่ขอ upload-url หรือ `S3_PUBLIC_ENDPOINT` ไม่ใช่โดเมนไฟล์ |
| อัปโหลดโดน CORS | `WEB_URL` ใน `.env` ต้องตรงกับ origin ของเว็บทุกตัวอักษร (https, ไม่มี / ท้าย) แล้ว `up -d minio` ใหม่ |
| Caddy ขอใบรับรองไม่ได้ | DNS A record ยังไม่ชี้ IP หรือ firewall ปิด 80/443 |
