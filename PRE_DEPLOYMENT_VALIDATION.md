# 🔍 Pre-Deployment Validation Guide

When you're at home and can't test with the real server, use these tools to ensure your code will work when deployed.

## 🎯 Quick Start

### Step 1: Validate Configuration
```bash
chmod +x validate-deployment.sh
./validate-deployment.sh
```

This checks that `docker-compose.sit.yml` has the correct:
- Server IP addresses (10.20.6.57 for SIT)
- Port mappings (4002 for backend, 8090 for frontend)
- API URLs
- CORS settings
- Environment variables

### Step 2: Test Server Configuration Locally (Recommended when you can't access server IP)

**Option A: Test with Server Ports but Localhost (Best for home testing)**
```bash
# Bash / Git Bash
chmod +x test-server-config.sh
./test-server-config.sh

# PowerShell
.\test-server-config.ps1
```

This will:
- Use SAME ports as server (4002, 8090, 5434)
- Use SAME structure as server config
- Use localhost instead of server IP (works from home!)
- Verify the configuration pattern is correct

**Why this helps:** You can't access the server IP from home, but you can verify the configuration structure and ports match. If this works, the server deployment should work too!

**Option B: Test with Server IPs in Config (If you have network access)**
```bash
chmod +x test-local-sit.sh
./test-local-sit.sh
```

This will:
- Build Docker images using SIT configuration with server IPs
- Start services locally but with server URLs in config
- Test that everything works
- Verify environment variables are set correctly

**Why this helps:** Even though you're running locally, the configuration matches the server exactly. If it works here, it should work on the server.

### Step 3: Deploy to Server
Once validation passes, you can confidently push and deploy.

---

## 📋 What Gets Validated

### SIT Server Configuration (`docker-compose.sit.yml`)

| Setting | Expected Value | Why It Matters |
|---------|---------------|----------------|
| `API_BASE_URL` | `http://10.20.6.57:4002` | Backend must know its own URL for generating links |
| `CORS_ORIGIN` | `http://10.20.6.57:8090` | Browser will block API calls if this doesn't match frontend URL |
| `VITE_API_BASE_URL` | `http://10.20.6.57:4002` | Frontend needs to know where to send API requests |
| `NODE_ENV` | `staging` | Determines which env file to load |
| Backend Port | `4002:8080` | External port must match server configuration |
| Frontend Port | `8090:80` | External port must match server configuration |

### Common Mistakes Caught

✅ **Good:**
```yaml
API_BASE_URL=http://10.20.6.57:4002
CORS_ORIGIN=http://10.20.6.57:8090
```

❌ **Bad (will fail on server):**
```yaml
API_BASE_URL=http://localhost:4002  # Wrong! Server doesn't have localhost
CORS_ORIGIN=http://localhost:8090   # Wrong! Browser will block requests
```

---

## 🧪 Testing Workflow

### Option 1: Quick Validation (Recommended)
```bash
# Just validate configuration
./validate-deployment.sh
```

**Time:** ~5 seconds  
**Use when:** You've made small changes and want to verify config is correct

### Option 2: Full Local Test
```bash
# Validate + test locally with SIT config
./validate-deployment.sh
./test-local-sit.sh
```

**Time:** ~5-10 minutes  
**Use when:** You've made significant changes and want to be extra sure

### Option 3: Manual Checklist
If scripts aren't available, manually check:

- [ ] `docker-compose.sit.yml` has `API_BASE_URL=http://10.20.6.57:4002`
- [ ] `docker-compose.sit.yml` has `CORS_ORIGIN=http://10.20.6.57:8090`
- [ ] `docker-compose.sit.yml` has `VITE_API_BASE_URL=http://10.20.6.57:4002`
- [ ] `docker-compose.sit.yml` has `NODE_ENV=staging`
- [ ] Backend port mapping is `4002:8080`
- [ ] Frontend port mapping is `8090:80`
- [ ] No `localhost` in SIT configuration

---

## 🚨 Troubleshooting

### Validation Fails: "API_BASE_URL mismatch"

**Problem:** Configuration doesn't match expected server values.

**Fix:**
1. Open `docker-compose.sit.yml`
2. Find `API_BASE_URL` under `backend` service
3. Change to: `http://10.20.6.57:4002`
4. Run validation again

### Validation Fails: "Found 'localhost' in SIT config"

**Problem:** Configuration still uses localhost instead of server IP.

**Fix:**
1. Search for `localhost` in `docker-compose.sit.yml`
2. Replace with `10.20.6.57` (for SIT) or appropriate server IP
3. Run validation again

### Local Test Fails: "Backend not ready"

**Problem:** Backend container isn't starting properly.

**Fix:**
1. Check logs: `docker compose -f docker-compose.sit.yml logs backend`
2. Look for database connection errors
3. Verify database is healthy: `docker compose -f docker-compose.sit.yml ps db`
4. Check environment variables are set correctly

### Local Test: Frontend Shows Network Errors

**Problem:** Frontend can't reach backend.

**Possible causes:**
1. Backend not running
2. Wrong `VITE_API_BASE_URL` in build
3. CORS issues (but this shouldn't happen locally)

**Fix:**
1. Verify backend is running: `curl http://localhost:4002/api/v1/health`
2. Check frontend build logs for `VITE_API_BASE_URL`
3. Rebuild frontend if needed

---

## 📝 Pre-Push Checklist

Before pushing code to GitHub:

- [ ] Run `./validate-deployment.sh` - all checks pass
- [ ] (Optional) Run `./test-local-sit.sh` - all tests pass
- [ ] Code is committed
- [ ] No sensitive data in commits (passwords, tokens, etc.)
- [ ] Configuration files are correct for target environment

---

## 🔄 After Deployment

Once you've deployed to the server, you can verify it's working:

### From Your Home (if server is accessible)
```powershell
# Test backend
Invoke-RestMethod -Uri "http://10.20.6.57:4002/api/v1/health"

# Test frontend (open in browser)
Start-Process "http://10.20.6.57:8090"
```

### From Server (SSH)
```bash
# Run diagnostic script
./diagnose-server.sh

# Or manually check
curl http://localhost:4002/api/v1/health
docker compose -f docker-compose.sit.yml ps
docker compose -f docker-compose.sit.yml logs -f
```

---

## 🎓 Understanding the Configuration

### Why Server IPs Matter

When your application runs on the server:
- **Backend** needs to know its own URL to generate links (e.g., in emails, API responses)
- **Frontend** needs to know where to send API requests
- **Browser** enforces CORS - the `CORS_ORIGIN` must match the URL you're accessing from

### Example Scenario

**Wrong Configuration:**
```yaml
API_BASE_URL=http://localhost:4002
CORS_ORIGIN=http://localhost:8090
```

**What happens on server:**
1. You access `http://10.20.6.57:8090` in browser
2. Frontend tries to call `http://localhost:4002/api/...` (from browser)
3. Browser says "localhost:4002 doesn't exist" → Network error
4. Even if it worked, CORS would block it because origin is `10.20.6.57:8090` but CORS expects `localhost:8090`

**Correct Configuration:**
```yaml
API_BASE_URL=http://10.20.6.57:4002
CORS_ORIGIN=http://10.20.6.57:8090
```

**What happens on server:**
1. You access `http://10.20.6.57:8090` in browser
2. Frontend calls `http://10.20.6.57:4002/api/...` (from browser)
3. Browser allows it because CORS origin matches
4. ✅ Everything works!

---

## 📚 Related Files

- `validate-deployment.sh` - Configuration validation script
- `test-local-sit.sh` - Local testing with SIT configuration
- `docker-compose.sit.yml` - SIT server configuration
- `docker-compose.production.yml` - Production server configuration
- `PRE_DEPLOYMENT_CHECKLIST.md` - General deployment checklist
- `DEPLOY_SIT.md` - Step-by-step deployment guide

---

## 💡 Pro Tips

1. **Always validate before pushing** - It takes 5 seconds and saves hours of debugging
2. **Test locally with SIT config** - If you have time, this catches most issues
3. **Check logs after deployment** - Even if validation passes, check server logs
4. **Use version control** - Commit working configurations so you can revert if needed
5. **Document changes** - If you change server IPs, update all config files and documentation

---

## ❓ FAQ

**Q: Do I need to run both validation and local test?**  
A: No, validation is usually enough. Local test is optional but gives more confidence.

**Q: What if validation passes but deployment still fails?**  
A: Check server logs. Common issues: database connection, missing files, port conflicts.

**Q: Can I test production configuration locally?**  
A: Yes, but you'd need to modify the script or manually use `docker-compose.production.yml`. Be careful with production credentials.

**Q: What if server IP changes?**  
A: Update `docker-compose.sit.yml` and run validation again. Also update this documentation.

**Q: Why can't I just test on the server directly?**  
A: You can, but validation helps catch issues before you even connect to the server. It's faster and prevents breaking production.

