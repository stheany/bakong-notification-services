# 📦 Data Persistence Guide

This guide explains how data (including images) persists when you restart or reset services.

## 🔑 Key Points

### ✅ Data Persists Because:
1. **Docker Volumes**: Database data is stored in Docker volumes (`postgres_data_sit`, `postgres_data_dev`, etc.)
2. **Images in Database**: Images are stored as `BYTEA` in the `image` table, so they're part of the database
3. **Volume Persistence**: Docker volumes persist even when containers are stopped/removed

### 📊 What Gets Persisted:
- ✅ All user accounts
- ✅ All templates and translations
- ✅ **All images** (stored in database as BYTEA)
- ✅ All imageId references in template_translation
- ✅ All notifications
- ✅ All bakong_user records
- ✅ All relationships and foreign keys

## 🔄 What Happens When You Restart

### Scenario 1: `docker compose restart`
```bash
docker compose -f docker-compose.sit.yml restart
```
**Result**: ✅ All data remains - containers restart but volumes stay mounted

### Scenario 2: `docker compose down` then `up`
```bash
docker compose -f docker-compose.sit.yml down
docker compose -f docker-compose.sit.yml up -d
```
**Result**: ✅ All data remains - volumes are preserved

### Scenario 3: `docker compose down -v` (⚠️ DANGEROUS)
```bash
docker compose -f docker-compose.sit.yml down -v
```
**Result**: ❌ **ALL DATA IS LOST** - `-v` removes volumes!

## 💾 Backup Before Important Operations

### Create Backup
```bash
# Backup staging database
bash apps/backend/scripts/backup-database.sh staging

# Backup production database
bash apps/backend/scripts/backup-database.sh production
```

Backups are saved to: `backups/backup_<env>_<timestamp>.sql`

### Restore from Backup
```bash
# Restore staging database
bash apps/backend/scripts/restore-database.sh staging backups/backup_staging_latest.sql

# Restore production database
bash apps/backend/scripts/restore-database.sh production backups/backup_prod_20250101_120000.sql
```

## 🔍 Verify Data After Restart

```bash
# Verify all data is present
bash apps/backend/scripts/verify-data-after-restart.sh staging
```

This will show:
- Number of users, templates, images, etc.
- Whether images have data (BYTEA not empty)
- Whether imageId references are valid
- Any orphaned references

## 📋 Safe Restart Procedure

### Recommended Steps:
```bash
# 1. Create backup (optional but recommended)
bash apps/backend/scripts/backup-database.sh staging

# 2. Stop services
docker compose -f docker-compose.sit.yml down

# 3. Start services (data will be restored from volume)
docker compose -f docker-compose.sit.yml up -d

# 4. Verify data
bash apps/backend/scripts/verify-data-after-restart.sh staging
```

## 🗄️ Database Volume Locations

Docker volumes are stored on the host system:
- **Linux**: `/var/lib/docker/volumes/`
- **Windows**: `\\wsl$\docker-desktop-data\data\docker\volumes\`
- **Mac**: `~/Library/Containers/com.docker.docker/Data/vms/0/`

Volume names:
- `bakong-notification-services_postgres_data_sit` (staging)
- `bakong-notification-services_postgres_data_dev` (development)
- `bakong-notification-services_postgres_data_prod` (production)

## 🔧 Manual Volume Backup (Advanced)

If you want to backup the entire volume:

```bash
# 1. Stop the database container
docker compose -f docker-compose.sit.yml stop db

# 2. Create a backup container
docker run --rm \
  -v bakong-notification-services_postgres_data_sit:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/postgres_volume_$(date +%Y%m%d_%H%M%S).tar.gz -C /data .

# 3. Start the database container
docker compose -f docker-compose.sit.yml start db
```

## ⚠️ Important Warnings

1. **Never use `-v` flag** unless you want to delete all data:
   ```bash
   # ❌ DON'T DO THIS (deletes all data)
   docker compose down -v
   ```

2. **Always backup before major changes**:
   ```bash
   # ✅ DO THIS FIRST
   bash apps/backend/scripts/backup-database.sh staging
   ```

3. **Check volume exists** before removing containers:
   ```bash
   docker volume ls | grep postgres_data
   ```

## 🆘 Recovery Scenarios

### If Data is Lost:

1. **Check if volume still exists**:
   ```bash
   docker volume ls
   docker volume inspect bakong-notification-services_postgres_data_sit
   ```

2. **Restore from backup**:
   ```bash
   bash apps/backend/scripts/restore-database.sh staging backups/backup_staging_latest.sql
   ```

3. **If no backup, check Docker volume**:
   ```bash
   # Volume might still exist even if container is removed
   docker volume ls
   # Recreate container - it will use existing volume
   docker compose -f docker-compose.sit.yml up -d db
   ```

## 📝 Summary

- ✅ **Images are stored in database** (as BYTEA) - they persist with database
- ✅ **Docker volumes persist** data across container restarts
- ✅ **Always backup** before major operations
- ❌ **Never use `-v` flag** unless you want to delete data
- ✅ **Verify data** after restart using verification script

Your data (including images) is safe as long as you don't use `docker compose down -v`!

