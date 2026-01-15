#!/usr/bin/env bash
set -euo pipefail

# ======================================================
# ONE COMMAND (safe by default):
#   bash test-local.sh
#
# Behavior:
#   1) DB up
#   2) Backup FULL (schema+data)
#   3) If backup is too small -> ABORT (safety)
#   4) Run migration (non-destructive)
#   5) Optional seed (RUN_SEED=1)
#   6) Verify
#   7) Restart backend
#   8) Health check (auto-detect host port mapping)
#
# Optional:
#   FORCE_RESET=1 bash test-local.sh        # drop schema then restore full backup then migrate
#   FORCE_EMPTY=1 bash test-local.sh        # allow running even if DB is empty/small backup
#   RUN_SEED=1 bash test-local.sh           # run init-db.sql
# ======================================================

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
CONTAINER_PORT="${CONTAINER_PORT:-8080}"     # backend container port in your compose (API_PORT=8080)

BACKUP_DIR="${BACKUP_DIR:-backups/local}"
MIN_BACKUP_BYTES="${MIN_BACKUP_BYTES:-200000}"   # safety threshold
FORCE_EMPTY="${FORCE_EMPTY:-0}"
FORCE_RESET="${FORCE_RESET:-0}"
RUN_SEED="${RUN_SEED:-0}"

TS="$(date +%Y%m%d_%H%M%S)"
BACKUP_FULL="${BACKUP_DIR}/backup_full_${TS}.sql"

mkdir -p "$BACKUP_DIR"

echo "======================================================"
echo "🧪 TEST LOCAL (SAFE ONE COMMAND)"
echo "======================================================"

docker info >/dev/null 2>&1 || { echo "❌ Docker not running. Start Docker Desktop and retry."; exit 1; }

echo "🐳 Starting DB..."
docker compose -f "$COMPOSE_FILE" up -d "$DB_SERVICE"
sleep 2

if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
  echo "❌ DB container not found: $DB_CONTAINER"
  echo "   Run: docker ps"
  exit 1
fi

echo "💾 Backup FULL (schema+data) -> $BACKUP_FULL"
docker exec -e PGPASSWORD="$DB_PASSWORD" "$DB_CONTAINER" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges > "$BACKUP_FULL"

FULL_SIZE="$(wc -c < "$BACKUP_FULL" | tr -d ' ')"
echo "📦 Backup size: FULL=${FULL_SIZE} bytes (threshold=${MIN_BACKUP_BYTES})"

# SAFETY: if backup too small, abort unless FORCE_EMPTY=1
if [ "$FULL_SIZE" -lt "$MIN_BACKUP_BYTES" ] && [ "$FORCE_EMPTY" != "1" ]; then
  echo "❌ Backup is too small. This usually means:"
  echo "   - Your DB is already empty, OR"
  echo "   - You are using a different/clean volume"
  echo ""
  echo "   Aborting to prevent accidental data loss."
  echo "   If you REALLY want to proceed on empty DB:"
  echo "     FORCE_EMPTY=1 bash test-local.sh"
  exit 1
fi

# Optional: force reset schema then restore full backup (useful to clean schema)
if [ "$FORCE_RESET" = "1" ]; then
  echo "♻️ FORCE_RESET=1 -> DROP schema + RESTORE FULL backup"
  docker exec -i -e PGPASSWORD="$DB_PASSWORD" "$DB_CONTAINER" \
    psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO public;
SQL

  echo "📥 Restore FULL backup -> $BACKUP_FULL"
  docker exec -i -e PGPASSWORD="$DB_PASSWORD" "$DB_CONTAINER" \
    psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 < "$BACKUP_FULL"
fi

# Migration (non-destructive)
if [ ! -f "$MIGRATION_FILE" ]; then
  echo "❌ Missing migration file: $MIGRATION_FILE"
  exit 1
fi

echo "🔄 Run migration: $MIGRATION_FILE"
docker exec -i -e PGPASSWORD="$DB_PASSWORD" "$DB_CONTAINER" \
  psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 < "$MIGRATION_FILE"
echo "✅ Migration done"

# Seed only if requested (so it won't override your local data)
if [ "$RUN_SEED" = "1" ] && [ -f "$SEED_FILE" ]; then
  echo "🌱 Seed (RUN_SEED=1): $SEED_FILE"
  docker exec -i -e PGPASSWORD="$DB_PASSWORD" "$DB_CONTAINER" \
    psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 < "$SEED_FILE"
  echo "✅ Seed done"
else
  echo "⏭️ Seed skipped (set RUN_SEED=1 to run it)"
fi

# Verify schema
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

# Auto-detect host port for container port 8080
PORT_LINE="$(docker compose -f "$COMPOSE_FILE" port "$BACKEND_SERVICE" "$CONTAINER_PORT" 2>/dev/null || true)"
if [ -z "$PORT_LINE" ]; then
  echo "❌ No port mapping found for backend:${CONTAINER_PORT}"
  echo "   Check docker-compose.yml backend->ports (should map host:8080)"
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
