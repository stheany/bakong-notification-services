# 🚀 Quick Deployment Guide

## When You're at Home (Can't Access Server Directly)

### Step 1: Validate Configuration ⚡ (5 seconds)
```bash
# Bash / Git Bash
./validate-deployment.sh

# PowerShell
.\validate-deployment.ps1
```

✅ **What it checks:**
- Server IPs are correct (10.20.6.57 for SIT)
- Ports match server configuration
- API URLs are set correctly
- CORS settings match frontend URL
- No localhost in server config

### Step 2: (Optional) Test Server Configuration Locally 🧪 (5-10 minutes)
```bash
# Bash / Git Bash
./test-server-config.sh

# PowerShell
.\test-server-config.ps1
```

✅ **What it does:**
- Uses SAME ports as server (4002, 8090, 5434)
- Uses SAME structure as server config
- Uses localhost instead of server IP (works from home!)
- Verifies configuration pattern is correct

**Perfect when you can't access the server IP!**

**Alternative:** If you want to test with actual server IPs in config:
```bash
./test-local-sit.sh  # Uses server IPs but runs locally
```

### Step 3: Deploy to Server 🚀
```bash
# SSH to server
ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no dev@10.20.6.57

# On server
cd ~/bakong-notification-services
git pull origin develop
docker compose -f docker-compose.sit.yml up -d --build
```

### Step 4: Verify Deployment ✅
```powershell
# From your Windows machine
Invoke-RestMethod -Uri "http://10.20.6.57:4002/api/v1/health"
Start-Process "http://10.20.6.57:8090"
```

---

## Common Issues & Quick Fixes

### ❌ Validation Fails: "API_BASE_URL mismatch"
**Fix:** Open `docker-compose.sit.yml`, find `API_BASE_URL`, change to `http://10.20.6.57:4002`

### ❌ Validation Fails: "Found 'localhost' in SIT config"
**Fix:** Search for `localhost` in `docker-compose.sit.yml`, replace with `10.20.6.57`

### ❌ Deployment Fails: "Backend not starting"
**Check:** `docker compose -f docker-compose.sit.yml logs backend`
**Common causes:** Database connection, missing env files, port conflicts

### ❌ Frontend Shows Network Errors
**Check:**
1. Backend is running: `curl http://10.20.6.57:4002/api/v1/health`
2. Browser console (F12) for specific errors
3. CORS_ORIGIN matches frontend URL

---

## Configuration Reference

### SIT Server (10.20.6.57)
| Setting | Value |
|---------|-------|
| Frontend URL | `http://10.20.6.57:8090` |
| Backend URL | `http://10.20.6.57:4002` |
| API_BASE_URL | `http://10.20.6.57:4002` |
| CORS_ORIGIN | `http://10.20.6.57:8090` |
| VITE_API_BASE_URL | `http://10.20.6.57:4002` |

### Production Server (10.20.6.58)
| Setting | Value |
|---------|-------|
| Frontend URL | `https://prod-bk-notifi-service` |
| Backend URL | `https://prod-bk-notifi-service:8080` |
| API_BASE_URL | `https://prod-bk-notifi-service:8080` |
| CORS_ORIGIN | `https://prod-bk-notifi-service` |

---

## Files You Need

- ✅ `validate-deployment.sh` / `validate-deployment.ps1` - Configuration validation
- ✅ `test-local-sit.sh` - Local testing with SIT config
- ✅ `docker-compose.sit.yml` - SIT server configuration
- ✅ `PRE_DEPLOYMENT_VALIDATION.md` - Detailed validation guide
- ✅ `DEPLOY_SIT.md` - Full deployment instructions

---

## Pro Tips 💡

1. **Always validate before pushing** - Takes 5 seconds, saves hours
2. **Run local SIT test for major changes** - Catches most issues
3. **Check server logs after deployment** - Even if validation passes
4. **Keep configurations in version control** - Easy to revert if needed

---

## Need More Help?

- 📖 **Detailed Guide:** `PRE_DEPLOYMENT_VALIDATION.md`
- 🚀 **Deployment Steps:** `DEPLOY_SIT.md`
- 🧪 **Testing Commands:** `TEST_COMMANDS.md`
- ✅ **Pre-Deployment Checklist:** `PRE_DEPLOYMENT_CHECKLIST.md`

