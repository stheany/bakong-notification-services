# Database Startup Time Guide

## ⏱️ Why Does Database Take So Long?

When you run `./test-local-sit.sh` for the **first time**, the database container takes **2-5 minutes** to start. This is normal and expected!

### What's Happening During Startup:

1. **PostgreSQL Initialization** (~30-60 seconds)
   - Creating database cluster
   - Setting up data directory
   - Initializing system tables

2. **Database Creation** (~10-20 seconds)
   - Creating `bakong_notification_services_sit` database
   - Creating `bkns_sit` user

3. **Running Init Scripts** (~1-3 minutes)
   - Executing `init-db.sql` (141 lines)
   - Creating extensions (uuid-ossp, pgcrypto)
   - Creating custom types (enums)
   - Creating tables (user, bakong_user, image, template, etc.)
   - Creating indexes (12+ indexes)
   - Creating foreign key constraints
   - Setting up privileges

**Total: 2-5 minutes on first run**

---

## 🚀 How to Speed Up Subsequent Runs

### ✅ Keep Database Volume (Recommended)

The script now **keeps the database volume** by default, so subsequent runs are **much faster** (10-30 seconds):

```bash
# Script automatically does this (no -v flag):
docker compose -f docker-compose.sit.yml down
```

**Result:** Database is already initialized, just needs to start up.

### ❌ Fresh Database (Slower)

If you need a completely fresh database, manually remove the volume:

```bash
# This will delete the database and require re-initialization
docker compose -f docker-compose.sit.yml down -v
```

**Result:** Next run will take 2-5 minutes again.

---

## 📊 Expected Wait Times

| Scenario | Wait Time | Why |
|----------|-----------|-----|
| **First Run** | 2-5 minutes | Full database initialization |
| **Subsequent Runs** | 10-30 seconds | Database already exists |
| **After `down -v`** | 2-5 minutes | Volume deleted, re-initialization needed |
| **After `down` (no -v)** | 10-30 seconds | Volume preserved, fast startup |

---

## 🔍 Monitoring Database Startup

### Watch Database Logs in Real-Time

While waiting, you can watch what's happening:

```bash
# In a separate terminal
docker compose -f docker-compose.sit.yml logs -f db
```

You'll see messages like:
- `database system is ready to accept connections`
- `Bakong Notification Service Database initialized successfully!`

### Check Database Status

```bash
# Check if database is ready
docker compose -f docker-compose.sit.yml exec db pg_isready -U bkns_sit

# Check container status
docker compose -f docker-compose.sit.yml ps db
```

---

## 🐛 Troubleshooting

### Database Taking > 10 Minutes?

**Possible Issues:**
1. **Docker Desktop not running** - Check Docker Desktop is started
2. **Low system resources** - Close other applications
3. **Disk space** - Check available disk space
4. **Windows WSL2 issues** - Restart Docker Desktop

**Solution:**
```bash
# Check Docker is running
docker ps

# Check database logs for errors
docker compose -f docker-compose.sit.yml logs db | tail -50

# Check container status
docker compose -f docker-compose.sit.yml ps
```

### Database Container Restarting?

**Check logs:**
```bash
docker compose -f docker-compose.sit.yml logs db
```

**Common causes:**
- Port conflict (5434 already in use)
- Volume permission issues
- Corrupted volume

**Fix:**
```bash
# Remove and recreate
docker compose -f docker-compose.sit.yml down -v
docker compose -f docker-compose.sit.yml up -d db
```

---

## 💡 Tips

1. **Don't interrupt the first run** - Let it complete initialization
2. **Use `down` without `-v`** - Keeps database for faster runs
3. **Run in background** - Start the script and do other work
4. **Check logs if stuck** - See what's happening inside the container

---

## ✅ Success Indicators

### Database is Ready When:

```bash
# This command succeeds:
docker compose -f docker-compose.sit.yml exec db pg_isready -U bkns_sit

# Output: /var/run/postgresql:5432 - accepting connections
```

### Script Shows:

```
✓ Database is ready
```

---

## 📝 Summary

- **First run:** 2-5 minutes (normal, expected)
- **Subsequent runs:** 10-30 seconds (much faster)
- **Script now handles this automatically** - just wait, it will complete!
- **Watch logs if curious:** `docker compose -f docker-compose.sit.yml logs -f db`

**The script has been updated to wait up to 10 minutes and show progress, so you'll see what's happening!**

