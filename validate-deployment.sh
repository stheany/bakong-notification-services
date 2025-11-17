#!/bin/bash
# Pre-Deployment Validation Script
# Run this BEFORE pushing to server to ensure configuration is correct
# This validates that docker-compose.sit.yml has correct server settings

set -e

echo "🔍 Pre-Deployment Configuration Validation"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

# Expected SIT Server Configuration
SIT_SERVER_IP="10.20.6.57"
SIT_BACKEND_PORT="4002"
SIT_FRONTEND_PORT="8090"
SIT_BACKEND_URL="http://10.20.6.57:4002"
SIT_FRONTEND_URL="http://10.20.6.57:8090"

# Expected Production Server Configuration
PROD_SERVER_HOSTNAME="prod-bk-notifi-service"
PROD_SERVER_IP="10.20.6.58"
PROD_BACKEND_PORT="8080"
PROD_FRONTEND_PORT="80"
PROD_BACKEND_URL="https://prod-bk-notifi-service:8080"
PROD_FRONTEND_URL="https://prod-bk-notifi-service"

echo -e "${BLUE}Validating docker-compose.sit.yml...${NC}"

# Check if file exists
if [ ! -f "docker-compose.sit.yml" ]; then
  echo -e "${RED}✗ docker-compose.sit.yml not found${NC}"
  exit 1
fi

# Extract values from docker-compose.sit.yml
SIT_API_BASE_URL=$(grep -A 1 "API_BASE_URL=" docker-compose.sit.yml | grep "API_BASE_URL" | sed 's/.*API_BASE_URL=\(.*\)/\1/' | tr -d ' ')
SIT_CORS_ORIGIN=$(grep -A 1 "CORS_ORIGIN=" docker-compose.sit.yml | grep "CORS_ORIGIN" | sed 's/.*CORS_ORIGIN=\(.*\)/\1/' | tr -d ' ')
SIT_VITE_API_BASE_URL=$(grep -A 2 "VITE_API_BASE_URL:" docker-compose.sit.yml | grep "VITE_API_BASE_URL" | sed 's/.*VITE_API_BASE_URL: \(.*\)/\1/' | tr -d ' ')
SIT_BACKEND_PORT_MAPPED=$(grep -A 1 "backend:" docker-compose.sit.yml -A 10 | grep "ports:" -A 1 | grep -o '[0-9]*:8080' | cut -d: -f1)
SIT_FRONTEND_PORT_MAPPED=$(grep -A 1 "frontend:" docker-compose.sit.yml -A 10 | grep "ports:" -A 1 | grep -o '[0-9]*:80' | cut -d: -f1)

echo ""
echo -e "${BLUE}Found Configuration:${NC}"
echo "  API_BASE_URL: $SIT_API_BASE_URL"
echo "  CORS_ORIGIN: $SIT_CORS_ORIGIN"
echo "  VITE_API_BASE_URL: $SIT_VITE_API_BASE_URL"
echo "  Backend Port: $SIT_BACKEND_PORT_MAPPED"
echo "  Frontend Port: $SIT_FRONTEND_PORT_MAPPED"
echo ""

# Validate SIT Configuration
echo -e "${BLUE}Validating SIT Configuration...${NC}"

# Check API_BASE_URL
if [ "$SIT_API_BASE_URL" = "$SIT_BACKEND_URL" ]; then
  echo -e "${GREEN}✓ API_BASE_URL is correct: $SIT_API_BASE_URL${NC}"
else
  echo -e "${RED}✗ API_BASE_URL mismatch!${NC}"
  echo "  Expected: $SIT_BACKEND_URL"
  echo "  Found: $SIT_API_BASE_URL"
  ERRORS=$((ERRORS + 1))
fi

# Check CORS_ORIGIN
if [ "$SIT_CORS_ORIGIN" = "$SIT_FRONTEND_URL" ]; then
  echo -e "${GREEN}✓ CORS_ORIGIN is correct: $SIT_CORS_ORIGIN${NC}"
else
  echo -e "${RED}✗ CORS_ORIGIN mismatch!${NC}"
  echo "  Expected: $SIT_FRONTEND_URL"
  echo "  Found: $SIT_CORS_ORIGIN"
  ERRORS=$((ERRORS + 1))
fi

# Check VITE_API_BASE_URL
if [ "$SIT_VITE_API_BASE_URL" = "$SIT_BACKEND_URL" ]; then
  echo -e "${GREEN}✓ VITE_API_BASE_URL is correct: $SIT_VITE_API_BASE_URL${NC}"
else
  echo -e "${RED}✗ VITE_API_BASE_URL mismatch!${NC}"
  echo "  Expected: $SIT_BACKEND_URL"
  echo "  Found: $SIT_VITE_API_BASE_URL"
  ERRORS=$((ERRORS + 1))
fi

# Check Backend Port
if [ "$SIT_BACKEND_PORT_MAPPED" = "$SIT_BACKEND_PORT" ]; then
  echo -e "${GREEN}✓ Backend port mapping is correct: $SIT_BACKEND_PORT_MAPPED${NC}"
else
  echo -e "${RED}✗ Backend port mismatch!${NC}"
  echo "  Expected: $SIT_BACKEND_PORT"
  echo "  Found: $SIT_BACKEND_PORT_MAPPED"
  ERRORS=$((ERRORS + 1))
fi

# Check Frontend Port
if [ "$SIT_FRONTEND_PORT_MAPPED" = "$SIT_FRONTEND_PORT" ]; then
  echo -e "${GREEN}✓ Frontend port mapping is correct: $SIT_FRONTEND_PORT_MAPPED${NC}"
else
  echo -e "${RED}✗ Frontend port mismatch!${NC}"
  echo "  Expected: $SIT_FRONTEND_PORT"
  echo "  Found: $SIT_FRONTEND_PORT_MAPPED"
  ERRORS=$((ERRORS + 1))
fi

# Check if IP is in URLs
if echo "$SIT_API_BASE_URL" | grep -q "$SIT_SERVER_IP"; then
  echo -e "${GREEN}✓ API_BASE_URL contains correct server IP${NC}"
else
  echo -e "${YELLOW}⚠ API_BASE_URL does not contain expected server IP ($SIT_SERVER_IP)${NC}"
  WARNINGS=$((WARNINGS + 1))
fi

if echo "$SIT_CORS_ORIGIN" | grep -q "$SIT_SERVER_IP"; then
  echo -e "${GREEN}✓ CORS_ORIGIN contains correct server IP${NC}"
else
  echo -e "${YELLOW}⚠ CORS_ORIGIN does not contain expected server IP ($SIT_SERVER_IP)${NC}"
  WARNINGS=$((WARNINGS + 1))
fi

# Validate Production Configuration (if file exists)
if [ -f "docker-compose.production.yml" ]; then
  echo ""
  echo -e "${BLUE}Validating docker-compose.production.yml...${NC}"
  
  PROD_API_BASE_URL=$(grep -A 1 "API_BASE_URL=" docker-compose.production.yml | grep "API_BASE_URL" | sed 's/.*API_BASE_URL=\(.*\)/\1/' | tr -d ' ')
  PROD_CORS_ORIGIN=$(grep -A 1 "CORS_ORIGIN=" docker-compose.production.yml | grep "CORS_ORIGIN" | sed 's/.*CORS_ORIGIN=\(.*\)/\1/' | tr -d ' ')
  
  # Check if production uses HTTPS
  if echo "$PROD_API_BASE_URL" | grep -q "https://"; then
    echo -e "${GREEN}✓ Production API_BASE_URL uses HTTPS${NC}"
  else
    echo -e "${YELLOW}⚠ Production API_BASE_URL should use HTTPS${NC}"
    WARNINGS=$((WARNINGS + 1))
  fi
  
  if echo "$PROD_CORS_ORIGIN" | grep -q "https://"; then
    echo -e "${GREEN}✓ Production CORS_ORIGIN uses HTTPS${NC}"
  else
    echo -e "${YELLOW}⚠ Production CORS_ORIGIN should use HTTPS${NC}"
    WARNINGS=$((WARNINGS + 1))
  fi
fi

# Check for common mistakes
echo ""
echo -e "${BLUE}Checking for common mistakes...${NC}"

# Check for localhost in SIT config
if echo "$SIT_API_BASE_URL" | grep -q "localhost"; then
  echo -e "${RED}✗ Found 'localhost' in SIT API_BASE_URL! Should use server IP${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✓ No localhost in SIT API_BASE_URL${NC}"
fi

if echo "$SIT_CORS_ORIGIN" | grep -q "localhost"; then
  echo -e "${RED}✗ Found 'localhost' in SIT CORS_ORIGIN! Should use server IP${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✓ No localhost in SIT CORS_ORIGIN${NC}"
fi

# Check NODE_ENV
SIT_NODE_ENV=$(grep -A 1 "NODE_ENV=" docker-compose.sit.yml | grep "NODE_ENV" | sed 's/.*NODE_ENV=\(.*\)/\1/' | tr -d ' ')
if [ "$SIT_NODE_ENV" = "staging" ]; then
  echo -e "${GREEN}✓ NODE_ENV is set to 'staging'${NC}"
else
  echo -e "${YELLOW}⚠ NODE_ENV is '$SIT_NODE_ENV' (expected 'staging')${NC}"
  WARNINGS=$((WARNINGS + 1))
fi

# Summary
echo ""
echo "=========================================="
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}✅ All validations passed!${NC}"
  echo ""
  echo "Configuration is ready for deployment."
  echo ""
  echo "Next steps:"
  echo "  1. Run: ./test-local-sit.sh (optional - test with SIT config locally)"
  echo "  2. Commit and push your changes"
  echo "  3. SSH to server and deploy"
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo -e "${YELLOW}⚠ Validation passed with $WARNINGS warning(s)${NC}"
  echo ""
  echo "Configuration is mostly correct, but review warnings above."
  exit 0
else
  echo -e "${RED}❌ Validation failed with $ERRORS error(s) and $WARNINGS warning(s)${NC}"
  echo ""
  echo "Please fix the errors above before deploying."
  echo ""
  echo "Common fixes:"
  echo "  - Update API_BASE_URL to: $SIT_BACKEND_URL"
  echo "  - Update CORS_ORIGIN to: $SIT_FRONTEND_URL"
  echo "  - Update VITE_API_BASE_URL to: $SIT_BACKEND_URL"
  exit 1
fi

