# PowerShell Test script for API Key Authentication
# Usage: .\test-api-key-auth.ps1 [API_URL] [API_KEY]

param(
    [string]$ApiUrl = "http://localhost:4002",
    [string]$ApiKey = "BAKONG"
)

Write-Host "🧪 Testing API Key Authentication" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "API URL: $ApiUrl"
Write-Host "API Key: $ApiKey"
Write-Host ""

# Test 1: Flash Notification Send - WITH API KEY (Should succeed)
Write-Host "Test 1: POST /notification/send WITH API KEY" -ForegroundColor Yellow
Write-Host "--------------------------------------------" -ForegroundColor Yellow

$body = @{
    accountId = "mrr_thy@bkrt"
    language = "en"
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
    "x-api-key" = $ApiKey
}

try {
    $response = Invoke-RestMethod -Uri "$ApiUrl/api/v1/notification/send" `
        -Method Post `
        -Headers $headers `
        -Body $body `
        -StatusCodeVariable statusCode
    
    if ($statusCode -eq 200) {
        Write-Host "✅ PASS: Got 200 OK" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Got HTTP $statusCode" -ForegroundColor Yellow
        Write-Host "Response: $($response | ConvertTo-Json -Depth 3)"
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401) {
        Write-Host "❌ FAIL: Got 401 Unauthorized (authentication still failing)" -ForegroundColor Red
        Write-Host "Response: $($_.Exception.Message)"
    } else {
        Write-Host "⚠️  Got HTTP $statusCode" -ForegroundColor Yellow
        Write-Host "Error: $($_.Exception.Message)"
    }
}
Write-Host ""

# Test 2: Flash Notification Send - WITHOUT API KEY (Should fail)
Write-Host "Test 2: POST /notification/send WITHOUT API KEY" -ForegroundColor Yellow
Write-Host "-------------------------------------------------" -ForegroundColor Yellow

$headersNoKey = @{
    "Content-Type" = "application/json"
}

try {
    $response = Invoke-RestMethod -Uri "$ApiUrl/api/v1/notification/send" `
        -Method Post `
        -Headers $headersNoKey `
        -Body $body `
        -StatusCodeVariable statusCode
    
    Write-Host "⚠️  Expected 401, got HTTP $statusCode" -ForegroundColor Yellow
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401) {
        Write-Host "✅ PASS: Got 401 as expected (API key required)" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Expected 401, got HTTP $statusCode" -ForegroundColor Yellow
    }
}
Write-Host ""

# Test 3: Notification Inbox - WITH API KEY (Should succeed)
Write-Host "Test 3: POST /notification/inbox WITH API KEY" -ForegroundColor Yellow
Write-Host "-----------------------------------------------" -ForegroundColor Yellow

$inboxBody = @{
    accountId = "mrr_thy@bkrt"
    fcmToken = "test-fcm-token-123"
    language = "en"
    page = 1
    size = 10
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$ApiUrl/api/v1/notification/inbox" `
        -Method Post `
        -Headers $headers `
        -Body $inboxBody `
        -StatusCodeVariable statusCode
    
    if ($statusCode -eq 200) {
        Write-Host "✅ PASS: Got 200 OK" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Got HTTP $statusCode" -ForegroundColor Yellow
        Write-Host "Response: $($response | ConvertTo-Json -Depth 3)"
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401) {
        Write-Host "❌ FAIL: Got 401 Unauthorized (authentication still failing)" -ForegroundColor Red
        Write-Host "Response: $($_.Exception.Message)"
    } else {
        Write-Host "⚠️  Got HTTP $statusCode" -ForegroundColor Yellow
        Write-Host "Error: $($_.Exception.Message)"
    }
}
Write-Host ""

# Test 4: Notification Inbox - WITHOUT API KEY (Should fail)
Write-Host "Test 4: POST /notification/inbox WITHOUT API KEY" -ForegroundColor Yellow
Write-Host "-------------------------------------------------" -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "$ApiUrl/api/v1/notification/inbox" `
        -Method Post `
        -Headers $headersNoKey `
        -Body $inboxBody `
        -StatusCodeVariable statusCode
    
    Write-Host "⚠️  Expected 401, got HTTP $statusCode" -ForegroundColor Yellow
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401) {
        Write-Host "✅ PASS: Got 401 as expected (API key required)" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Expected 401, got HTTP $statusCode" -ForegroundColor Yellow
    }
}
Write-Host ""

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "✅ Testing Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:"
Write-Host "- Tests 1 & 3 should return 200 (with API key)"
Write-Host "- Tests 2 & 4 should return 401 (without API key)"
Write-Host ""
Write-Host "If Test 1 or 3 returns 401, the fix may not be working correctly." -ForegroundColor Yellow

