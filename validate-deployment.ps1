# Pre-Deployment Validation Script (PowerShell)
# Run this BEFORE pushing to server to ensure configuration is correct
# This validates that docker-compose.sit.yml has correct server settings

Write-Host "🔍 Pre-Deployment Configuration Validation" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$Errors = 0
$Warnings = 0

# Expected SIT Server Configuration
$SIT_SERVER_IP = "10.20.6.57"
$SIT_BACKEND_PORT = "4002"
$SIT_FRONTEND_PORT = "8090"
$SIT_BACKEND_URL = "http://10.20.6.57:4002"
$SIT_FRONTEND_URL = "http://10.20.6.57:8090"

Write-Host "Validating docker-compose.sit.yml..." -ForegroundColor Blue

# Check if file exists
if (-not (Test-Path "docker-compose.sit.yml")) {
    Write-Host "✗ docker-compose.sit.yml not found" -ForegroundColor Red
    exit 1
}

# Read file content
$Content = Get-Content "docker-compose.sit.yml" -Raw

# Extract values using regex
$SIT_API_BASE_URL = if ($Content -match "API_BASE_URL=([^\s]+)") { $matches[1] } else { "" }
$SIT_CORS_ORIGIN = if ($Content -match "CORS_ORIGIN=([^\s]+)") { $matches[1] } else { "" }
$SIT_VITE_API_BASE_URL = if ($Content -match "VITE_API_BASE_URL:\s*([^\s]+)") { $matches[1] } else { "" }
$SIT_NODE_ENV = if ($Content -match "NODE_ENV=([^\s]+)") { $matches[1] } else { "" }

# Extract port mappings
$SIT_BACKEND_PORT_MAPPED = if ($Content -match "backend:[\s\S]*?ports:[\s\S]*?['\`"](\d+):8080") { $matches[1] } else { "" }
$SIT_FRONTEND_PORT_MAPPED = if ($Content -match "frontend:[\s\S]*?ports:[\s\S]*?['\`"](\d+):80") { $matches[1] } else { "" }

Write-Host ""
Write-Host "Found Configuration:" -ForegroundColor Blue
Write-Host "  API_BASE_URL: $SIT_API_BASE_URL"
Write-Host "  CORS_ORIGIN: $SIT_CORS_ORIGIN"
Write-Host "  VITE_API_BASE_URL: $SIT_VITE_API_BASE_URL"
Write-Host "  Backend Port: $SIT_BACKEND_PORT_MAPPED"
Write-Host "  Frontend Port: $SIT_FRONTEND_PORT_MAPPED"
Write-Host ""

# Validate SIT Configuration
Write-Host "Validating SIT Configuration..." -ForegroundColor Blue

# Check API_BASE_URL
if ($SIT_API_BASE_URL -eq $SIT_BACKEND_URL) {
    Write-Host "✓ API_BASE_URL is correct: $SIT_API_BASE_URL" -ForegroundColor Green
} else {
    Write-Host "✗ API_BASE_URL mismatch!" -ForegroundColor Red
    Write-Host "  Expected: $SIT_BACKEND_URL"
    Write-Host "  Found: $SIT_API_BASE_URL"
    $Errors++
}

# Check CORS_ORIGIN
if ($SIT_CORS_ORIGIN -eq $SIT_FRONTEND_URL) {
    Write-Host "✓ CORS_ORIGIN is correct: $SIT_CORS_ORIGIN" -ForegroundColor Green
} else {
    Write-Host "✗ CORS_ORIGIN mismatch!" -ForegroundColor Red
    Write-Host "  Expected: $SIT_FRONTEND_URL"
    Write-Host "  Found: $SIT_CORS_ORIGIN"
    $Errors++
}

# Check VITE_API_BASE_URL
if ($SIT_VITE_API_BASE_URL -eq $SIT_BACKEND_URL) {
    Write-Host "✓ VITE_API_BASE_URL is correct: $SIT_VITE_API_BASE_URL" -ForegroundColor Green
} else {
    Write-Host "✗ VITE_API_BASE_URL mismatch!" -ForegroundColor Red
    Write-Host "  Expected: $SIT_BACKEND_URL"
    Write-Host "  Found: $SIT_VITE_API_BASE_URL"
    $Errors++
}

# Check Backend Port
if ($SIT_BACKEND_PORT_MAPPED -eq $SIT_BACKEND_PORT) {
    Write-Host "✓ Backend port mapping is correct: $SIT_BACKEND_PORT_MAPPED" -ForegroundColor Green
} else {
    Write-Host "✗ Backend port mismatch!" -ForegroundColor Red
    Write-Host "  Expected: $SIT_BACKEND_PORT"
    Write-Host "  Found: $SIT_BACKEND_PORT_MAPPED"
    $Errors++
}

# Check Frontend Port
if ($SIT_FRONTEND_PORT_MAPPED -eq $SIT_FRONTEND_PORT) {
    Write-Host "✓ Frontend port mapping is correct: $SIT_FRONTEND_PORT_MAPPED" -ForegroundColor Green
} else {
    Write-Host "✗ Frontend port mismatch!" -ForegroundColor Red
    Write-Host "  Expected: $SIT_FRONTEND_PORT"
    Write-Host "  Found: $SIT_FRONTEND_PORT_MAPPED"
    $Errors++
}

# Check if IP is in URLs
if ($SIT_API_BASE_URL -like "*$SIT_SERVER_IP*") {
    Write-Host "✓ API_BASE_URL contains correct server IP" -ForegroundColor Green
} else {
    Write-Host "⚠ API_BASE_URL does not contain expected server IP ($SIT_SERVER_IP)" -ForegroundColor Yellow
    $Warnings++
}

if ($SIT_CORS_ORIGIN -like "*$SIT_SERVER_IP*") {
    Write-Host "✓ CORS_ORIGIN contains correct server IP" -ForegroundColor Green
} else {
    Write-Host "⚠ CORS_ORIGIN does not contain expected server IP ($SIT_SERVER_IP)" -ForegroundColor Yellow
    $Warnings++
}

# Check for common mistakes
Write-Host ""
Write-Host "Checking for common mistakes..." -ForegroundColor Blue

# Check for localhost in SIT config
if ($SIT_API_BASE_URL -like "*localhost*") {
    Write-Host "✗ Found 'localhost' in SIT API_BASE_URL! Should use server IP" -ForegroundColor Red
    $Errors++
} else {
    Write-Host "✓ No localhost in SIT API_BASE_URL" -ForegroundColor Green
}

if ($SIT_CORS_ORIGIN -like "*localhost*") {
    Write-Host "✗ Found 'localhost' in SIT CORS_ORIGIN! Should use server IP" -ForegroundColor Red
    $Errors++
} else {
    Write-Host "✓ No localhost in SIT CORS_ORIGIN" -ForegroundColor Green
}

# Check NODE_ENV
if ($SIT_NODE_ENV -eq "staging") {
    Write-Host "✓ NODE_ENV is set to 'staging'" -ForegroundColor Green
} else {
    Write-Host "⚠ NODE_ENV is '$SIT_NODE_ENV' (expected 'staging')" -ForegroundColor Yellow
    $Warnings++
}

# Summary
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
if ($Errors -eq 0 -and $Warnings -eq 0) {
    Write-Host "✅ All validations passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Configuration is ready for deployment."
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "  1. Run: ./test-local-sit.sh (optional - test with SIT config locally)"
    Write-Host "  2. Commit and push your changes"
    Write-Host "  3. SSH to server and deploy"
    exit 0
} elseif ($Errors -eq 0) {
    Write-Host "⚠ Validation passed with $Warnings warning(s)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Configuration is mostly correct, but review warnings above."
    exit 0
} else {
    Write-Host "❌ Validation failed with $Errors error(s) and $Warnings warning(s)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please fix the errors above before deploying."
    Write-Host ""
    Write-Host "Common fixes:"
    Write-Host "  - Update API_BASE_URL to: $SIT_BACKEND_URL"
    Write-Host "  - Update CORS_ORIGIN to: $SIT_FRONTEND_URL"
    Write-Host "  - Update VITE_API_BASE_URL to: $SIT_BACKEND_URL"
    exit 1
}

