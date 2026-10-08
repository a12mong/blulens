#!/bin/bash
# Brings the production compose stack up locally from this checkout, checks it, and tears it down (bl-13).
# Secrets are random throwaway values generated per run into a temp env file; nothing is written to deploy/.
#   bash deploy/verify-local.sh          # up, check, down -v
#   KEEP=1 bash deploy/verify-local.sh   # leave it running (tear down: see the last line it prints)
set -euo pipefail

cd "$(dirname "$0")"
HTTP_PORT="${VERIFY_HTTP_PORT:-18080}"
ENV_FILE="$(mktemp)"
rnd() { node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"; }

APP_PW="$(rnd)"
MINIO_USER="verify$(rnd | cut -c1-8)"
MINIO_PW="$(rnd)"
cat >"$ENV_FILE" <<EOF
COMPOSE_PROJECT_NAME=blulens-verify
EDGE_ALIAS=live
COMPOSE_PROFILES=edge
SITE_ADDRESS=http://app.localhost
FILES_ADDRESS=http://files.localhost
WEB_URL=http://app.localhost:${HTTP_PORT}
COOKIE_SECURE=false
POSTGRES_USER=blulens
POSTGRES_PASSWORD=$(rnd)
POSTGRES_DB=blulens
BLULENS_APP_PASSWORD=${APP_PW}
DATABASE_URL=postgresql://blulens_app:${APP_PW}@postgres:5432/blulens?schema=public
MINIO_ROOT_USER=${MINIO_USER}
MINIO_ROOT_PASSWORD=${MINIO_PW}
S3_ACCESS_KEY=${MINIO_USER}
S3_SECRET_KEY=${MINIO_PW}
S3_PUBLIC_ENDPOINT=http://files.localhost:${HTTP_PORT}
JWT_ACCESS_SECRET=$(rnd)
JWT_REFRESH_SECRET=$(rnd)
SEED_ON_BOOT=1
SEED_ADMIN_EMAIL=admin@verify.local
SEED_ADMIN_PASSWORD=$(rnd)
EOF

dc() { docker compose --env-file "$ENV_FILE" -f docker-compose.yml -f docker-compose.verify.yml "$@"; }
cleanup() {
  if [ "${KEEP:-0}" != "1" ]; then
    echo "==> tear down"
    dc down -v --remove-orphans >/dev/null 2>&1 || true
    rm -f "$ENV_FILE"
  else
    echo "==> left running; tear down with: docker compose --env-file $ENV_FILE -f deploy/docker-compose.yml -f deploy/docker-compose.verify.yml down -v"
  fi
}
trap cleanup EXIT

echo "==> build + up (project blulens-verify, http://127.0.0.1:${HTTP_PORT})"
dc up -d --build --wait --wait-timeout 300

check() { # name, host header, path, expected status
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $2" "http://127.0.0.1:${HTTP_PORT}$3" || true)"
  if [ "$code" = "$4" ]; then echo "    OK   $1 ($3 -> $code)"; else echo "    FAIL $1 ($3 -> $code, want $4)"; FAILED=1; fi
}
FAILED=0
echo "==> checks through Caddy"
check "api health via web rewrite" app.localhost /api/v1/health 200
check "web home page" app.localhost / 200
check "public rubric (migrated + seeded DB)" app.localhost /api/v1/rubric 200
check "minio behind the files domain" files.localhost /minio/health/live 200
echo "==> api log (entrypoint)"
dc logs api 2>&1 | grep -E "\[entrypoint\]|migrations|seed|rubric" | head -20

[ "$FAILED" = "0" ] && echo "==> VERIFY_OK" || { echo "==> VERIFY_FAILED"; exit 1; }
