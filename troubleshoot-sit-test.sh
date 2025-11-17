#!/bin/bash
# Troubleshooting helper for test-local-sit.sh errors

echo "🔍 Troubleshooting SIT Test Script"
echo "===================================="
echo ""

# Check if script exists
if [ ! -f "test-local-sit.sh" ]; then
  echo "❌ Error: test-local-sit.sh not found"
  exit 1
fi

# Check if script is executable
if [ ! -x "test-local-sit.sh" ]; then
  echo "⚠️  Making script executable..."
  chmod +x test-local-sit.sh
fi

# Check Docker
echo "1. Checking Docker..."
if ! command -v docker &> /dev/null; then
  echo "   ❌ Docker not found. Please install Docker Desktop."
  exit 1
else
  echo "   ✓ Docker found: $(docker --version)"
fi

# Check Docker Compose
echo "2. Checking Docker Compose..."
if ! docker compose version &> /dev/null; then
  echo "   ❌ Docker Compose not found or not working"
  exit 1
else
  echo "   ✓ Docker Compose found: $(docker compose version | head -1)"
fi

# Check if Docker is running
echo "3. Checking if Docker is running..."
if ! docker ps &> /dev/null; then
  echo "   ❌ Docker is not running. Please start Docker Desktop."
  exit 1
else
  echo "   ✓ Docker is running"
fi

# Check docker-compose.sit.yml
echo "4. Checking docker-compose.sit.yml..."
if [ ! -f "docker-compose.sit.yml" ]; then
  echo "   ❌ docker-compose.sit.yml not found"
  exit 1
else
  echo "   ✓ docker-compose.sit.yml exists"
fi

# Check for required files
echo "5. Checking required files..."
REQUIRED_FILES=(
  "apps/backend/Dockerfile"
  "apps/frontend/Dockerfile"
  "apps/backend/init-db.sql"
  "firebase-service-account.json"
)

MISSING_FILES=()
for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    MISSING_FILES+=("$file")
  fi
done

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
  echo "   ❌ Missing required files:"
  for file in "${MISSING_FILES[@]}"; do
    echo "      - $file"
  done
  exit 1
else
  echo "   ✓ All required files exist"
fi

# Check port availability
echo "6. Checking port availability..."
PORTS=(4002 8090 5434)
PORT_CONFLICTS=()

for port in "${PORTS[@]}"; do
  if netstat -an 2>/dev/null | grep -q ":$port " || \
     ss -an 2>/dev/null | grep -q ":$port " || \
     (command -v lsof &> /dev/null && lsof -i :$port &> /dev/null); then
    PORT_CONFLICTS+=("$port")
  fi
done

if [ ${#PORT_CONFLICTS[@]} -gt 0 ]; then
  echo "   ⚠️  Ports in use (may cause conflicts):"
  for port in "${PORT_CONFLICTS[@]}"; do
    echo "      - Port $port"
  done
  echo "   💡 Stop other services using these ports or change them in docker-compose.sit.yml"
else
  echo "   ✓ All required ports are available"
fi

# Check disk space
echo "7. Checking disk space..."
if command -v df &> /dev/null; then
  DISK_USAGE=$(df -h . | tail -1 | awk '{print $5}' | sed 's/%//')
  if [ "$DISK_USAGE" -gt 90 ]; then
    echo "   ⚠️  Low disk space: ${DISK_USAGE}% used"
  else
    echo "   ✓ Disk space OK: ${DISK_USAGE}% used"
  fi
else
  echo "   ⚠️  Cannot check disk space (df not available)"
fi

echo ""
echo "✅ Basic checks complete!"
echo ""
echo "If all checks passed, try running the test script:"
echo "  ./test-local-sit.sh"
echo ""
echo "If you still get errors, please share:"
echo "  1. The exact error message"
echo "  2. The command you ran"
echo "  3. Output of: docker compose -f docker-compose.sit.yml ps"
echo "  4. Output of: docker compose -f docker-compose.sit.yml logs"

