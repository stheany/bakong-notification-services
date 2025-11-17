# Quick Start SIT Database

## Manual Steps (if script is stuck)

### Step 1: Start Database
```bash
docker compose -f docker-compose.sit.yml up -d db
```

### Step 2: Wait for Database (check status)
```bash
# Check if container is running
docker ps | grep bakong-notification-services-db-sit

# Check database logs
docker logs bakong-notification-services-db-sit

# Wait until you see "database system is ready to accept connections"
```

### Step 3: Check if Tables Exist
```bash
docker exec bakong-notification-services-db-sit psql -U bkns_sit -d bakong_notification_services_sit -c "\dt"
```

### Step 4: Insert Users
```bash
docker exec -i bakong-notification-services-db-sit psql -U bkns_sit -d bakong_notification_services_sit < apps/backend/init-sit-users.sql
```

### Step 5: Verify Users
```bash
docker exec bakong-notification-services-db-sit psql -U bkns_sit -d bakong_notification_services_sit -c "SELECT id, username, \"displayName\", role FROM public.\"user\" WHERE username IN ('ios-mobile', 'android-mobile');"
```

## Troubleshooting

### If container won't start:
```bash
# Check Docker is running
docker ps

# Check for port conflicts (port 5434)
netstat -an | grep 5434

# Remove old container and start fresh
docker compose -f docker-compose.sit.yml down
docker compose -f docker-compose.sit.yml up -d db
```

### If tables don't exist:
```bash
# Check init script ran
docker logs bakong-notification-services-db-sit | grep -i "init"

# Reinitialize (WARNING: deletes data)
docker compose -f docker-compose.sit.yml down -v
docker compose -f docker-compose.sit.yml up -d db
```

