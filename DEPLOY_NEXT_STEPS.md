# 🚀 Next Steps - Deploy Configuration Changes

## ✅ What We've Fixed

1. ✅ Authentication bugs (null check, local strategy, response codes)
2. ✅ HTTP status code mapping (401 instead of 500 for invalid credentials)
3. ✅ AppController registered for health endpoint
4. ✅ Healthcheck added to docker-compose
5. ✅ Frontend configured for port 80 (default HTTP - no port needed)
6. ✅ Nginx API proxy configured
7. ✅ Users inserted into database

## 📋 Deployment Steps

### Step 1: Push Code Changes to Git

```bash
# On your local machine
git add .
git commit -m "Fix: Auth bugs, healthcheck, port 80 configuration for mobile"
git push origin develop  # or your branch name
```

### Step 2: Deploy to Server

```bash
# SSH to server
ssh dev@10.20.6.57
# or
ssh dev@sit-bk-notifi-service

# Navigate to project
cd ~/bakong-notification-services

# Pull latest code
git pull origin develop  # or your branch name

# Rebuild and restart services
# Note: Port 80 may require sudo
sudo docker compose -f docker-compose.sit.yml up -d --build
```

### Step 3: Verify Deployment

```bash
# Check containers are running
docker ps | grep bakong-notification-services

# Check backend health
curl http://10.20.6.57/api/v1/health

# Check frontend
curl http://10.20.6.57/

# Check backend logs
docker compose -f docker-compose.sit.yml logs backend --tail=50

# Check frontend logs
docker compose -f docker-compose.sit.yml logs frontend --tail=50
```

### Step 4: Test Login

1. Open browser: `http://10.20.6.57/`
2. Try logging in with:
   - Username: `So Theany` (with spaces)
   - Password: `1234qwer`

### Step 5: Test API Endpoints (for mobile)

```bash
# Test login endpoint
curl -X POST http://10.20.6.57/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=So Theany&password=1234qwer"

# Test health endpoint
curl http://10.20.6.57/api/v1/health
```

## 📱 Mobile App Configuration

Provide to mobile team:

```
Base URL: http://10.20.6.57

API Endpoints:
- Login: http://10.20.6.57/api/v1/auth/login
- Notifications: http://10.20.6.57/api/v1/notifications/inbox
- Send: http://10.20.6.57/api/v1/notifications/send
- Health: http://10.20.6.57/api/v1/health
```

## ⚠️ Important Notes

1. **Port 80 requires root**: You may need `sudo` to bind to port 80
2. **If port 80 is in use**: Check what's using it: `sudo lsof -i :80`
3. **Firewall**: Make sure port 80 is open: `sudo ufw allow 80`
4. **Backward compatibility**: If you need to keep port 8090, uncomment those lines in docker-compose.sit.yml

## 🔍 Troubleshooting

### Port 80 Already in Use
```bash
# Check what's using port 80
sudo lsof -i :80

# Stop conflicting service or use different port
# Option: Change docker-compose.sit.yml back to "8090:80"
```

### Container Won't Start
```bash
# Check logs
docker compose -f docker-compose.sit.yml logs frontend
docker compose -f docker-compose.sit.yml logs backend

# Restart services
docker compose -f docker-compose.sit.yml restart
```

### API Not Working
```bash
# Verify nginx proxy is working
curl -v http://10.20.6.57/api/v1/health

# Check backend is accessible
curl http://10.20.6.57:4002/api/v1/health
```

## ✅ Success Checklist

- [ ] Code pushed to git
- [ ] Code pulled on server
- [ ] Services rebuilt and restarted
- [ ] Port 80 accessible (or 8090 if using that)
- [ ] Health endpoint works: `http://10.20.6.57/api/v1/health`
- [ ] Login works in web browser
- [ ] API endpoints accessible from mobile
- [ ] Mobile team has base URL: `http://10.20.6.57`

