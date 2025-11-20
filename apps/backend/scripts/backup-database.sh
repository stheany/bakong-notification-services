#!/bin/bash
# Database Backup Script
# Backs up all data including images (stored as BYTEA in database)
# Usage: bash scripts/backup-database.sh [environment]

set -e

ENV=${1:-staging}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo "💾 Starting database backup..."
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
    echo "   Valid options: development, staging, production"
    exit 1
    ;;
esac

# Create backup directory
mkdir -p "$BACKUP_DIR"

BACKUP_FILE="$BACKUP_DIR/backup_${ENV}_${TIMESTAMP}.sql"
BACKUP_FILE_LATEST="$BACKUP_DIR/backup_${ENV}_latest.sql"

echo "🗄️  Database: $DB_NAME"
echo "📁 Backup file: $BACKUP_FILE"
echo ""

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
echo "📤 Creating backup (this may take a while for large databases)..."
echo ""

if [ "$USE_DOCKER" = true ]; then
  # Backup via Docker (includes all data including images)
  export PGPASSWORD="$DB_PASS"
  docker exec "$CONTAINER_NAME" pg_dump \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --clean \
    --if-exists \
    --create \
    --format=plain \
    --no-owner \
    --no-privileges \
    > "$BACKUP_FILE"
  unset PGPASSWORD
  
  # Also create a latest symlink/copy
  cp "$BACKUP_FILE" "$BACKUP_FILE_LATEST"
fi

# Get file size
FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

echo ""
echo "✅ Backup completed successfully!"
echo "📄 Backup file: $BACKUP_FILE"
echo "📊 File size: $FILE_SIZE"
echo ""
echo "💡 This backup includes:"
echo "   ✅ All tables (user, template, notification, etc.)"
echo "   ✅ All images (stored as BYTEA in image table)"
echo "   ✅ All imageId references in template_translation"
echo "   ✅ All data relationships"
echo ""
echo "📋 To restore this backup:"
echo "   bash scripts/restore-database.sh $ENV $BACKUP_FILE"
echo ""

