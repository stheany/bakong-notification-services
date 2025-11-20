#!/bin/bash
# Database Restore Script
# Restores all data including images from a backup file
# Usage: bash scripts/restore-database.sh [environment] [backup-file]

set -e

ENV=${1:-staging}
BACKUP_FILE=${2:-""}

if [ -z "$BACKUP_FILE" ]; then
  echo "❌ Error: Backup file not specified"
  echo ""
  echo "Usage: bash scripts/restore-database.sh [environment] [backup-file]"
  echo ""
  echo "Examples:"
  echo "  bash scripts/restore-database.sh staging backups/backup_staging_20250101_120000.sql"
  echo "  bash scripts/restore-database.sh staging backups/backup_staging_latest.sql"
  echo ""
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🔄 Starting database restore..."
echo "📊 Environment: $ENV"
echo "📄 Backup file: $BACKUP_FILE"
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
    echo "   Valid options: development, staging, production"
    exit 1
    ;;
esac

echo "🗄️  Database: $DB_NAME"
echo "⚠️  WARNING: This will replace all existing data!"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "❌ Restore cancelled by user"
  exit 1
fi

# Check if Docker container exists
USE_DOCKER=false
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  USE_DOCKER=true
  echo "🐳 Using Docker container: $CONTAINER_NAME"
else
  echo "❌ Docker container not found: $CONTAINER_NAME"
  echo "   Please start the database container first"
  exit 1
fi

echo ""
echo "🔄 Restoring database (this may take a while)..."
echo ""

if [ "$USE_DOCKER" = true ]; then
  # Restore via Docker
  export PGPASSWORD="$DB_PASS"
  docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres < "$BACKUP_FILE"
  unset PGPASSWORD
fi

echo ""
echo "✅ Database restore completed!"
echo ""
echo "💡 Restored data includes:"
echo "   ✅ All tables (user, template, notification, etc.)"
echo "   ✅ All images (stored as BYTEA in image table)"
echo "   ✅ All imageId references in template_translation"
echo "   ✅ All data relationships"
echo ""
echo "🔄 You may need to restart your application containers:"
echo "   docker compose -f docker-compose.sit.yml restart backend"
echo ""

