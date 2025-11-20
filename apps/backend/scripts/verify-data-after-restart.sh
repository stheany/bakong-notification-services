#!/bin/bash
# Verify Data After Restart Script
# Checks that all data (including images) is present after service restart
# Usage: bash scripts/verify-data-after-restart.sh [environment]

set -e

ENV=${1:-staging}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🔍 Verifying data after restart..."
echo "📊 Environment: $ENV"
echo ""

# Determine database connection details based on environment
case $ENV in
  development|dev)
    DB_NAME=${POSTGRES_DB:-bakong_notification_services_dev}
    DB_USER=${POSTGRES_USER:-bkns_dev}
    DB_PASS=${POSTGRES_PASSWORD:-dev}
    CONTAINER_NAME="bakong-notification-services-db-dev"
    ;;
  staging|sit)
    DB_NAME=${POSTGRES_DB:-bakong_notification_services_sit}
    DB_USER=${POSTGRES_USER:-bkns_sit}
    DB_PASS=${POSTGRES_PASSWORD:-0101bkns_sit}
    CONTAINER_NAME="bakong-notification-services-db-sit"
    ;;
  production|prod)
    DB_NAME=${POSTGRES_DB:-bakong_notification_services}
    DB_USER=${POSTGRES_USER:-bkns}
    DB_PASS=${POSTGRES_PASSWORD:-010110bkns}
    CONTAINER_NAME="bakong-notification-services-db-prod"
    ;;
  *)
    echo "❌ Unknown environment: $ENV"
    exit 1
    ;;
esac

# Check if Docker container exists
USE_DOCKER=false
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  USE_DOCKER=true
else
  echo "❌ Docker container not found: $CONTAINER_NAME"
  exit 1
fi

echo "🗄️  Database: $DB_NAME"
echo ""

# Create verification SQL
VERIFY_SQL=$(cat <<'EOF'
-- Verify all critical data exists
SELECT 
    'Users' as table_name,
    COUNT(*) as record_count
FROM "user"
WHERE "deletedAt" IS NULL

UNION ALL

SELECT 
    'Templates' as table_name,
    COUNT(*) as record_count
FROM template
WHERE "deletedAt" IS NULL

UNION ALL

SELECT 
    'Template Translations' as table_name,
    COUNT(*) as record_count
FROM template_translation

UNION ALL

SELECT 
    'Images' as table_name,
    COUNT(*) as record_count
FROM image

UNION ALL

SELECT 
    'Images with Data' as table_name,
    COUNT(*) as record_count
FROM image
WHERE file IS NOT NULL AND LENGTH(file) > 0

UNION ALL

SELECT 
    'Template Translations with Images' as table_name,
    COUNT(*) as record_count
FROM template_translation
WHERE "imageId" IS NOT NULL AND "imageId" != ''

UNION ALL

SELECT 
    'Notifications' as table_name,
    COUNT(*) as record_count
FROM notification

UNION ALL

SELECT 
    'Bakong Users' as table_name,
    COUNT(*) as record_count
FROM bakong_user;

-- Check for orphaned image references
SELECT 
    'Orphaned Image References' as check_type,
    COUNT(*) as count
FROM template_translation tt
WHERE tt."imageId" IS NOT NULL 
  AND tt."imageId" != ''
  AND NOT EXISTS (
    SELECT 1 FROM image i WHERE i."fileId" = tt."imageId"
  );
EOF
)

if [ "$USE_DOCKER" = true ]; then
  export PGPASSWORD="$DB_PASS"
  echo "$VERIFY_SQL" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME"
  unset PGPASSWORD
fi

echo ""
echo "✅ Data verification completed!"
echo ""
echo "💡 If all counts look correct, your data is safe!"
echo "   Images are stored in the database, so they persist with the database volume."
echo ""

