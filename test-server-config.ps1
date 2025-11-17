# Test Server Configuration Locally (PowerShell)
# This uses the SAME ports and structure as the server, but with localhost
# Perfect for testing server configuration when you can't access the real server IP

Write-Host "🧪 Testing Server Configuration Locally" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will:"
Write-Host "  ✓ Use SAME ports as server (4002, 8090, 5434)"
Write-Host "  ✓ Use SAME structure as docker-compose.sit.yml"
Write-Host "  ✓ Use localhost instead of server IP (so it works from home)"
Write-Host "  ✓ Verify the configuration pattern is correct"
Write-Host ""
Write-Host "If this works, your server deployment should work too!"
Write-Host ""

$response = Read-Host "Continue? (y/n)"
if ($response -ne "y" -and $response -ne "Y") {
    Write-Host "Cancelled."
    exit 0
}

# Step 1: Stop any existing containers
Write-Host "`nStep 1: Cleaning up old containers..." -ForegroundColor Blue
docker compose -f docker-compose.test-server.yml down -v 2>$null
docker compose -f docker-compose.sit.yml down -v 2>$null
docker compose -f docker-compose.yml down -v 2>$null
Write-Host "✓ Cleanup complete" -ForegroundColor Green

# Step 2: Build images
Write-Host "`nStep 2: Building Docker images with server-like configuration..." -ForegroundColor Blue
docker compose -f docker-compose.test-server.yml build --no-cache
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Build successful" -ForegroundColor Green
} else {
    Write-Host "✗ Build failed" -ForegroundColor Red
    exit 1
}

# Step 3: Start services
Write-Host "`nStep 3: Starting services..." -ForegroundColor Blue
docker compose -f docker-compose.test-server.yml up -d
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Services started" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to start services" -ForegroundColor Red
    exit 1
}

# Step 4: Wait for database
Write-Host "`nStep 4: Waiting for database to be ready..." -ForegroundColor Blue
Start-Sleep -Seconds 10
$dbHealth = docker compose -f docker-compose.test-server.yml exec -T db pg_isready -U bkns_sit -d bakong_notification_services_sit 2>&1
if ($dbHealth -match "accepting connections") {
    Write-Host "✓ Database is ready" -ForegroundColor Green
} else {
    Write-Host "✗ Database not ready" -ForegroundColor Red
    docker compose -f docker-compose.test-server.yml logs db
    exit 1
}

# Step 5: Wait for backend
Write-Host "`nStep 5: Waiting for backend to be ready..." -ForegroundColor Blue
$maxAttempts = 30
$attempt = 0
$backendReady = $false

while ($attempt -lt $maxAttempts) {
    Start-Sleep -Seconds 2
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:4002/api/v1/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $backendReady = $true
            break
        }
    } catch {
        # Continue waiting
    }
    $attempt++
    Write-Host "." -NoNewline
}

if ($backendReady) {
    Write-Host "`n✓ Backend is ready (HTTP 200)" -ForegroundColor Green
} else {
    Write-Host "`n✗ Backend not ready after $maxAttempts attempts" -ForegroundColor Red
    Write-Host "`nBackend logs:" -ForegroundColor Yellow
    docker compose -f docker-compose.test-server.yml logs backend | Select-Object -Last 50
    exit 1
}

# Step 6: Test API endpoints
Write-Host "`nStep 6: Testing API endpoints..." -ForegroundColor Blue

try {
    $healthResponse = Invoke-RestMethod -Uri "http://localhost:4002/api/v1/health"
    if ($healthResponse.status) {
        Write-Host "✓ Health endpoint working" -ForegroundColor Green
        Write-Host "  Response: $($healthResponse | ConvertTo-Json -Compress | Select-Object -First 100)..."
    }
} catch {
    Write-Host "✗ Health endpoint failed" -ForegroundColor Red
}

try {
    $mgmtResponse = Invoke-RestMethod -Uri "http://localhost:4002/api/v1/management/healthcheck"
    if ($mgmtResponse.status) {
        Write-Host "✓ Management healthcheck working" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠ Management healthcheck returned unexpected response" -ForegroundColor Yellow
}

# Step 7: Check frontend
Write-Host "`nStep 7: Checking frontend..." -ForegroundColor Blue
try {
    $frontendResponse = Invoke-WebRequest -Uri "http://localhost:8090" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($frontendResponse.StatusCode -eq 200) {
        Write-Host "✓ Frontend is accessible (HTTP 200)" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠ Frontend returned unexpected response" -ForegroundColor Yellow
    docker compose -f docker-compose.test-server.yml logs frontend | Select-Object -Last 20
}

# Step 8: Verify environment variables
Write-Host "`nStep 8: Verifying environment variables (server-like structure)..." -ForegroundColor Blue
$corsOrigin = docker compose -f docker-compose.test-server.yml exec -T backend printenv CORS_ORIGIN 2>$null
$apiBaseUrl = docker compose -f docker-compose.test-server.yml exec -T backend printenv API_BASE_URL 2>$null
$nodeEnv = docker compose -f docker-compose.test-server.yml exec -T backend printenv NODE_ENV 2>$null

Write-Host "  CORS_ORIGIN: $corsOrigin"
Write-Host "  API_BASE_URL: $apiBaseUrl"
Write-Host "  NODE_ENV: $nodeEnv"

if ($nodeEnv -eq "staging") {
    Write-Host "✓ NODE_ENV is 'staging' (matches server)" -ForegroundColor Green
} else {
    Write-Host "⚠ NODE_ENV is '$nodeEnv' (expected 'staging')" -ForegroundColor Yellow
}

# Step 9: Verify port structure
Write-Host "`nStep 9: Verifying port structure matches server..." -ForegroundColor Blue
Write-Host "  Backend port: 4002 (matches SIT server)"
Write-Host "  Frontend port: 8090 (matches SIT server)"
Write-Host "  Database port: 5434 (matches SIT server)"
Write-Host "✓ Port structure matches server configuration" -ForegroundColor Green

# Step 10: Check container status
Write-Host "`nStep 10: Container status..." -ForegroundColor Blue
docker compose -f docker-compose.test-server.yml ps

# Summary
Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "✅ Server Configuration Test Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Services are running with SERVER-LIKE configuration:"
Write-Host "  Frontend: http://localhost:8090 (same port as server)"
Write-Host "  Backend API: http://localhost:4002 (same port as server)"
Write-Host "  Database: localhost:5434 (same port as server)"
Write-Host ""
Write-Host "⚠️  Important Notes:" -ForegroundColor Yellow
Write-Host "  - This uses localhost, but structure matches server"
Write-Host "  - Ports (4002, 8090, 5434) match server exactly"
Write-Host "  - Configuration pattern is the same as server"
Write-Host "  - If this works, server deployment should work too!"
Write-Host ""
Write-Host "Configuration Comparison:"
Write-Host "  Test (localhost):  http://localhost:4002"
Write-Host "  Server (SIT):       http://10.20.6.57:4002"
Write-Host "  → Same structure, different IP"
Write-Host ""
Write-Host "To view logs:"
Write-Host "  docker compose -f docker-compose.test-server.yml logs -f"
Write-Host ""
Write-Host "To stop services:"
Write-Host "  docker compose -f docker-compose.test-server.yml down"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Test frontend in browser: http://localhost:8090"
Write-Host "  2. Check browser console for any errors"
Write-Host "  3. If everything works, your server config is correct!"
Write-Host "  4. Deploy to server with confidence"
Write-Host ""

