# Fix Database Connection Issue

## Problem
The backend can't connect to the database. Error:
```
[TypeOrmModule] Unable to connect to the database. Retrying...
```

## Solution Options

### Option 1: Start Database with Docker Compose (Recommended)

1. **Make sure Docker Desktop is running**
   - Open Docker Desktop application
   - Wait for it to fully start (whale icon in system tray)

2. **Start the database container:**
   ```bash
   cd C:\Users\theany.so\Desktop\bakong-notification-services
   docker-compose up -d db
   ```

3. **Verify database is running:**
   ```bash
   docker ps | grep bakong-notification-services-db
   ```
   Should show the container as "Up"

4. **Check database connection:**
   ```bash
   docker logs bakong-notification-services-db-dev
   ```
   Should show "database system is ready to accept connections"

5. **Restart your backend server:**
   ```bash
   cd apps/backend
   npm run dev
   ```

### Option 2: Use Local PostgreSQL (If you have it installed)

If you have PostgreSQL installed locally:

1. **Create the database:**
   ```sql
   CREATE DATABASE bakong_notification_services_dev;
   CREATE USER bkns_dev WITH PASSWORD 'dev';
   GRANT ALL PRIVILEGES ON DATABASE bakong_notification_services_dev TO bkns_dev;
   ```

2. **Update connection settings:**
   - Create `apps/backend/env.development` file:
   ```env
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   POSTGRES_DB=bakong_notification_services_dev
   POSTGRES_USER=bkns_dev
   POSTGRES_PASSWORD=dev
   ```

3. **Restart backend server**

### Option 3: Check Current Database Configuration

The backend is trying to connect with these defaults (development mode):
- **Host:** `localhost`
- **Port:** `5437` (mapped from Docker container port 5432)
- **Database:** `bakong_notification_services_dev`
- **User:** `bkns_dev`
- **Password:** `dev`

## Quick Fix Commands

```bash
# 1. Start Docker Desktop (if not running)

# 2. Start database container
docker-compose up -d db

# 3. Wait a few seconds for database to initialize

# 4. Check if database is ready
docker logs bakong-notification-services-db-dev --tail 20

# 5. Restart backend (in a new terminal)
cd apps/backend
npm run dev
```

## Verify Database Connection

Once the database is running, you should see in the backend logs:
```
✅ TypeORM synchronize is enabled - schema will be automatically synchronized with entities
[Nest] LOG [InstanceLoader] TypeOrmModule dependencies initialized
```

Instead of:
```
❌ ERROR [TypeOrmModule] Unable to connect to the database. Retrying...
```

## Troubleshooting

1. **Docker Desktop not running?**
   - Open Docker Desktop application
   - Wait for it to start completely

2. **Port 5437 already in use?**
   - Check: `netstat -an | findstr 5437`
   - Stop the process using that port or change the port in `docker-compose.yml`

3. **Database container keeps stopping?**
   - Check logs: `docker logs bakong-notification-services-db-dev`
   - Check if there's enough disk space
   - Try removing and recreating: `docker-compose down -v` then `docker-compose up -d db`

4. **Wrong credentials?**
   - Default dev credentials are in `docker-compose.yml`
   - Or set them in `apps/backend/env.development`

