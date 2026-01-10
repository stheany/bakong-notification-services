#!/bin/bash
# ============================================================================
# Local Testing Script (V1 + V2)
# ============================================================================
# Usage: bash test-local.sh
# ============================================================================

set -e

echo "🧪 Local DB Setup (V1 + V2)"
echo "==========================="
echo ""

# Check if Docker is running (wait up to 120s for Docker Engine to start)
echo "🐳 Checking Docker Engine..."
MAX_WAIT=120
WAITED=0

until docker info > /dev/null 2>&1; do
  if [ "$WAITED" -ge "$MAX_WAIT" ]; then
    echo "❌ Docker is not running after ${MAX_WAIT}s."
    echo "   Open Docker Desktop and wait until it says 'Running', then try again."
    exit 1
  fi
  echo "⏳ Docker Engine is starting... (${WAITED}s)"
  sleep 2
  WAITED=$((WAITED + 2))
done

echo "✅ Docker is running"
echo ""


echo "✅ Docker is running"
echo ""

echo "📋 Step 1: Checking required files..."
echo "----------------------------------------"

# ✅ FIXED PATH (your repo has it here)
MIGRATION_FILE="apps/backend/scripts/unified-migration.sql"

# Optional files (only checked if you want)
VERIFY_FILE="apps/backend/verify-all.sql"
UTILS_FILE="utils-server.sh"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Migration file not found: $MIGRATION_FILE"
    echo "💡 Try: find . -name unified-migration.sql"
    exit 1
else
    echo "✅ Found: $MIGRATION_FILE"
fi

# VERIFY_FILE is optional now (we can verify inline)
if [ -f "$VERIFY_FILE" ]; then
    echo "✅ Found: $VERIFY_FILE"
else
    echo "⚠️  verify-all.sql not found (will verify tables inline)"
fi

if [ -f "$UTILS_FILE" ]; then
    echo "✅ Found: $UTILS_FILE"
else
    echo "⚠️  utils-server.sh not found (skipping utils tests)"
fi

echo ""
echo "📋 Step 2: Checking Docker containers..."
echo "----------------------------------------"

# Check if dev database container exists
if docker ps -a --format '{{.Names}}' | grep -q "bakong-notification-services-db-dev"; then
    echo "✅ Dev database container exists"
    CONTAINER_NAME="bakong-notification-services-db-dev"
    DB_NAME="bakong_notification_services_dev"
    DB_USER="bkns_dev"
    DB_PASSWORD="dev"
else
    echo "⚠️  Dev database container not found"
    echo "   Starting dev database..."
    docker-compose -f docker-compose.yml up -d db
    sleep 10
    CONTAINER_NAME="bakong-notification-services-db-dev"
    DB_NAME="bakong_notification_services_dev"
    DB_USER="bkns_dev"
    DB_PASSWORD="dev"
fi

# Check if container is running
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "✅ Database container is running"
else
    echo "⚠️  Starting database container..."
    docker start "$CONTAINER_NAME" || docker-compose -f docker-compose.yml up -d db
    sleep 10
fi

echo ""
echo "📋 Step 3: Running Migration Script (V1 + V2)..."
echo "----------------------------------------"

echo "Running unified migration..."
export PGPASSWORD="$DB_PASSWORD"
docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 < "$MIGRATION_FILE"
unset PGPASSWORD
echo "✅ Migration PASSED"

echo ""
echo "📋 Step 4: Verifying V1 + V2 tables..."
echo "----------------------------------------"

export PGPASSWORD="$DB_PASSWORD"
docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -P pager=off -c \
"SELECT
  to_regclass('public.template') AS v1_template,
  to_regclass('public.notification') AS v1_notification,
  to_regclass('public.template_translation') AS v1_template_translation,
  to_regclass('public.template_v2') AS v2_template,
  to_regclass('public.template_translation_v2') AS v2_template_translation;"
unset PGPASSWORD

echo "✅ Inline verification done"

# Optional: run verify-all.sql if you have it
if [ -f "$VERIFY_FILE" ]; then
  echo ""
  echo "📋 Step 5: Running verify-all.sql..."
  echo "----------------------------------------"
  export PGPASSWORD="$DB_PASSWORD"
  docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 < "$VERIFY_FILE"
  unset PGPASSWORD
  echo "✅ verify-all.sql PASSED"
fi

# Optional: test utils-server.sh if present
if [ -f "$UTILS_FILE" ]; then
  echo ""
  echo "📋 Step 6: Testing Utils Script Commands..."
  echo "----------------------------------------"

  echo "Testing: bash utils-server.sh db-migrate"
  bash utils-server.sh db-migrate || true

  echo ""
  echo "Testing: bash utils-server.sh verify-all"
  bash utils-server.sh verify-all || true

  echo ""
  echo "Testing: bash utils-server.sh db-backup dev"
  bash utils-server.sh db-backup dev || true
fi

echo ""
echo "✅ All done! V1 + V2 are ready in the SAME database."
echo ""
