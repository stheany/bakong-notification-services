#!/bin/bash
# Quick fix and deploy script for SIT server
# This script updates the Dockerfile and rebuilds the containers

set -e  # Exit on error

echo "🔧 Fixing Dockerfile and rebuilding containers..."

cd ~/bakong-notification-services || cd /home/dev/bakong-notification-services

# Pull latest changes (if using git)
echo "📥 Pulling latest changes..."
git pull origin develop || echo "⚠️  Git pull failed or not in git repo, continuing..."

# Verify Dockerfile has the fix
echo "🔍 Checking Dockerfile..."
if grep -q "npx --yes tsc" apps/backend/Dockerfile; then
    echo "✅ Dockerfile already has the fix"
else
    echo "🔨 Updating Dockerfile..."
    sed -i 's|RUN tsc -p tsconfig.json && tsc-alias -p tsconfig.json|RUN npx --yes tsc -p tsconfig.json && npx --yes tsc-alias -p tsconfig.json|' apps/backend/Dockerfile
    echo "✅ Dockerfile updated"
fi

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker compose -f docker-compose.sit.yml down || true

# Remove old backend image
echo "🗑️  Removing old backend image..."
docker rmi bakong-notification-services-backend || true

# Build backend with no cache
echo "🏗️  Building backend (this may take a few minutes)..."
docker compose -f docker-compose.sit.yml build --no-cache backend

# Start all services
echo "🚀 Starting all services..."
docker compose -f docker-compose.sit.yml up -d

# Wait a bit for services to start
echo "⏳ Waiting for services to start..."
sleep 10

# Check container status
echo "📊 Container status:"
docker compose -f docker-compose.sit.yml ps

# Check backend logs
echo ""
echo "📋 Backend logs (last 20 lines):"
docker compose -f docker-compose.sit.yml logs --tail=20 backend

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Access your services:"
echo "   Frontend: http://10.20.6.57:8090"
echo "   Backend API: http://10.20.6.57:4002"
echo "   Health check: http://10.20.6.57:4002/api/v1/health"
echo ""
echo "📝 To view logs: docker compose -f docker-compose.sit.yml logs -f"

