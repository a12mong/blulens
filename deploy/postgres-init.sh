#!/bin/sh
# รันโดย postgres entrypoint ครั้งแรกที่ data volume ว่างเท่านั้น
# (แก้รหัสทีหลังต้อง ALTER ROLE เอง — ดู Troubleshooting ใน docs/setup-guide.md)
#
# สร้าง role blulens_app แบบ "ไม่ใช่ superuser" — จำเป็นเพื่อให้ Row-Level Security
# มีผลจริง (PostgreSQL ยกเว้น RLS ให้ superuser เสมอ แม้ตั้ง FORCE)
# แอป + prisma migrate deploy ต้องต่อด้วย role นี้เท่านั้น
# (ต่างจาก docker/postgres-init.sql ฝั่ง dev: รหัสมาจาก env และไม่ให้ CREATEDB
#  เพราะ production ไม่มี shadow database ของ `migrate dev`)
set -e

psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<EOSQL
CREATE ROLE blulens_app LOGIN PASSWORD '${BLULENS_APP_PASSWORD}' NOSUPERUSER;
GRANT ALL ON DATABASE ${POSTGRES_DB} TO blulens_app;
GRANT ALL ON SCHEMA public TO blulens_app;
EOSQL
