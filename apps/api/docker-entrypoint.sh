#!/bin/sh
# Container start for the api image (bl-13):
#   1. prisma migrate deploy  - applies pending migrations; a no-op when the schema is current
#   2. idempotent seed        - only when SEED_ON_BOOT=1 (first deploy / demo); re-running is safe
#   3. the API itself
set -e

echo "[entrypoint] prisma migrate deploy"
prisma migrate deploy --schema=prisma/schema.prisma

if [ "${SEED_ON_BOOT:-0}" = "1" ]; then
  echo "[entrypoint] SEED_ON_BOOT=1: running the idempotent seed"
  node dist-seed/prisma/seed.js
fi

exec node dist/main.js
