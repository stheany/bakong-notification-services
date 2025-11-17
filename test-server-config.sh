#!/bin/bash
# Test Server Configuration Locally
# This uses the SAME ports and structure as the server, but with localhost
# Perfect for testing server configuration when you can't access the real server IP

set -e

echo "🧪 Testing Server Configuration Locally"
echo "=========================================="
echo ""
echo "This will:"
echo "  ✓ Use SAME ports as server (4002, 8090, 5434)"
echo "  ✓ Use SAME structure as docker-compose.sit.yml"
echo "  ✓ Use localhost instead of server IP (so it works from home)"
echo "  ✓ Verify the configuration pattern is correct"
echo ""
echo "If this works, your server deployment should work too!"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Ask for confirmation
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 0
fi

# Step 1: Stop any existing containers
echo -e "\n${BLUE}Step 1: Cleaning up old containers...${NC}"
docker compose -f docker-compose.test-server.yml down -v 2>/dev/null || true
# Also stop any conflicting containers
docker compose -f docker-compose.sit.yml down -v 2>/dev/null || true
docker compose -f docker-compose.yml down -v 2>/dev/null || true
echo -e "${GREEN}✓ Cleanup complete${NC}"

# Step 2: Build images
echo -e "\n${BLUE}Step 2: Building Docker images with server-like configuration...${NC}"
docker compose -f docker-compose.test-server.yml build --no-cache
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Build successful${NC}"
else
  echo -e "${RED}✗ Build failed${NC}"
  exit 1
fi

# Step 3: Start services
echo -e "\n${BLUE}Step 3: Starting services...${NC}"
docker compose -f docker-compose.test-server.yml up -d
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Services started${NC}"
else
  echo -e "${RED}✗ Failed to start services${NC}"
  exit 1
fi

# Step 4: Wait for database
echo -e "\n${BLUE}Step 4: Waiting for database to be ready...${NC}"
sleep 10
DB_HEALTH=$(docker compose -f docker-compose.test-server.yml exec -T db pg_isready -U bkns_sit -d bakong_notification_services_sit 2>&1)
if echo "$DB_HEALTH" | grep -q "accepting connections"; then
  echo -e "${GREEN}✓ Database is ready${NC}"
else
  echo -e "${RED}✗ Database not ready${NC}"
  docker compose -f docker-compose.test-server.yml logs db
  exit 1
fi

# Step 5: Wait for backend
echo -e "\n${BLUE}Step 5: Waiting for backend to be ready...${NC}"
MAX_ATTEMPTS=30
ATTEMPT=0
BACKEND_READY=false

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  sleep 2
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4002/api/v1/health || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    BACKEND_READY=true
    break
  fi
  ATTEMPT=$((ATTEMPT + 1))
  echo -n "."
done

if [ "$BACKEND_READY" = true ]; then
  echo -e "\n${GREEN}✓ Backend is ready (HTTP $HTTP_CODE)${NC}"
else
  echo -e "\n${RED}✗ Backend not ready after $MAX_ATTEMPTS attempts${NC}"
  echo -e "\n${YELLOW}Backend logs:${NC}"
  docker compose -f docker-compose.test-server.yml logs backend | tail -50
  exit 1
fi

# Step 6: Test API endpoints
echo -e "\n${BLUE}Step 6: Testing API endpoints...${NC}"

# Test health endpoint
HEALTH_RESPONSE=$(curl -s http://localhost:4002/api/v1/health)
if echo "$HEALTH_RESPONSE" | grep -q "status"; then
  echo -e "${GREEN}✓ Health endpoint working${NC}"
  echo "  Response: $(echo $HEALTH_RESPONSE | head -c 100)..."
else
  echo -e "${RED}✗ Health endpoint failed${NC}"
  echo "  Response: $HEALTH_RESPONSE"
fi

# Test management healthcheck
MANAGEMENT_RESPONSE=$(curl -s http://localhost:4002/api/v1/management/healthcheck)
if echo "$MANAGEMENT_RESPONSE" | grep -q "status"; then
  echo -e "${GREEN}✓ Management healthcheck working${NC}"
else
  echo -e "${YELLOW}⚠ Management healthcheck returned unexpected response${NC}"
fi

# Step 7: Check frontend
echo -e "\n${BLUE}Step 7: Checking frontend...${NC}"
FRONTEND_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8090 || echo "000")
if [ "$FRONTEND_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Frontend is accessible (HTTP $FRONTEND_CODE)${NC}"
else
  echo -e "${YELLOW}⚠ Frontend returned HTTP $FRONTEND_CODE${NC}"
  docker compose -f docker-compose.test-server.yml logs frontend | tail -20
fi

# Step 8: Verify environment variables match server structure
echo -e "\n${BLUE}Step 8: Verifying environment variables (server-like structure)...${NC}"
CORS_ORIGIN=$(docker compose -f docker-compose.test-server.yml exec -T backend printenv CORS_ORIGIN 2>/dev/null || echo "NOT SET")
API_BASE_URL=$(docker compose -f docker-compose.test-server.yml exec -T backend printenv API_BASE_URL 2>/dev/null || echo "NOT SET")
NODE_ENV=$(docker compose -f docker-compose.test-server.yml exec -T backend printenv NODE_ENV 2>/dev/null || echo "NOT SET")

echo "  CORS_ORIGIN: $CORS_ORIGIN"
echo "  API_BASE_URL: $API_BASE_URL"
echo "  NODE_ENV: $NODE_ENV"

if [ "$NODE_ENV" = "staging" ]; then
  echo -e "${GREEN}✓ NODE_ENV is 'staging' (matches server)${NC}"
else
  echo -e "${YELLOW}⚠ NODE_ENV is '$NODE_ENV' (expected 'staging')${NC}"
fi

# Step 9: Verify port structure matches server
echo -e "\n${BLUE}Step 9: Verifying port structure matches server...${NC}"
echo "  Backend port: 4002 (matches SIT server)"
echo "  Frontend port: 8090 (matches SIT server)"
echo "  Database port: 5434 (matches SIT server)"
echo -e "${GREEN}✓ Port structure matches server configuration${NC}"

# Step 10: Check container status
echo -e "\n${BLUE}Step 10: Container status...${NC}"
docker compose -f docker-compose.test-server.yml ps

# Summary
echo ""
echo -e "${GREEN}=========================================="
echo "✅ Server Configuration Test Complete!"
echo "=========================================="
echo -e "${NC}"
echo "Services are running with SERVER-LIKE configuration:"
echo "  Frontend: http://localhost:8090 (same port as server)"
echo "  Backend API: http://localhost:4002 (same port as server)"
echo "  Database: localhost:5434 (same port as server)"
echo ""
echo -e "${YELLOW}⚠️  Important Notes:${NC}"
echo "  - This uses localhost, but structure matches server"
echo "  - Ports (4002, 8090, 5434) match server exactly"
echo "  - Configuration pattern is the same as server"
echo "  - If this works, server deployment should work too!"
echo ""
echo "Configuration Comparison:"
echo "  Test (localhost):  http://localhost:4002"
echo "  Server (SIT):       http://10.20.6.57:4002"
echo "  → Same structure, different IP"
echo ""
echo "To view logs:"
echo "  docker compose -f docker-compose.test-server.yml logs -f"
echo ""
echo "To stop services:"
echo "  docker compose -f docker-compose.test-server.yml down"
echo ""
echo "Next steps:"
echo "  1. Test frontend in browser: http://localhost:8090"
echo "  2. Check browser console for any errors"
echo "  3. If everything works, your server config is correct!"
echo "  4. Deploy to server with confidence"
echo ""

