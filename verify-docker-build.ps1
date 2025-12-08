# Quick script to verify Docker is using latest code
Write-Host "🔍 Checking Docker Build Status..." -ForegroundColor Cyan
Write-Host ""

# Check image build time
Write-Host "📦 Backend Image Build Time:" -ForegroundColor Yellow
docker images bakong-notification-services-backend --format "table {{.Repository}}\t{{.Tag}}\t{{.CreatedAt}}" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ⚠️  Image not found - need to build first" -ForegroundColor Red
}

Write-Host ""
Write-Host "🐳 Container Status:" -ForegroundColor Yellow
docker-compose -f docker-compose.sit.yml ps backend 2>$null

Write-Host ""
Write-Host "📝 To rebuild with latest code, run:" -ForegroundColor Green
Write-Host "   docker-compose -f docker-compose.sit.yml build --no-cache backend" -ForegroundColor White
Write-Host "   docker-compose -f docker-compose.sit.yml up -d backend" -ForegroundColor White

Write-Host ""
Write-Host "📋 To check files in container (after starting):" -ForegroundColor Green
Write-Host "   docker exec bakong-notification-services-api-sit ls -la /opt/bk_notification_service/dist/modules/notification/" -ForegroundColor White

