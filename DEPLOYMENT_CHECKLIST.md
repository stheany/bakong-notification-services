# ✅ Deployment Checklist - Bakong Platform Feature

Use this checklist to verify everything is ready for deployment.

## 📋 Pre-Deployment Verification

### Code Changes
- [x] All code changes committed and pushed to `develop` branch
- [x] Backend code includes `bakongPlatform` support
- [x] Frontend code includes `bakongPlatform` UI and filtering
- [x] Shared package includes `BakongApp` enum

### Database Migration Files
- [x] `apps/backend/scripts/add-bakong-platform-migration.sql` - ✅ Created
- [x] `apps/backend/scripts/run-bakong-platform-migration.sh` - ✅ Created
- [x] `deploy-on-server.sh` updated to include migration - ✅ Updated

### Documentation
- [x] `DEPLOYMENT_GUIDE.md` - ✅ Created
- [x] This checklist - ✅ Created

## 🚀 Deployment Steps (On Server)

### Step 1: Pull Latest Code
```bash
cd ~/bakong-notification-services
git pull origin develop
```

### Step 2: Verify Migration Script Exists
```bash
ls -la apps/backend/scripts/add-bakong-platform-migration.sql
ls -la apps/backend/scripts/run-bakong-platform-migration.sh
```

### Step 3: Run Database Migration

**Option A: Using the migration script (Recommended)**
```bash
cd apps/backend
bash scripts/run-bakong-platform-migration.sh staging
```

**Option B: Using deploy script (includes migration)**
```bash
bash deploy-on-server.sh
```

**Option C: Manual SQL execution**
```bash
docker exec -i bakong-notification-services-db-sit psql -U bkns_sit -d bakong_notification_services_sit < apps/backend/scripts/add-bakong-platform-migration.sql
```

### Step 4: Verify Migration Success

Check the migration output for:
- ✅ `bakong_platform_enum type exists`
- ✅ `template.bakongPlatform column exists`
- ✅ `bakong_user.bakongPlatform column exists`

Or run verification query:
```sql
-- Check enum type
SELECT typname FROM pg_type WHERE typname = 'bakong_platform_enum';

-- Check template column
SELECT column_name, data_type, udt_name 
FROM information_schema.columns 
WHERE table_name = 'template' AND column_name = 'bakongPlatform';

-- Check bakong_user column
SELECT column_name, data_type, udt_name 
FROM information_schema.columns 
WHERE table_name = 'bakong_user' AND column_name = 'bakongPlatform';
```

### Step 5: Deploy Application

If not using `deploy-on-server.sh`, manually:
```bash
# Stop containers
docker compose -f docker-compose.sit.yml down

# Build backend
docker compose -f docker-compose.sit.yml build --no-cache backend

# Start services
docker compose -f docker-compose.sit.yml up -d

# Check logs
docker compose -f docker-compose.sit.yml logs -f backend
```

### Step 6: Verify Deployment

1. **Check health endpoint**
   ```bash
   curl http://10.20.6.57:4002/api/v1/health
   ```

2. **Test API with bakongPlatform**
   ```bash
   curl -X POST http://10.20.6.57:4002/api/v1/notification/inbox \
     -H "Content-Type: application/json" \
     -H "x-api-key: BAKONG" \
     -d '{
       "accountId": "test@bkrt",
       "fcmToken": "test-token",
       "language": "EN",
       "platform": "ANDROID",
       "bakongPlatform": "BAKONG_TOURIST"
     }'
   ```

3. **Check frontend**
   - Open: http://10.20.6.57:8090
   - Create a notification with Bakong Tourist or Bakong Junior
   - Verify it filters correctly

## 🔍 Troubleshooting

### Migration fails
- Check database connection: `docker ps | grep db`
- Verify credentials in migration script
- Check PostgreSQL logs: `docker logs bakong-notification-services-db-sit`

### Application fails to start
- Check backend logs: `docker compose -f docker-compose.sit.yml logs backend`
- Verify environment variables
- Check database schema matches entities

### Frontend errors
- Clear browser cache
- Check browser console for errors
- Verify API endpoints are accessible

## 📝 Post-Deployment

- [ ] Verify notifications filter by bakongPlatform correctly
- [ ] Test creating notification for each platform (Bakong, Bakong Tourist, Bakong Junior)
- [ ] Test inbox API with different bakongPlatform values
- [ ] Verify "no users" message displays correctly
- [ ] Check that existing notifications still work (backward compatibility)

## ✅ Success Criteria

- [ ] Database migration completed without errors
- [ ] Application starts successfully
- [ ] API endpoints respond correctly
- [ ] Frontend displays correctly
- [ ] Notifications filter by bakongPlatform
- [ ] No errors in logs

---

**Ready to deploy?** Follow the steps above in order. If you encounter any issues, refer to `DEPLOYMENT_GUIDE.md` for detailed troubleshooting.

