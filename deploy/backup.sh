#!/bin/bash
# Backup of one blulens instance (bl-13): PostgreSQL dump + mirror of the MinIO clip bucket to a local folder.
# Run from the folder that holds docker-compose.yml and .env (e.g. /opt/blulens):
#   ./backup.sh                 # uses BACKUP_DIR from .env
# Cron (daily 03:15):  15 3 * * * cd /opt/blulens && ./backup.sh >> /var/log/blulens-backup.log 2>&1
# Restore: docs/ops/runbook.md "Restore". Copy BACKUP_DIR off the Droplet as well (one machine is one failure).
set -euo pipefail

cd "$(dirname "$0")"
set -a
# shellcheck disable=SC1091
. ./.env
set +a

: "${BACKUP_DIR:?BACKUP_DIR is not set in .env}"
: "${POSTGRES_USER:?}" "${POSTGRES_DB:?}" "${MINIO_ROOT_USER:?}" "${MINIO_ROOT_PASSWORD:?}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
BUCKET="${S3_BUCKET:-clips}"
PROJECT="${COMPOSE_PROJECT_NAME:-blulens}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$BACKUP_DIR/db" "$BACKUP_DIR/clips"

echo "==> [1/3] pg_dump $POSTGRES_DB -> $BACKUP_DIR/db/$POSTGRES_DB-$STAMP.dump"
# custom format (-Fc): compressed, restorable table by table with pg_restore
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc \
  >"$BACKUP_DIR/db/$POSTGRES_DB-$STAMP.dump.partial"
mv "$BACKUP_DIR/db/$POSTGRES_DB-$STAMP.dump.partial" "$BACKUP_DIR/db/$POSTGRES_DB-$STAMP.dump"

echo "==> [2/3] mirror bucket $BUCKET -> $BACKUP_DIR/clips"
# mc runs on the instance network and talks to minio directly; --overwrite keeps the mirror exact,
# deleted clips are NOT removed from the mirror (no --remove), so a mistaken delete stays recoverable
docker run --rm --network "${PROJECT}_default" \
  -e MC_HOST_src="http://${MINIO_ROOT_USER}:${MINIO_ROOT_PASSWORD}@minio:9000" \
  -v "$BACKUP_DIR/clips:/backup" \
  --entrypoint sh minio/mc:latest -c \
  "if mc stat src/$BUCKET >/dev/null 2>&1; then mc mirror --overwrite --quiet src/$BUCKET /backup; \
   else echo '    bucket $BUCKET not created yet (no clip uploaded): nothing to mirror'; fi"

echo "==> [3/3] keep $KEEP_DAYS days of dumps"
find "$BACKUP_DIR/db" -name "*.dump" -mtime +"$KEEP_DAYS" -print -delete

echo "==> backup done $STAMP"
