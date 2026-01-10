#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Run All (DB + migrate + verify + start)"
echo "========================================="

# 1) Check docker
echo "🐳 Checking Docker..."
if ! docker ps >/dev/null 2>&1; then
  echo "❌ Docker is not running. Start Docker Desktop first."
  exit 1
fi
echo "✅ Docker OK"

# 2) Start DB container (dev)
CONTAINER="bakong-notification-services-db-dev"
DB="bakong_notification_services_dev"
USER="bkns_dev"
PASS="dev"

echo "🗄️  Ensuring DB container is running..."
if ! docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "⚠️  Container not found, starting via docker compose..."
  docker compose up -d db || docker-compose up -d db
else
  if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    docker start "${CONTAINER}" >/dev/null
  fi
fi

# Wait for postgres ready
echo "⏳ Waiting for Postgres to be ready..."
until docker exec "${CONTAINER}" pg_isready -U "${USER}" -d "${DB}" >/dev/null 2>&1; do
  sleep 1
done
echo "✅ Postgres ready"

# 3) Find migration + verify files (support both paths)
MIG="apps/backend/scripts/unified-migration.sql"
if [ ! -f "$MIG" ]; then MIG="apps/backend/unified-migration.sql"; fi

VER="apps/backend/scripts/verify-all.sql"
if [ ! -f "$VER" ]; then VER="apps/backend/verify-all.sql"; fi

if [ ! -f "$MIG" ]; then
  echo "❌ unified-migration.sql not found (checked scripts/ and root)."
  exit 1
fi

echo "✅ Using migration: $MIG"

# 4) Run migration
echo "📦 Running migration (V1 + V2)..."
export PGPASSWORD="$PASS"
docker exec -i "${CONTAINER}" psql -U "${USER}" -d "${DB}" < "$MIG"
unset PGPASSWORD
echo "✅ Migration done"

# 5) Run verify (optional)
if [ -f "$VER" ]; then
  echo "🔍 Running verify-all..."
  export PGPASSWORD="$PASS"
  docker exec -i "${CONTAINER}" psql -U "${USER}" -d "${DB}" < "$VER" || true
  unset PGPASSWORD
  echo "✅ Verify finished"
else
  echo "⚠️  verify-all.sql not found, skipping verify step"
fi

# 6) Start backend (optional)
echo "🧹 Cleaning build cache..."
rm -rf apps/backend/dist dist || true

echo "▶️ Starting backend..."
# adjust this to your actual start command:
cd apps/backend
npm run start:dev
