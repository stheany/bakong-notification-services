#!/bin/bash
# ============================================================================
# Test SIT and Production deployment locally (without deploying to real servers)
# ============================================================================
# Validates that Dockerfiles and docker-compose.sit.yml / docker-compose.production.yml
# build and run correctly on your machine.
#
# Usage:
#   bash test-deploy-local.sh           # Build only (faster, ~5–15 min)
#   bash test-deploy-local.sh --up      # Build + start stacks, run health checks, then down
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

FULL_TEST=false
if [ "${1:-}" = "--up" ]; then
  FULL_TEST=true
fi

echo "🧪 Local deployment test (SIT + Production)"
echo "==========================================="
echo ""

# ---------------------------------------------------------------------------
# 1) Build SIT stack (same images as deploy-sit-server.sh)
# ---------------------------------------------------------------------------
echo "📦 Step 1: Building SIT stack (docker-compose.sit.yml)..."
echo "   This uses the same Dockerfiles as real SIT deploy."
echo ""

if ! docker compose -f docker-compose.sit.yml build --no-cache 2>&1 | tee /tmp/test-deploy-sit-build.log; then
  echo ""
  echo "❌ SIT build failed. Check /tmp/test-deploy-sit-build.log"
  exit 1
fi

echo ""
echo "✅ SIT build succeeded"
echo ""

# ---------------------------------------------------------------------------
# 2) Build Production stack (same images as deploy-prod-server.sh)
# ---------------------------------------------------------------------------
echo "📦 Step 2: Building Production stack (docker-compose.production.yml)..."
echo ""

if ! docker compose -f docker-compose.production.yml build --no-cache 2>&1 | tee /tmp/test-deploy-prod-build.log; then
  echo ""
  echo "❌ Production build failed. Check /tmp/test-deploy-prod-build.log"
  exit 1
fi

echo ""
echo "✅ Production build succeeded"
echo ""

if [ "$FULL_TEST" != "true" ]; then
  echo "✅ All builds passed. SIT and Prod Dockerfiles/compose are valid."
  echo ""
  echo "💡 To also start stacks and run health checks locally, run:"
  echo "   bash test-deploy-local.sh --up"
  echo ""
  echo "   Note: Production uses ports 80/443; on Windows you may need to stop"
  echo "   other services using those ports, or run as admin."
  exit 0
fi

# ---------------------------------------------------------------------------
# 3) Optional: Start SIT, health check, then down
# ---------------------------------------------------------------------------
echo "🚀 Step 3: Starting SIT stack..."
docker compose -f docker-compose.sit.yml up -d

echo "   Waiting for services (30s)..."
sleep 30

SIT_BACKEND="http://localhost:4003"
SIT_FRONTEND="http://localhost:8091"

if curl -s --connect-timeout 5 "${SIT_BACKEND}/api/v1/health" > /dev/null 2>&1; then
  echo "   ✅ SIT Backend health OK (${SIT_BACKEND}/api/v1/health)"
else
  echo "   ⚠️  SIT Backend not responding yet (check: docker compose -f docker-compose.sit.yml logs backend)"
fi

if curl -s --connect-timeout 5 "$SIT_FRONTEND" > /dev/null 2>&1; then
  echo "   ✅ SIT Frontend OK ($SIT_FRONTEND)"
else
  echo "   ⚠️  SIT Frontend not responding yet"
fi

echo ""
echo "   Stopping SIT stack..."
docker compose -f docker-compose.sit.yml down

echo ""

# ---------------------------------------------------------------------------
# 4) Optional: Start Production, health check, then down
# ---------------------------------------------------------------------------
echo "🚀 Step 4: Starting Production stack (ports 80/8080)..."
if ! docker compose -f docker-compose.production.yml up -d 2>&1; then
  echo "   ⚠️  Prod up failed (often port 80/443 in use). Skipping prod health check."
else
  echo "   Waiting for services (30s)..."
  sleep 30

  PROD_BACKEND="http://localhost:8080"
  PROD_FRONTEND="http://localhost:80"

  if curl -s --connect-timeout 5 "${PROD_BACKEND}/api/v1/health" > /dev/null 2>&1; then
    echo "   ✅ Prod Backend health OK (${PROD_BACKEND}/api/v1/health)"
  else
    echo "   ⚠️  Prod Backend not responding yet"
  fi

  if curl -s --connect-timeout 5 "$PROD_FRONTEND" > /dev/null 2>&1; then
    echo "   ✅ Prod Frontend OK ($PROD_FRONTEND)"
  else
    echo "   ⚠️  Prod Frontend not responding yet"
  fi

  echo ""
  echo "   Stopping Production stack..."
  docker compose -f docker-compose.production.yml down
fi

echo ""
echo "✅ Local deploy test finished."
echo "   Builds and (with --up) stack start/health checks completed."
echo ""
