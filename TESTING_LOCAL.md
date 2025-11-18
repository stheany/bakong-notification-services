# Testing Authentication Fix Locally

This guide shows how to test the API key authentication fix for mobile apps locally.

## Prerequisites

1. **Start the Backend Server**
   ```bash
   cd apps/backend
   npm run dev
   ```
   
   The server will start on port `4002` by default (or check your `env.development` file).

2. **API Key Configuration**
   - Default API key: `BAKONG` (if not set in environment)
   - To set custom key: Add `API_MOBILE_KEY=your-key-here` to `env.development` file

## Testing Endpoints

### 1. Test Flash Notification Send (POST /api/v1/notification/send)

**✅ Success Case - With Valid API Key (No JWT needed)**

```bash
curl -X POST http://localhost:4002/api/v1/notification/send \
  -H "Content-Type: application/json" \
  -H "x-api-key: BAKONG" \
  -d '{
    "accountId": "mrr_thy@bkrt",
    "language": "en"
  }'
```

**Expected Response:** Should return success (200) with notification data, NOT 401 error.

**❌ Failure Case - Without API Key**

```bash
curl -X POST http://localhost:4002/api/v1/notification/send \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "mrr_thy@bkrt",
    "language": "en"
  }'
```

**Expected Response:** 401 error - "Authentication failed. Please login again."

**❌ Failure Case - With Invalid API Key**

```bash
curl -X POST http://localhost:4002/api/v1/notification/send \
  -H "Content-Type: application/json" \
  -H "x-api-key: INVALID_KEY" \
  -d '{
    "accountId": "mrr_thy@bkrt",
    "language": "en"
  }'
```

**Expected Response:** 401 error - "Authentication failed. Please login again."

---

### 2. Test Notification Inbox (POST /api/v1/notification/inbox)

**✅ Success Case - With Valid API Key (No JWT needed)**

```bash
curl -X POST http://localhost:4002/api/v1/notification/inbox \
  -H "Content-Type: application/json" \
  -H "x-api-key: BAKONG" \
  -d '{
    "accountId": "mrr_thy@bkrt",
    "fcmToken": "test-fcm-token-123",
    "language": "en",
    "page": 1,
    "size": 10
  }'
```

**Expected Response:** Should return success (200) with notification inbox data, NOT 401 error.

**❌ Failure Case - Without API Key**

```bash
curl -X POST http://localhost:4002/api/v1/notification/inbox \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "mrr_thy@bkrt",
    "fcmToken": "test-fcm-token-123",
    "language": "en"
  }'
```

**Expected Response:** 401 error - "Authentication failed. Please login again."

---

## Testing with Postman

1. **Create a new request**
   - Method: `POST`
   - URL: `http://localhost:4002/api/v1/notification/send`

2. **Add Headers**
   - `Content-Type`: `application/json`
   - `x-api-key`: `BAKONG`

3. **Add Body (raw JSON)**
   ```json
   {
     "accountId": "mrr_thy@bkrt",
     "language": "en"
   }
   ```

4. **Send Request**
   - Should return 200 OK (not 401)

---

## Testing with JavaScript/Fetch

```javascript
// Test Flash Notification Send
fetch('http://localhost:4002/api/v1/notification/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'BAKONG'  // API key - no JWT token needed!
  },
  body: JSON.stringify({
    accountId: 'mrr_thy@bkrt',
    language: 'en'
  })
})
.then(response => response.json())
.then(data => {
  console.log('Success:', data);
  // Should NOT have errorCode: 5 (FAILED_AUTHENTICATION)
})
.catch(error => {
  console.error('Error:', error);
});
```

---

## What to Verify

✅ **Before Fix (Should Fail):**
- Request with only `x-api-key` header → 401 error
- Error message: "Authentication failed. Please login again."
- Error code: 5 (FAILED_AUTHENTICATION)

✅ **After Fix (Should Succeed):**
- Request with only `x-api-key` header → 200 OK
- No authentication errors
- Notification data returned successfully

---

## Troubleshooting

1. **Server not starting?**
   - Check if database is running
   - Check if port 4002 is available
   - Verify `env.development` file exists

2. **Still getting 401?**
   - Verify API key matches: `BAKONG` (or your custom key)
   - Check header name is exactly `x-api-key` (case-sensitive)
   - Check server logs for authentication errors

3. **Account not found?**
   - Make sure `accountId` exists in database
   - This is expected - the endpoint validates accountId exists

---

## Environment Variables

If you need to set a custom API key, create/update `apps/backend/env.development`:

```env
API_MOBILE_KEY=your-custom-key-here
API_PORT=4002
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=bkns
POSTGRES_USER=bkns
POSTGRES_PASSWORD=dev
```

