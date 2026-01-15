#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

DB_SERVICE="${DB_SERVICE:-db}"
DB_CONTAINER="${DB_CONTAINER:-bakong-notification-services-db-dev}"

DB_NAME="${DB_NAME:-bakong_notification_services_dev}"
DB_USER="${DB_USER:-bkns_dev}"
DB_PASSWORD="${DB_PASSWORD:-dev}"

MIGRATION_FILE="${MIGRATION_FILE:-apps/backend/scripts/unified-migration.sql}"
SEED_FILE="${SEED_FILE:-apps/backend/scripts/init-db.sql}"
VERIFY_FILE="${VERIFY_FILE:-apps/backend/verify-all.sql}"

BACKEND_SERVICE="${BACKEND_SERVICE:-backend}"

BACKUP_DIR="${BACKUP_DIR:-backups/local}"
MIN_BACKUP_BYTES="${MIN_BACKUP_BYTES:-200000}" # safety threshold
TS="$(date +%Y%m%d_%H%M%S)"
BACKUP_FULL="${BACKUP_DIR}/backup_full_${TS}.sql"

mkdir -p "$BACKUP_DIR"

echo "======================================================"
echo "🧪 TEST LOCAL (ONE COMMAND)"
echo "======================================================"

docker info >/dev/null 2>&1 || { echo "❌ Docker not running. Start Docker Desktop and retry."; exit 1; }

echo "🐳 Starting DB..."
docker compose -f "$COMPOSE_FILE" up -d "$DB_SERVICE"
sleep 3

if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
  echo "❌ DB container not found: $DB_CONTAINER"
  exit 1
fi

echo "💾 Backup FULL (schema+data) -> $BACKUP_FULL"
docker exec -e PGPASSWORD="$DB_PASSWORD" "$DB_CONTAINER" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges > "$BACKUP_FULL"

FULL_SIZE="$(wc -c < "$BACKUP_FULL" | tr -d ' ')"
echo "📦 Backup size: FULL=${FULL_SIZE} bytes (threshold=${MIN_BACKUP_BYTES})"

DO_RESET=1
if [ "$MIN_BACKUP_BYTES" != "0" ] && [ "$FULL_SIZE" -lt "$MIN_BACKUP_BYTES" ]; then
  DO_RESET=0
fi

if [ "$DO_RESET" -eq 1 ]; then
  echo "♻️ Reset schema public..."
  docker exec -i -e PGPASSWORD="$DB_PASSWORD" "$DB_CONTAINER" \
    psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO public;
SQL

  echo "📥 Restore FULL backup: $BACKUP_FULL"
  docker exec -i -e PGPASSWORD="$DB_PASSWORD" "$DB_CONTAINER" \
    psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 < "$BACKUP_FULL"
else
  echo "⏭️ Backup too small, skip reset/restore (migrate only)"
  echo "   To force reset anyway: MIN_BACKUP_BYTES=0 bash test-local.sh"
fi

if [ ! -f "$MIGRATION_FILE" ]; then
  echo "❌ Missing migration file: $MIGRATION_FILE"
  exit 1
fi

echo "🔄 Run migration: $MIGRATION_FILE"
docker exec -i -e PGPASSWORD="$DB_PASSWORD" "$DB_CONTAINER" \
  psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 < "$MIGRATION_FILE"
echo "✅ Migration done"

if [ -f "$SEED_FILE" ]; then
  echo "🌱 Seed: $SEED_FILE"
  docker exec -i -e PGPASSWORD="$DB_PASSWORD" "$DB_CONTAINER" \
    psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 < "$SEED_FILE"
  echo "✅ Seed done"
else
  echo "⚠️ Seed file not found: $SEED_FILE (skip)"
fi

if [ -f "$VERIFY_FILE" ]; then
  echo "🔍 Verify: $VERIFY_FILE"
  docker exec -i -e PGPASSWORD="$DB_PASSWORD" "$DB_CONTAINER" \
    psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -P pager=off < "$VERIFY_FILE"
  echo "✅ Verify done"
else
  echo "⚠️ Verify file not found: $VERIFY_FILE (skip)"
fi

echo "🔁 Restart backend..."
docker compose -f "$COMPOSE_FILE" up -d --build "$BACKEND_SERVICE"

# ✅ Auto-detect which host port backend exposes for container port 8080
PORT_LINE="$(docker compose -f "$COMPOSE_FILE" port "$BACKEND_SERVICE" 8080 2>/dev/null || true)"
if [ -z "$PORT_LINE" ]; then
  echo "❌ No port mapping found for backend:8080"
  echo "   Check docker-compose.yml -> backend -> ports (should be 4004:8080)"
  docker compose -f "$COMPOSE_FILE" ps
  exit 1
fi

HOST_PORT="$(echo "$PORT_LINE" | awk -F: '{print $NF}' | tr -d '\r\n')"
HEALTH_URL="http://localhost:${HOST_PORT}/api/v1/health"

echo "🩺 Health check: $HEALTH_URL"
for i in {1..60}; do
  if curl -fsS "$HEALTH_URL" >/dev/null; then
    echo "✅ Backend healthy"
    echo ""
    echo "✅ DONE"
    echo "FULL backup: $BACKUP_FULL"
    exit 0
  fi
  sleep 1
done

echo "❌ Backend health failed. Logs:"
docker compose -f "$COMPOSE_FILE" logs --tail=200 "$BACKEND_SERVICE"
exit 1
