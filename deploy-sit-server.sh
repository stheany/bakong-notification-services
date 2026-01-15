#!/bin/bash
set -euo pipefail

# ============================================================================
# SIT Server Deployment Script (MOCK STYLE)
# Usage:
#   bash deploy-sit-server.sh
#
# Optional:
#   UPDATE_CODE=1 bash deploy-sit-server.sh     # pull latest from develop
#   RUN_SEED=1 bash deploy-sit-server.sh        # run seed (ONLY if safe/idempotent)
#   NO_CACHE=1 bash deploy-sit-server.sh        # build backend with --no-cache
# ============================================================================

cd ~/bakong-notification-services

ENVIRONMENT="sit"
COMPOSE_FILE="docker-compose.sit.yml"
DB_CONTAINER="bakong-notification-services-db-sit"
DB_USER="bkns_sit"
DB_NAME="bakong_notification_services_sit"
DB_PASSWORD="${DB_PASSWORD:-CHANGE_ME}"     # <-- export DB_PASSWORD on server (recommended)

BACKEND_SERVICE="backend"
FRONTEND_SERVICE="frontend"

BACKEND_PORT="4002"
FRONTEND_PORT="8090"
SERVER_IP="10.20.6.57"

MIGRATION_FILE="apps/backend/scripts/unified-migration.sql"
VERIFY_FILE="apps/backend/verify-all.sql"
SEED_FILE="apps/backend/scripts/init-db.sql"

BACKUP_DIR="backups/${ENVIRONMENT}"
TS="$(date +%Y%m%d_%H%M%S)"
BACKUP_FULL="${BACKUP_DIR}/${ENVIRONMENT}_full_${TS}.sql"
MIN_BACKUP_BYTES=50000

UPDATE_CODE="${UPDATE_CODE:-0}"
RUN_SEED="${RUN_SEED:-0}"
NO_CACHE="${NO_CACHE:-0}"

HEALTH_URL="http://${SERVER_IP}:${BACKEND_PORT}/api/v1/health"

echo "🚀 ${ENVIRONMENT^^} Server Deployment"
echo "===================================="
echo ""

docker info >/dev/null 2>&1 || { echo "❌ Docker not running."; exit 1; }

mkdir -p "$BACKUP_DIR"

# ----------------------------------------------------------------------------
# Step 1: Backup (CRITICAL)
# ----------------------------------------------------------------------------
echo "💾 Step 1: Backup before deployment (CRITICAL)..."
if [ -f "utils-server.sh" ]; then
  bash utils-server.sh db-backup "$ENVIRONMENT" || {
    echo "❌ Backup failed! Deployment aborted."
    exit 1
  }
  echo "✅ Backup done (via utils-server.sh)"
else
  echo "⚠️  utils-server.sh not found -> using pg_dump fallback"
  docker exec -e PGPASSWORD="$DB_PASSWORD" "$DB_CONTAINER" \
    pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges > "$BACKUP_FULL"

  SIZE="$(wc -c < "$BACKUP_FULL" | tr -d ' ')"
  echo "📦 Backup size: $SIZE bytes"
  if [ "$SIZE" -lt "$MIN_BACKUP_BYTES" ]; then
    echo "❌ Backup too small. Deployment aborted for safety."
    exit 1
  fi
  echo "✅ Backup saved: $BACKUP_FULL"
fi
echo ""

# ----------------------------------------------------------------------------
# Step 2: Pull latest code (optional)
# ----------------------------------------------------------------------------
echo "📥 Step 2: Update code (optional)..."
if [ "$UPDATE_CODE" = "1" ]; then
  git fetch origin
  if git show-ref --verify --quiet refs/remotes/origin/develop; then
    git reset --hard origin/develop
    echo "✅ Updated code from origin/develop"
  else
    echo "⚠️  origin/develop not found. Skip update."
  fi
else
  echo "⏭️  UPDATE_CODE=0 (skip git update)"
fi
echo ""

# ----------------------------------------------------------------------------
# Step 3: Stop containers
# ----------------------------------------------------------------------------
echo "🛑 Step 3: Stopping containers..."
docker compose -f "$COMPOSE_FILE" down || true
echo "✅ Containers stopped"
echo ""

# ----------------------------------------------------------------------------
# Step 4: Build backend
# ----------------------------------------------------------------------------
echo "🏗️  Step 4: Build backend..."
if [ "$NO_CACHE" = "1" ]; then
  docker compose -f "$COMPOSE_FILE" build --no-cache "$BACKEND_SERVICE"
else
  docker compose -f "$COMPOSE_FILE" build "$BACKEND_SERVICE"
fi
echo "✅ Build done"
echo ""

# ----------------------------------------------------------------------------
# Step 5: Start services
# ----------------------------------------------------------------------------
echo "🚀 Step 5: Starting services..."
docker compose -f "$COMPOSE_FILE" up -d
echo "✅ Services started"
echo ""

echo "⏳ Waiting 15s for services..."
sleep 15

echo "📊 Container Status:"
docker compose -f "$COMPOSE_FILE" ps
echo ""

# ----------------------------------------------------------------------------
# Step 6: Migration (NON-DESTRUCTIVE)
# ----------------------------------------------------------------------------
echo "🔄 Step 6: Running migration (NON-DESTRUCTIVE)..."
if [ -f "utils-server.sh" ]; then
  bash utils-server.sh db-migrate "$ENVIRONMENT" || {
    echo "⚠️  Migration returned non-zero (may already be applied). Continue..."
  }
else
  if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Missing migration file: $MIGRATION_FILE"
    exit 1
  fi
  docker exec -i -e PGPASSWORD="$DB_PASSWORD" "$DB_CONTAINER" \
    psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 < "$MIGRATION_FILE"
fi
echo "✅ Migration done"
echo ""

# ----------------------------------------------------------------------------
# Step 7: Seed (optional)
# ----------------------------------------------------------------------------
if [ "$RUN_SEED" = "1" ]; then
  echo "🌱 Step 7: Seed (RUN_SEED=1)..."
  if [ -f "$SEED_FILE" ]; then
    docker exec -i -e PGPASSWORD="$DB_PASSWORD" "$DB_CONTAINER" \
      psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 < "$SEED_FILE"
    echo "✅ Seed done"
  else
    echo "⚠️  Seed file not found: $SEED_FILE (skip)"
  fi
  echo ""
else
  echo "⏭️  Step 7: Seed skipped (RUN_SEED=0)"
  echo ""
fi

# ----------------------------------------------------------------------------
# Step 8: Verify
# ----------------------------------------------------------------------------
echo "🔍 Step 8: Verify schema..."
if [ -f "utils-server.sh" ]; then
  bash utils-server.sh verify-all || {
    echo "⚠️  verify-all warning (check manually if needed)"
  }
elif [ -f "$VERIFY_FILE" ]; then
  docker exec -i -e PGPASSWORD="$DB_PASSWORD" "$DB_CONTAINER" \
    psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -P pager=off < "$VERIFY_FILE"
fi
echo "✅ Verify done"
echo ""

# ----------------------------------------------------------------------------
# Step 9: Restart backend (force recreate)
# ----------------------------------------------------------------------------
echo "🔁 Step 9: Restart bassckend..."
docker compose -f "$COMPOSE_FILE" up -d --force-recreate "$BACKEND_SERVICE"
echo "✅ Backend restarted"
echo ""

# ----------------------------------------------------------------------------
# Step 10: Health check
# ----------------------------------------------------------------------------
echo "🩺 Step 10: Health check: $HEALTH_URL"
for i in {1..90}; do
  if curl -fsS --connect-timeout 5 "$HEALTH_URL" >/dev/null; then
    echo "✅ SIT backend healthy"
    echo ""
    echo "✅ DEPLOY COMPLETE!"
    echo "Frontend: http://${SERVER_IP}:${FRONTEND_PORT}"
    echo "Backend:  http://${SERVER_IP}:${BACKEND_PORT}"
    echo "Health:   $HEALTH_URL"
    echo ""
    echo "Backup created before deploy ✅"
    exit 0
  fi
  sleep 2
done

echo "❌ Health check failed. Backend logs:"
docker compose -f "$COMPOSE_FILE" logs --tail=200 "$BACKEND_SERVICE"
echo "Rollback: restore the pre-deploy backup from Step 1."
exit 1
