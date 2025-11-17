#!/bin/bash
# Script to restore data to SIT database
# Usage: ./restore-data-to-sit.sh [source_env]
#   source_env: development (default), production, or staging

set -e

SOURCE_ENV=${1:-development}
SIT_ENV="staging"

echo "🔄 Restoring data to SIT database..."
echo "📊 Source environment: $SOURCE_ENV"
echo "🎯 Target environment: $SIT_ENV (SIT)"
echo ""

# Database configurations
declare -A SOURCE_CONFIG
declare -A SIT_CONFIG

case $SOURCE_ENV in
  development)
    SOURCE_CONFIG[host]="localhost"
    SOURCE_CONFIG[port]="5437"
    SOURCE_CONFIG[database]="bakong_notification_services_dev"
    SOURCE_CONFIG[user]="bkns_dev"
    SOURCE_CONFIG[password]="dev"
    SOURCE_CONFIG[container]="bakong-notification-services-db-dev"
    ;;
  production)
    SOURCE_CONFIG[host]="localhost"
    SOURCE_CONFIG[port]="5433"
    SOURCE_CONFIG[database]="bakong_notification_services"
    SOURCE_CONFIG[user]="bkns"
    SOURCE_CONFIG[password]="010110bkns"
    SOURCE_CONFIG[container]="bakong-notification-services-db-prod"
    ;;
  staging)
    SOURCE_CONFIG[host]="localhost"
    SOURCE_CONFIG[port]="5434"
    SOURCE_CONFIG[database]="bakong_notification_services_sit"
    SOURCE_CONFIG[user]="bkns_sit"
    SOURCE_CONFIG[password]="0101bkns_sit"
    SOURCE_CONFIG[container]="bakong-notification-services-db-sit"
    ;;
  *)
    echo "❌ Invalid source environment: $SOURCE_ENV"
    echo "   Valid options: development, production, staging"
    exit 1
    ;;
esac

# SIT (staging) configuration
SIT_CONFIG[host]="localhost"
SIT_CONFIG[port]="5434"
SIT_CONFIG[database]="bakong_notification_services_sit"
SIT_CONFIG[user]="bkns_sit"
SIT_CONFIG[password]="0101bkns_sit"
SIT_CONFIG[container]="bakong-notification-services-db-sit"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/apps/backend"
TEMP_BACKUP="$BACKEND_DIR/.temp-backup-${SOURCE_ENV}.sql"

# Check if SIT database container is running
echo "🔍 Checking SIT database container..."
if ! docker ps --format "{{.Names}}" | grep -q "^${SIT_CONFIG[container]}$"; then
    echo "❌ SIT database container '${SIT_CONFIG[container]}' is not running!"
    echo "   Please start it first: docker compose -f docker-compose.sit.yml up -d db"
    exit 1
fi
echo "✅ SIT database container is running"

# Step 1: Backup from source
echo ""
echo "📤 Step 1: Backing up data from $SOURCE_ENV..."
echo "   Database: ${SOURCE_CONFIG[database]}"

# Check if source container is running
if docker ps --format "{{.Names}}" | grep -q "^${SOURCE_CONFIG[container]}$"; then
    echo "   Using Docker container: ${SOURCE_CONFIG[container]}"
    docker exec ${SOURCE_CONFIG[container]} pg_dump \
        -U ${SOURCE_CONFIG[user]} \
        -d ${SOURCE_CONFIG[database]} \
        --data-only \
        --inserts \
        --column-inserts \
        --no-owner \
        --no-privileges \
        --no-tablespaces \
        --disable-triggers > "$TEMP_BACKUP"
elif [ -f "$BACKEND_DIR/init-db-data-${SOURCE_ENV}.sql" ]; then
    echo "   Using existing backup file: init-db-data-${SOURCE_ENV}.sql"
    # Extract data from backup file (skip headers/footers)
    sed -n '/^BEGIN;/,/^COMMIT;/p' "$BACKEND_DIR/init-db-data-${SOURCE_ENV}.sql" > "$TEMP_BACKUP" || \
    grep -E "^(INSERT|COPY)" "$BACKEND_DIR/init-db-data-${SOURCE_ENV}.sql" > "$TEMP_BACKUP" || \
    cp "$BACKEND_DIR/init-db-data-${SOURCE_ENV}.sql" "$TEMP_BACKUP"
else
    echo "⚠️  No source data found. Creating empty backup..."
    echo "-- No data to restore" > "$TEMP_BACKUP"
fi

if [ ! -s "$TEMP_BACKUP" ] || grep -q "No data to restore" "$TEMP_BACKUP"; then
    echo "⚠️  Warning: Source database appears to be empty or backup failed"
    echo "   Continuing with restore anyway..."
fi

# Step 2: Clear existing SIT data (optional - ask user)
echo ""
read -p "🗑️  Clear existing data in SIT database? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "   Clearing existing data..."
    docker exec ${SIT_CONFIG[container]} psql -U ${SIT_CONFIG[user]} -d ${SIT_CONFIG[database]} <<EOF
SET session_replication_role = 'replica';
TRUNCATE TABLE notification CASCADE;
TRUNCATE TABLE template_translation CASCADE;
TRUNCATE TABLE template CASCADE;
TRUNCATE TABLE image CASCADE;
TRUNCATE TABLE bakong_user CASCADE;
-- Keep admin user, only clear if needed
-- TRUNCATE TABLE "user" CASCADE;
SET session_replication_role = 'origin';
EOF
    echo "✅ Existing data cleared"
else
    echo "   Keeping existing data (may cause conflicts)"
fi

# Step 3: Restore to SIT
echo ""
echo "📥 Step 2: Restoring data to SIT..."
echo "   Database: ${SIT_CONFIG[database]}"

# Prepare restore SQL with proper transaction handling
RESTORE_SQL="$BACKEND_DIR/.temp-restore.sql"
cat > "$RESTORE_SQL" <<EOF
-- Restore data to SIT
SET session_replication_role = 'replica';
BEGIN;

EOF

# Add the backup data
cat "$TEMP_BACKUP" >> "$RESTORE_SQL"

# Add footer
cat >> "$RESTORE_SQL" <<EOF

SET session_replication_role = 'origin';
COMMIT;
EOF

# Restore to SIT database
docker exec -i ${SIT_CONFIG[container]} psql -U ${SIT_CONFIG[user]} -d ${SIT_CONFIG[database]} < "$RESTORE_SQL"

# Cleanup
rm -f "$TEMP_BACKUP" "$RESTORE_SQL"

echo ""
echo "✅ Data restore completed successfully!"
echo ""
echo "🌐 Access your SIT environment:"
echo "   Frontend: http://10.20.6.57:8090"
echo "   Backend:  http://10.20.6.57:4002"
echo ""
echo "💡 To verify data:"
echo "   docker exec -it ${SIT_CONFIG[container]} psql -U ${SIT_CONFIG[user]} -d ${SIT_CONFIG[database]} -c \"SELECT COUNT(*) FROM template;\""

