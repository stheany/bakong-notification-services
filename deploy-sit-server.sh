#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.sit.yml}"

DB_CONTAINER="${DB_CONTAINER:-bakong-notification-services-db-sit}"
DB_NAME="${DB_NAME:-bakong_notification_services_sit}"
DB_USER="${DB_USER:-bkns_sit}"
DB_PASSWORD="${DB_PASSWORD:-CHANGE_ME}"

BACKEND_SERVICE="${BACKEND_SERVICE:-backend}"
BACKEND_PORT="${BACKEND_PORT:-4004}"   # host port mapping, adjust if SIT uses different
HEALTH_URL="${HEALTH_URL:-http://localhost:${BACKEND_PORT}/api/v1/health}"

MIGRATION_FILE="${MIGRATION_FILE:-apps/backend/scripts/unified-migration.sql}"
VERIFY_FILE="${VERIFY_FILE:-apps/backend/verify-all.sql}"
SEED_FILE="${SEED_FILE:-apps/backend/scripts/init-db.sql}"

BACKUP_DIR="${BACKUP_DIR:-backups/sit}"
TS="$(date +%Y%m%d_%H%M%S)"
BACKUP_FULL="${BACKUP_DIR}/sit_full_${TS}.sql"

mkdir -p "$BACKUP_DIR"

echo "======================================================"
echo "🚀 DEPLOY SIT (SAFE: backup + migrate + restart)"
echo "======================================================"

docker info >/dev/null 2>&1 || { echo "❌ Docker not running."; exit 1; }

echo "🐳 Pull / build images (if needed)..."
docker compose -f "$COMPOSE_FILE" pull || true

echo "🐳 Start db + backend..."
docker compose -f "$COMPOSE_FILE" up -d

echo "💾 Backup FULL DB -> $BACKUP_FULL"
docker exec -e PGPASSWORD="$DB_PASSWORD" "$DB_CONTAINER" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges > "$BACKUP_FULL"

FULL_SIZE="$(wc -c < "$BACKUP_FULL" | tr -d ' ')"
echo "📦 Backup size: ${FULL_SIZE} bytes"
if [ "$FULL_SIZE" -lt 50000 ]; then
  echo "❌ Backup looks too small. Aborting (safety)."
  exit 1
fi

if [ ! -f "$MIGRATION_FILE" ]; then
  echo "❌ Missing migration file: $MIGRATION_FILE"
  exit 1
fi

echo "🔄 Run migration (NON-DESTRUCTIVE): $MIGRATION_FILE"
docker exec -i -e PGPASSWORD="$DB_PASSWORD" "$DB_CONTAINER" \
  psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 < "$MIGRATION_FILE"
echo "✅ Migration done"

# ⚠️ Seed on SIT only if it is idempotent (DO blocks / ON CONFLICT)
if [ "${RUN_SEED:-0}" = "1" ] && [ -f "$SEED_FILE" ]; then
  echo "🌱 Seed (RUN_SEED=1): $SEED_FILE"
  docker exec -i -e PGPASSWORD="$DB_PASSWORD" "$DB_CONTAINER" \
    psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 < "$SEED_FILE"
  echo "✅ Seed done"
fi

if [ -f "$VERIFY_FILE" ]; then
  echo "🔍 Verify: $VERIFY_FILE"
  docker exec -i -e PGPASSWORD="$DB_PASSWORD" "$DB_CONTAINER" \
    psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -P pager=off < "$VERIFY_FILE"
  echo "✅ Verify done"
fi

echo "🔁 Restart backend..."
docker compose -f "$COMPOSE_FILE" up -d --force-recreate "$BACKEND_SERVICE"

echo "🩺 Health check: $HEALTH_URL"
for i in {1..60}; do
  if curl -fsS "$HEALTH_URL" >/dev/null; then
    echo "✅ SIT backend healthy"
    echo "✅ DEPLOY DONE"
    echo "Backup: $BACKUP_FULL"
    exit 0
  fi
  sleep 1
done

echo "❌ Health check failed. Logs:"
docker compose -f "$COMPOSE_FILE" logs --tail=200 "$BACKEND_SERVICE"
echo "Rollback option: restore $BACKUP_FULL"
exit 1
