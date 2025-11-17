#!/bin/bash
# Safe script to restore data to SIT database
# This clears existing data first to avoid conflicts

set -e

echo "🔄 Restoring data to SIT database (safe mode)..."
echo ""

CONTAINER="bakong-notification-services-db-sit"
DB_USER="bkns_sit"
DB_NAME="bakong_notification_services_sit"
DATA_FILE="apps/backend/init-db-data-development.sql"

# Check if container is running
if ! docker ps --format "{{.Names}}" | grep -q "^${CONTAINER}$"; then
    echo "❌ Database container '${CONTAINER}' is not running!"
    echo "   Please start it first: docker compose -f docker-compose.sit.yml up -d db"
    exit 1
fi

echo "✅ Database container is running"
echo ""

# Step 1: Clear existing data (except schema)
echo "🗑️  Step 1: Clearing existing data..."
docker exec ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} <<EOF
-- Disable triggers temporarily
SET session_replication_role = 'replica';

-- Clear data in correct order (respecting foreign keys)
TRUNCATE TABLE notification CASCADE;
TRUNCATE TABLE template_translation CASCADE;
TRUNCATE TABLE template CASCADE;
TRUNCATE TABLE image CASCADE;
TRUNCATE TABLE bakong_user CASCADE;
TRUNCATE TABLE "user" CASCADE;

-- Re-enable triggers
SET session_replication_role = 'origin';
EOF

echo "✅ Existing data cleared"
echo ""

# Step 2: Restore data
echo "📥 Step 2: Restoring data from ${DATA_FILE}..."

# Extract only INSERT statements from the file and restore
if [ -f "$DATA_FILE" ]; then
    # Create a clean restore file with proper transaction handling
    TEMP_RESTORE="/tmp/restore-sit-$$.sql"
    
    cat > "$TEMP_RESTORE" <<'RESTORE_HEADER'
-- Restore data to SIT
SET session_replication_role = 'replica';
BEGIN;

RESTORE_HEADER

    # Extract INSERT statements (skip headers, comments, and transaction commands)
    grep -E "^(INSERT|COPY)" "$DATA_FILE" | sed 's/^INSERT/INSERT/' >> "$TEMP_RESTORE" || \
    sed -n '/^INSERT/,/^;/p' "$DATA_FILE" >> "$TEMP_RESTORE" || \
    sed -n '/BEGIN;/,/COMMIT;/p' "$DATA_FILE" | grep -v "^--" | grep -v "^BEGIN" | grep -v "^COMMIT" >> "$TEMP_RESTORE"
    
    cat >> "$TEMP_RESTORE" <<'RESTORE_FOOTER'

SET session_replication_role = 'origin';
COMMIT;
RESTORE_FOOTER

    # Restore to database
    docker exec -i ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} < "$TEMP_RESTORE"
    
    # Cleanup
    rm -f "$TEMP_RESTORE"
    
    echo "✅ Data restored successfully!"
else
    echo "❌ Data file not found: $DATA_FILE"
    exit 1
fi

echo ""
echo "📊 Verifying data..."
docker exec ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -c "
SELECT 
    'Users' as table_name, COUNT(*) as count FROM \"user\"
UNION ALL
SELECT 'Templates', COUNT(*) FROM template
UNION ALL
SELECT 'Template Translations', COUNT(*) FROM template_translation
UNION ALL
SELECT 'Images', COUNT(*) FROM image
UNION ALL
SELECT 'Bakong Users', COUNT(*) FROM bakong_user
UNION ALL
SELECT 'Notifications', COUNT(*) FROM notification;
"

echo ""
echo "✅ Restore completed!"
echo ""
echo "🌐 Access your SIT environment:"
echo "   Frontend: http://10.20.6.57:8090"
echo "   Backend:  http://10.20.6.57:4002"
echo "   Health:   http://10.20.6.57:4002/api/v1/health"
echo ""
echo "💡 Login credentials (from development data):"
echo "   Check the user table for available accounts"

