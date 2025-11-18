#!/bin/bash

# Test script for API Key Authentication
# Usage: ./test-api-key-auth.sh [API_URL] [API_KEY]

API_URL="${1:-http://localhost:4002}"
API_KEY="${2:-BAKONG}"

echo "🧪 Testing API Key Authentication"
echo "=================================="
echo "API URL: $API_URL"
echo "API Key: $API_KEY"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Flash Notification Send - WITH API KEY (Should succeed)
echo "Test 1: POST /notification/send WITH API KEY"
echo "--------------------------------------------"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$API_URL/api/v1/notification/send" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "accountId": "mrr_thy@bkrt",
    "language": "en"
  }')

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ PASS: Got 200 OK${NC}"
elif [ "$HTTP_STATUS" = "401" ]; then
  echo -e "${RED}❌ FAIL: Got 401 Unauthorized (authentication still failing)${NC}"
  echo "Response: $BODY"
else
  echo -e "${YELLOW}⚠️  Got HTTP $HTTP_STATUS${NC}"
  echo "Response: $BODY"
fi
echo ""

# Test 2: Flash Notification Send - WITHOUT API KEY (Should fail)
echo "Test 2: POST /notification/send WITHOUT API KEY"
echo "-------------------------------------------------"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$API_URL/api/v1/notification/send" \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "mrr_thy@bkrt",
    "language": "en"
  }')

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "401" ]; then
  echo -e "${GREEN}✅ PASS: Got 401 as expected (API key required)${NC}"
else
  echo -e "${YELLOW}⚠️  Expected 401, got HTTP $HTTP_STATUS${NC}"
  echo "Response: $BODY"
fi
echo ""

# Test 3: Notification Inbox - WITH API KEY (Should succeed)
echo "Test 3: POST /notification/inbox WITH API KEY"
echo "-----------------------------------------------"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$API_URL/api/v1/notification/inbox" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "accountId": "mrr_thy@bkrt",
    "fcmToken": "test-fcm-token-123",
    "language": "en",
    "page": 1,
    "size": 10
  }')

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ PASS: Got 200 OK${NC}"
elif [ "$HTTP_STATUS" = "401" ]; then
  echo -e "${RED}❌ FAIL: Got 401 Unauthorized (authentication still failing)${NC}"
  echo "Response: $BODY"
else
  echo -e "${YELLOW}⚠️  Got HTTP $HTTP_STATUS${NC}"
  echo "Response: $BODY"
fi
echo ""

# Test 4: Notification Inbox - WITHOUT API KEY (Should fail)
echo "Test 4: POST /notification/inbox WITHOUT API KEY"
echo "-------------------------------------------------"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$API_URL/api/v1/notification/inbox" \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "mrr_thy@bkrt",
    "fcmToken": "test-fcm-token-123",
    "language": "en"
  }')

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "401" ]; then
  echo -e "${GREEN}✅ PASS: Got 401 as expected (API key required)${NC}"
else
  echo -e "${YELLOW}⚠️  Expected 401, got HTTP $HTTP_STATUS${NC}"
  echo "Response: $BODY"
fi
echo ""

echo "=================================="
echo "✅ Testing Complete!"
echo ""
echo "Summary:"
echo "- Tests 1 & 3 should return 200 (with API key)"
echo "- Tests 2 & 4 should return 401 (without API key)"
echo ""
echo "If Test 1 or 3 returns 401, the fix may not be working correctly."

