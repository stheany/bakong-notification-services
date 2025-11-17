#!/bin/bash
# Script to start SIT database and verify tables exist

echo "🚀 Starting SIT database..."
echo ""

# Start database service
echo "Starting database container..."
if ! docker compose -f docker-compose.sit.yml up -d db 2>&1; then
    echo "❌ Failed to start database container"
    echo "   Trying alternative method..."
    docker-compose -f docker-compose.sit.yml up -d db 2>&1 || {
        echo "❌ Failed to start database. Please check Docker is running."
        exit 1
    }
fi

echo ""
echo "⏳ Waiting for database to be ready..."
echo "   (This may take 30-60 seconds on first run)"
echo ""

# Wait for database to be healthy
CONTAINER="bakong-notification-services-db-sit"
DB_USER="bkns_sit"
DB_NAME="bakong_notification_services_sit"

MAX_WAIT=120
WAIT_COUNT=0

echo "Waiting for database to be ready (max ${MAX_WAIT} seconds)..."

while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    if docker exec ${CONTAINER} pg_isready -U ${DB_USER} -d ${DB_NAME} > /dev/null 2>&1; then
        echo ""
        echo "✅ Database is ready!"
        break
    fi
    if [ $((WAIT_COUNT % 10)) -eq 0 ]; then
        echo -n "."
    fi
    sleep 1
    WAIT_COUNT=$((WAIT_COUNT + 1))
done

if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
    echo ""
    echo "❌ Database did not become ready within ${MAX_WAIT} seconds"
    echo "   Check if container is running: docker ps | grep ${CONTAINER}"
    echo "   Check logs: docker logs ${CONTAINER}"
    exit 1
fi

echo ""
echo "📋 Checking if tables exist..."

# Check if user table exists
TABLE_EXISTS=$(docker exec ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -t -c "
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user'
);" | tr -d ' ')

if [ "$TABLE_EXISTS" != "t" ]; then
    echo "❌ Tables do not exist!"
    echo ""
    echo "The database may not have been initialized."
    echo "Checking database logs..."
    docker logs ${CONTAINER} --tail 50
    echo ""
    echo "💡 If tables are missing, you may need to:"
    echo "   1. Stop the container: docker compose -f docker-compose.sit.yml down"
    echo "   2. Remove the volume: docker volume rm bakong-notification-services_postgres_data_sit"
    echo "   3. Start again: docker compose -f docker-compose.sit.yml up -d db"
    exit 1
fi

echo "✅ Tables exist!"
echo ""

# List all tables
echo "📊 Available tables in database:"
docker exec ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -c "
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
"

echo ""
echo "✅ Database is ready!"
echo ""
echo "💡 Connection details:"
echo "   Host: localhost"
echo "   Port: 5434"
echo "   Database: ${DB_NAME}"
echo "   User: ${DB_USER}"
echo "   Password: 0101bkns_sit"
echo ""
echo "💡 To insert users, run:"
echo "   ./insert-sit-users.sh"

