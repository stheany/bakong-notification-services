#!/bin/bash
# Script to insert 2 new admin users (Ios Mobile, Android Mobile) into SIT database

set -e

echo "🔐 Inserting new admin users into SIT database..."
echo ""

CONTAINER="bakong-notification-services-db-sit"
DB_USER="bkns_sit"
DB_NAME="bakong_notification_services_sit"
SQL_FILE="apps/backend/init-sit-users.sql"

# Check if container is running
if ! docker ps --format "{{.Names}}" | grep -q "^${CONTAINER}$"; then
    echo "❌ Database container '${CONTAINER}' is not running!"
    echo ""
    echo "Please start the database first:"
    echo "   docker compose -f docker-compose.sit.yml up -d db"
    echo ""
    echo "Or start all services:"
    echo "   docker compose -f docker-compose.sit.yml up -d"
    exit 1
fi

echo "✅ Database container is running"
echo ""

# Check if SQL file exists
if [ ! -f "$SQL_FILE" ]; then
    echo "❌ SQL file not found: $SQL_FILE"
    exit 1
fi

# Check if tables exist
echo "📋 Checking if tables exist..."
TABLE_EXISTS=$(docker exec ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -t -c "
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user'
);" | tr -d ' ')

if [ "$TABLE_EXISTS" != "t" ]; then
    echo "❌ Table 'user' does not exist in the database!"
    echo ""
    echo "The database may not have been initialized properly."
    echo "Please check:"
    echo "   1. Database container logs: docker logs ${CONTAINER}"
    echo "   2. Verify init-db.sql was executed"
    echo "   3. You may need to restart the database container"
    exit 1
fi

echo "✅ Tables exist"
echo ""

# Execute SQL file
echo "📥 Executing SQL script to insert users..."
docker exec -i ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} < "$SQL_FILE"

echo ""
echo "✅ Users inserted successfully!"
echo ""

# Verify users were inserted
echo "📊 Verifying inserted users..."
docker exec ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -c "
SELECT 
    id,
    username,
    \"displayName\",
    role,
    \"createdAt\"
FROM public.\"user\"
WHERE username IN ('ios-mobile', 'android-mobile')
ORDER BY username;
"

echo ""
echo "✅ Done!"
echo ""
echo "💡 Default password for both users: admin123"
echo "   (Same as existing admin user)"
echo "   Users can change their password after first login."

