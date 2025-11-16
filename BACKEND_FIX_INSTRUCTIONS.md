# Backend Connection Timeout Fix

## Problem
- Frontend shows `ERR_CONNECTION_TIMED_OUT` when trying to connect to backend
- Backend container keeps restarting with `Error: Cannot find module '@nestjs/core'`
- This happens both locally and on the server

## Root Cause
The Dockerfile was using `npm prune --production` which was removing required dependencies in the npm workspace setup.

## Solution Applied
✅ Removed `npm prune --production` from the Dockerfile
✅ Now copying all node_modules from builder stage without pruning
✅ Added better error checking to verify dependencies exist

## How to Fix (On Server)

### Step 1: SSH to Server
```bash
ssh dev@10.20.6.57
```

### Step 2: Navigate to Project
```bash
cd ~/bakong-notification-services
# or wherever your project is located
```

### Step 3: Pull Latest Code
```bash
git fetch origin
git reset --hard origin/develop
# or origin/main if using main branch
```

### Step 4: Rebuild Backend
```bash
docker compose -f docker-compose.sit.yml build backend --no-cache
```

This will take 3-5 minutes. Wait for it to complete.

### Step 5: Restart Services
```bash
docker compose -f docker-compose.sit.yml up -d
```

### Step 6: Verify Backend is Running
```bash
# Check container status
docker compose -f docker-compose.sit.yml ps

# Check backend logs (should NOT show @nestjs/core error)
docker compose -f docker-compose.sit.yml logs backend --tail=50

# Test backend health endpoint
curl http://localhost:4002/api/v1/health
```

### Step 7: Test Frontend
Open browser: `http://10.20.6.57:8090`

The frontend should now be able to connect to the backend API.

## Expected Results

✅ Backend container status: `Up` (not "Restarting")
✅ Backend logs: No `@nestjs/core` errors
✅ Health endpoint: Returns JSON with `"status": "ok"`
✅ Frontend: Can load data from API (no connection timeout errors)

## Troubleshooting

### If backend still shows errors:
```bash
# Check if @nestjs/core exists in container
docker compose -f docker-compose.sit.yml exec backend ls -la node_modules/@nestjs/core
docker compose -f docker-compose.sit.yml exec backend ls -la apps/backend/node_modules/@nestjs/core

# Check full logs
docker compose -f docker-compose.sit.yml logs backend
```

### If build fails:
```bash
# Check Docker build logs
docker compose -f docker-compose.sit.yml build backend --no-cache 2>&1 | tee build.log

# Look for errors in build.log
```

## For Local Testing

Same steps, but use:
```bash
docker compose -f docker-compose.sit.yml build backend --no-cache
docker compose -f docker-compose.sit.yml up -d
```

Then test at: `http://localhost:4002/api/v1/health`

