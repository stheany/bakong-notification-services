# 🏠 Testing Server Configuration from Home

When you're at home and can't access the real server IP (10.20.6.57), you can still test your server configuration locally!

## 🎯 The Problem

- ❌ Can't access server IP `10.20.6.57` from home
- ❌ Can't test if server configuration will work
- ❌ Worried about breaking things when deploying

## ✅ The Solution

Test with **server-like configuration** using **localhost** instead of the server IP!

## 🚀 Quick Start

### Option 1: Test Server Structure with Localhost (Recommended)

```bash
# Bash / Git Bash
./test-server-config.sh

# PowerShell
.\test-server-config.ps1
```

**What this does:**
- ✅ Uses **SAME ports** as server (4002, 8090, 5434)
- ✅ Uses **SAME structure** as `docker-compose.sit.yml`
- ✅ Uses **localhost** instead of server IP (works from home!)
- ✅ Verifies configuration pattern is correct

**Access URLs:**
- Frontend: `http://localhost:8090` (same port as server)
- Backend: `http://localhost:4002` (same port as server)

### Option 2: Test with Server IPs in Config

```bash
./test-local-sit.sh
```

**What this does:**
- Uses actual server IPs in configuration
- Runs locally but with server URLs
- Only works if you have network access to server

## 📊 Configuration Comparison

| Setting | Server (SIT) | Test (Localhost) |
|---------|-------------|------------------|
| Frontend Port | 8090 | 8090 ✅ |
| Backend Port | 4002 | 4002 ✅ |
| Database Port | 5434 | 5434 ✅ |
| API_BASE_URL | `http://10.20.6.57:4002` | `http://localhost:4002` |
| CORS_ORIGIN | `http://10.20.6.57:8090` | `http://localhost:8090` |
| Structure | Server config | Same structure ✅ |

**Key Point:** The structure and ports match exactly. Only the IP changes!

## 🧪 Testing Workflow

### Step 1: Validate Configuration
```bash
./validate-deployment.sh
```

Checks that `docker-compose.sit.yml` has correct server settings.

### Step 2: Test Server Structure Locally
```bash
./test-server-config.sh
```

Tests with server ports/structure but localhost.

### Step 3: Verify Everything Works
1. Open `http://localhost:8090` in browser
2. Check browser console (F12) for errors
3. Try logging in
4. Test API calls

### Step 4: Deploy with Confidence
If everything works locally with server structure, it should work on the server!

## 📁 Files Used

- **`docker-compose.test-server.yml`** - Test configuration (server structure, localhost IPs)
- **`docker-compose.sit.yml`** - Actual server configuration (server IPs)
- **`test-server-config.sh`** - Test script

## 🔍 What Gets Tested

✅ **Port Structure**
- Backend port 4002 (matches server)
- Frontend port 8090 (matches server)
- Database port 5434 (matches server)

✅ **Configuration Pattern**
- Same environment variables structure
- Same NODE_ENV (staging)
- Same database credentials pattern
- Same volume mounts

✅ **Application Functionality**
- Backend starts and responds
- Frontend builds and serves
- Database connects
- API endpoints work
- CORS configuration works

## ⚠️ Important Notes

1. **This uses localhost, not server IP**
   - URLs will be `http://localhost:4002` not `http://10.20.6.57:4002`
   - But the structure matches exactly

2. **Ports match server exactly**
   - If port 4002 works locally, it will work on server
   - If port 8090 works locally, it will work on server

3. **Configuration pattern is verified**
   - Same docker-compose structure
   - Same environment variables
   - Same dependencies

4. **When you deploy to server**
   - Just swap localhost for server IP
   - Everything else stays the same
   - Should work immediately!

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Check what's using the port
netstat -ano | findstr :4002  # Windows
lsof -i :4002                 # Linux/Mac

# Stop conflicting services
docker compose -f docker-compose.sit.yml down
docker compose -f docker-compose.yml down
```

### Backend Not Starting
```bash
# Check logs
docker compose -f docker-compose.test-server.yml logs backend

# Common issues:
# - Database not ready (wait longer)
# - Missing env files
# - Port conflicts
```

### Frontend Shows Network Errors
- Check backend is running: `curl http://localhost:4002/api/v1/health`
- Check browser console (F12) for specific errors
- Verify CORS_ORIGIN matches frontend URL

## 📝 Example Output

```
🧪 Testing Server Configuration Locally
==========================================

Step 1: Cleaning up old containers...
✓ Cleanup complete

Step 2: Building Docker images...
✓ Build successful

Step 3: Starting services...
✓ Services started

Step 4: Waiting for database...
✓ Database is ready

Step 5: Waiting for backend...
✓ Backend is ready (HTTP 200)

Step 6: Testing API endpoints...
✓ Health endpoint working
✓ Management healthcheck working

Step 7: Checking frontend...
✓ Frontend is accessible (HTTP 200)

Step 8: Verifying environment variables...
  CORS_ORIGIN: http://localhost:8090
  API_BASE_URL: http://localhost:4002
  NODE_ENV: staging
✓ NODE_ENV is 'staging' (matches server)

Step 9: Verifying port structure...
✓ Port structure matches server configuration

✅ Server Configuration Test Complete!

Services are running with SERVER-LIKE configuration:
  Frontend: http://localhost:8090 (same port as server)
  Backend API: http://localhost:4002 (same port as server)
```

## 🎓 Understanding the Approach

### Why This Works

1. **Ports are the same** → If ports work locally, they work on server
2. **Structure is the same** → If structure works locally, it works on server
3. **Only IP changes** → When deploying, just swap localhost for server IP
4. **Configuration pattern verified** → Same env vars, same dependencies

### What This Proves

✅ Your configuration structure is correct  
✅ Your ports are configured properly  
✅ Your application works with server-like setup  
✅ When you deploy, only the IP changes (automatic in docker-compose.sit.yml)

### What This Doesn't Test

❌ Actual network connectivity to server (but you can't test that from home anyway)  
❌ Server-specific firewall rules  
❌ Server-specific DNS/hostname resolution  

But these are server infrastructure issues, not your code/configuration issues!

## 🚀 Next Steps

1. ✅ Test locally with `./test-server-config.sh`
2. ✅ Verify everything works
3. ✅ Validate config with `./validate-deployment.sh`
4. ✅ Deploy to server with confidence!

---

**Remember:** If it works locally with server structure, it will work on the server! 🎉

