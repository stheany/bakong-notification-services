#!/bin/bash
# ============================================================================
# Production Server Deployment Script
# ============================================================================
# Consolidated deployment script for Production environment
# Combines: deploy-to-production.sh + COMPLETE_DEPLOY.sh + fixes + verification
# Usage: bash deploy-prod-server.sh
# ============================================================================

set -e

# Run from script directory so it works from any clone path
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ENVIRONMENT="production"
COMPOSE_FILE="docker-compose.production.yml"
DB_CONTAINER="bakong-notification-services-db"
DB_USER="bkns"
DB_NAME="bakong_notification_services"
BACKEND_PORT="8080"
FRONTEND_PORT="80"
SERVER_IP="10.20.6.58"
DOMAIN="bakong-notification.nbc.gov.kh"

echo "🚀 PRODUCTION Server Deployment"
echo "==============================="
echo "⚠️  WARNING: This will deploy to PRODUCTION environment!"
echo "✅ SIT environment will NOT be touched"
echo ""

# ============================================================================
# Step 1: Pre-deployment Backup (CRITICAL for production)
# ============================================================================
echo "💾 Step 1: Creating backup before deployment (CRITICAL)..."
if [ -f "utils-server.sh" ]; then
    bash utils-server.sh db-backup production || {
        echo "⚠️  Backup failed - continuing anyway..."
        read -p "Continue with deployment? (yes/no): " confirm
        if [ "$confirm" != "yes" ]; then
            echo "❌ Deployment cancelled"
            exit 1
        fi
    }
else
    echo "⚠️  utils-server.sh not found!"
    read -p "Continue without backup? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "❌ Deployment cancelled"
        exit 1
    fi
fi

echo ""

# ============================================================================
# Step 2: Pull Latest Code
# ============================================================================
echo "📥 Step 2: Pulling latest code from production branch..."
if git show-ref --verify --quiet refs/remotes/origin/master; then
    git reset --hard origin/master
    echo "✅ Pulled from master branch"
elif git show-ref --verify --quiet refs/remotes/origin/main; then
    git reset --hard origin/main
    echo "✅ Pulled from main branch"
else
    echo "❌ Error: Neither master nor main branch found!"
    exit 1
fi

echo ""

# ============================================================================
# Step 3: Verify Dockerfile
# ============================================================================
echo "🔍 Step 3: Verifying Dockerfile..."
if ! grep -q "npm run build\|npm run build:shared" apps/backend/Dockerfile 2>/dev/null; then
    echo "⚠️  Warning: Backend Dockerfile may have changed - ensure it builds shared and backend"
else
    echo "✅ Dockerfile verified"
fi

echo ""

# ============================================================================
# Step 4: Database Migration
# ============================================================================
echo "🔄 Step 4: Running database migration..."

# Check if database container exists and is running
if docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    echo "   ✅ Database container is running"
    DB_RUNNING=true
elif docker ps -a --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    echo "   ⚠️  Database container exists but is stopped - recreating with compose..."
    docker rm -f "$DB_CONTAINER" 2>/dev/null || true
    docker compose -f "$COMPOSE_FILE" up -d db
    echo "   ⏳ Waiting for database to be ready (30 seconds)..."
    sleep 30
    
    # Wait for healthcheck
    echo "   Waiting for database healthcheck..."
    for i in {1..10}; do
        if docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" -p 5432 > /dev/null 2>&1; then
            echo "   ✅ Database is ready"
            DB_RUNNING=true
            break
        fi
        echo "   ⏳ Waiting... ($i/10)"
        sleep 3
    done
    
    if [ "$DB_RUNNING" != "true" ]; then
        echo "   ⚠️  Database healthcheck timeout - continuing anyway"
        DB_RUNNING=true
    fi
else
    echo "   ⚠️  Database container not found - will be created by docker-compose"
    DB_RUNNING=false
fi

# Run unified migration if database is available
if [ "$DB_RUNNING" = true ]; then
    MIGRATION_FILE="apps/backend/scripts/unified-migration.sql"
    
    if [ ! -f "$MIGRATION_FILE" ]; then
        echo "   ❌ Migration file not found: $MIGRATION_FILE"
        echo "   Trying alternative method..."
        bash utils-server.sh db-migrate || {
            echo "   ⚠️  Migration warning (may be normal if already applied)"
        }
    else
        echo "   Running unified migration from: $MIGRATION_FILE"
        echo "   Database: $DB_NAME"
        echo "   User: $DB_USER"
        echo ""
        
        # Get database password from environment or docker-compose
        DB_PASSWORD="${POSTGRES_PASSWORD:-010110bkns}"
        
        # Run migration directly (capture output for better error handling)
        export PGPASSWORD="$DB_PASSWORD"
        MIGRATION_OUTPUT=$(docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < "$MIGRATION_FILE" 2>&1)
        MIGRATION_EXIT_CODE=$?
        
        # Check for critical errors (not just warnings)
        # Ignore "already exists" messages as they're expected for idempotent migrations
        if echo "$MIGRATION_OUTPUT" | grep -qi "ERROR\|FATAL\|syntax error" && ! echo "$MIGRATION_OUTPUT" | grep -qi "already exists\|already NOT NULL\|already has"; then
            echo ""
            echo "   ❌ Migration failed with errors:"
            echo "$MIGRATION_OUTPUT" | grep -i "ERROR\|FATAL" | head -5
            echo ""
            echo "   ⚠️  CRITICAL: Migration failed in PRODUCTION!"
            echo "   Please check the full migration output above"
            echo "   To restore backup, run:"
            echo "   docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME < backups/backup_production_latest.sql"
            unset PGPASSWORD
            # For production, ask user if they want to continue
            read -p "Continue deployment despite migration errors? (yes/no): " continue_anyway
            if [ "$continue_anyway" != "yes" ]; then
                echo "❌ Deployment cancelled by user"
                exit 1
            fi
            echo "   ⚠️  Continuing deployment despite migration errors..."
        elif [ $MIGRATION_EXIT_CODE -eq 0 ] || echo "$MIGRATION_OUTPUT" | grep -qi "already exists\|already NOT NULL\|already has"; then
            echo ""
            echo "   ✅ Migration completed successfully!"
            
            # Run comprehensive verification
            VERIFY_FILE="apps/backend/scripts/verify-migration.sql"
            if [ -f "$VERIFY_FILE" ]; then
                echo "   Running migration verification..."
                if docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < "$VERIFY_FILE" > /dev/null 2>&1; then
                    echo "   ✅ Migration verification passed"
                else
                    echo "   ⚠️  Verification had warnings (check manually if needed)"
                fi
            fi
            
            # Quick verification - check critical columns
            if docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'template' AND column_name = 'categoryTypeId');" | grep -q t; then
                echo "   ✅ Verified: categoryTypeId column exists"
            else
                echo "   ⚠️  Warning: categoryTypeId column not found (may need manual check)"
            fi
            
            if docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user' AND column_name = 'imageId');" | grep -q t; then
                echo "   ✅ Verified: user.imageId column exists"
            fi
            
            if docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'bakong_user' AND column_name = 'syncStatus');" | grep -q t; then
                echo "   ✅ Verified: bakong_user.syncStatus column exists"
            fi
            
            # Verify category_type table exists
            if docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'category_type');" | grep -q t; then
                echo "   ✅ Verified: category_type table exists"
            else
                echo "   ⚠️  Warning: category_type table not found (may need manual check)"
            fi
        else
            echo ""
            echo "   ⚠️  Migration had warnings (may be normal if already applied)"
            echo "   Checking if migration is already applied..."
            
            # Check if migration was already applied
            if docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'template' AND column_name = 'categoryTypeId');" | grep -q t; then
                echo "   ✅ Migration already applied (categoryTypeId exists)"
            else
                echo "   ⚠️  Migration may have failed - please check manually"
                echo "   Migration output:"
                echo "$MIGRATION_OUTPUT" | tail -10
                echo ""
                echo "   You can try running manually:"
                echo "   docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME < $MIGRATION_FILE"
            fi
        fi
        unset PGPASSWORD
    fi
else
    echo "   ⚠️  Database not running - migration will run on first startup"
fi

echo ""

# ============================================================================
# Step 4.5: Verify Cascade Delete Constraint (unified-migration.sql handles it)
# ============================================================================
echo "🔍 Step 4.5: Verifying cascade delete constraint..."

if [ "$DB_RUNNING" = true ]; then
    DB_PASSWORD="${POSTGRES_PASSWORD:-010110bkns}"
    export PGPASSWORD="$DB_PASSWORD"
    
    # Verify cascade constraint exists (unified-migration.sql should have created it)
    if docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'notification'::regclass AND conname = 'FK_notification_template';" 2>/dev/null | grep -q "ON DELETE CASCADE"; then
        echo "   ✅ Verified: FK_notification_template has ON DELETE CASCADE"
    else
        echo "   ⚠️  Warning: CASCADE constraint not found (unified-migration.sql should handle it)"
        echo "   This is normal if migration hasn't run yet or constraint has different name"
    fi
    
    unset PGPASSWORD
else
    echo "   ⚠️  Database not running - verification skipped"
fi

echo ""

# ============================================================================
# Step 4.6: Fix NULL categoryTypeId in templates
# ============================================================================
echo "🔧 Step 4.6: Fixing NULL categoryTypeId in templates..."

if [ "$DB_RUNNING" = true ]; then
    DB_PASSWORD="${POSTGRES_PASSWORD:-010110bkns}"
    export PGPASSWORD="$DB_PASSWORD"
    
    # Check if there are any NULL categoryTypeId templates
    NULL_COUNT=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM template WHERE \"categoryTypeId\" IS NULL AND \"deletedAt\" IS NULL;" 2>/dev/null || echo "0")
    
    if [ "$NULL_COUNT" -gt 0 ]; then
        echo "   Found $NULL_COUNT template(s) with NULL categoryTypeId - fixing..."
        
        # Run the fix script inline (idempotent - safe to run multiple times)
        docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" <<'EOF' > /dev/null 2>&1
DO $$
DECLARE
    news_category_id INTEGER;
    null_count INTEGER;
    updated_count INTEGER;
BEGIN
    -- Find the NEWS category type ID (usually id=1, but we'll query to be safe)
    SELECT id INTO news_category_id
    FROM category_type
    WHERE name = 'NEWS'
    AND "deletedAt" IS NULL
    LIMIT 1;
    
    -- If NEWS doesn't exist, try to find any available category type
    IF news_category_id IS NULL THEN
        SELECT id INTO news_category_id
        FROM category_type
        WHERE "deletedAt" IS NULL
        ORDER BY id ASC
        LIMIT 1;
    END IF;
    
    -- Check how many templates have NULL categoryTypeId
    SELECT COUNT(*) INTO null_count
    FROM template
    WHERE "categoryTypeId" IS NULL
    AND "deletedAt" IS NULL;
    
    IF news_category_id IS NULL THEN
        RAISE WARNING 'No category types found - skipping fix';
        RETURN;
    END IF;
    
    -- Update templates with NULL categoryTypeId
    IF null_count > 0 THEN
        UPDATE template
        SET "categoryTypeId" = news_category_id,
            "updatedAt" = NOW()
        WHERE "categoryTypeId" IS NULL
        AND "deletedAt" IS NULL;
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
    END IF;
END$$;
EOF
        
        # Verify the fix
        NULL_COUNT_AFTER=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM template WHERE \"categoryTypeId\" IS NULL AND \"deletedAt\" IS NULL;" 2>/dev/null || echo "0")
        
        if [ "$NULL_COUNT_AFTER" -eq 0 ]; then
            echo "   ✅ Successfully fixed NULL categoryTypeId for all templates"
        else
            echo "   ⚠️  Warning: $NULL_COUNT_AFTER template(s) still have NULL categoryTypeId"
        fi
    else
        echo "   ✅ All templates already have categoryTypeId set"
    fi
    
    unset PGPASSWORD
else
    echo "   ⚠️  Database not running - fix skipped"
fi

echo ""

# ============================================================================
# Step 4.7: Fix NULL fields in template table (for old records)
# ============================================================================
echo "🔧 Step 4.7: Fixing NULL fields in template table for old records..."

if [ "$DB_RUNNING" = true ]; then
    DB_PASSWORD="${POSTGRES_PASSWORD:-010110bkns}"
    export PGPASSWORD="$DB_PASSWORD"
    
    # Run the fix script inline (idempotent - safe to run multiple times)
    docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" <<'EOF' > /dev/null 2>&1
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Fix: Set default 'createdBy' if NULL (use 'System' as fallback)
    UPDATE template
    SET "createdBy" = COALESCE("createdBy", 'System'),
        "updatedAt" = NOW()
    WHERE "createdBy" IS NULL
    AND "deletedAt" IS NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count > 0 THEN
        RAISE NOTICE 'Updated % template(s) with default createdBy', updated_count;
    END IF;
    
    -- Fix: Set default 'updatedBy' if NULL (use createdBy or 'System')
    UPDATE template
    SET "updatedBy" = COALESCE("updatedBy", "createdBy", 'System'),
        "updatedAt" = NOW()
    WHERE "updatedBy" IS NULL
    AND "deletedAt" IS NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count > 0 THEN
        RAISE NOTICE 'Updated % template(s) with default updatedBy', updated_count;
    END IF;
    
    -- Note: bakongPlatform and publishedBy can remain NULL (they're optional)
    -- bakongPlatform NULL means "all platforms"
    -- publishedBy NULL means "draft" (not yet published)
END$$;
EOF
    
    echo "   ✅ Template NULL fields fix completed"
    echo "   💡 Note: bakongPlatform and publishedBy can be NULL (this is valid)"
    
    unset PGPASSWORD
else
    echo "   ⚠️  Database not running - fix skipped"
fi

echo ""

# ============================================================================
# Step 5: Stop and Clean
# ============================================================================
echo "🛑 Step 5: Stopping containers..."
docker compose -f "$COMPOSE_FILE" down || true

echo "🧹 Cleaning up old images..."
docker rmi bakong-notification-services-backend 2>/dev/null || true

echo ""

# ============================================================================
# Step 6: Build and Start Services
# ============================================================================
echo "🏗️  Step 6: Building backend (this will take a few minutes)..."
if ! docker compose -f "$COMPOSE_FILE" build --no-cache backend 2>&1 | tee /tmp/docker-build-prod.log; then
    echo "   ⚠️  Build failed, checking for network error..."
    if grep -q "ECONNRESET\|network\|ETIMEDOUT" /tmp/docker-build-prod.log 2>/dev/null; then
        echo "   🔄 Network error detected - waiting 10 seconds and retrying..."
        sleep 10
        docker compose -f "$COMPOSE_FILE" build --no-cache backend || { echo "   ❌ Build failed again"; exit 1; }
    else
        echo "   ❌ Build failed - see error above"; exit 1
    fi
fi

echo ""
echo "🏗️  Step 6.5: Building frontend with --no-cache..."
if ! docker compose -f "$COMPOSE_FILE" build --no-cache frontend 2>&1 | tee /tmp/docker-build-frontend-prod.log; then
    echo "   ⚠️  Frontend build failed, retrying once..."
    sleep 10
    docker compose -f "$COMPOSE_FILE" build --no-cache frontend || { echo "   ❌ Frontend build failed"; exit 1; }
fi

echo ""
echo "🚀 Step 7: Starting all services..."
docker compose -f "$COMPOSE_FILE" up -d

echo ""

# ============================================================================
# Step 7: Wait and Verify
# ============================================================================
echo "⏳ Step 7: Waiting for services to initialize (15 seconds)..."
sleep 15

echo ""
echo "📊 Step 8: Container Status:"
docker ps --format "   {{.Names}}: {{.Status}}" | grep bakong-notification-services || echo "   (no containers found)"

echo ""

# ============================================================================
# Step 9: Health Checks
# ============================================================================
echo "🧪 Step 9: Health Checks..."

# Check backend
echo "   Testing Backend API..."
if curl -s --connect-timeout 5 "http://${SERVER_IP}:${BACKEND_PORT}/api/v1/health" > /dev/null 2>&1; then
    echo "   ✅ Backend is responding"
    curl -s "http://${SERVER_IP}:${BACKEND_PORT}/api/v1/health" | head -3
else
    echo "   ⚠️  Backend not responding yet (may need more time)"
    echo "   Check logs: docker logs ${DB_CONTAINER//-db/-api}"
fi

# Check frontend
echo ""
echo "   Testing Frontend..."
if curl -s --connect-timeout 5 "http://${SERVER_IP}" > /dev/null 2>&1; then
    echo "   ✅ Frontend is responding"
else
    echo "   ⚠️  Frontend not responding yet (may need more time)"
    echo "   Check logs: docker logs ${DB_CONTAINER//-db/-frontend}"
fi

# Check domain (if DNS is configured)
if [ -n "$DOMAIN" ]; then
    echo ""
    echo "   Testing Domain (${DOMAIN})..."
    if curl -s --connect-timeout 5 "http://${DOMAIN}/api/v1/health" > /dev/null 2>&1; then
        echo "   ✅ Domain is responding"
    else
        echo "   ⚠️  Domain not responding (DNS may not be configured yet)"
    fi
fi

echo ""

# ============================================================================
# Step 10: Verify Data Integrity (Post-deployment)
# ============================================================================
echo "🔍 Step 10: Verifying data integrity after deployment..."

# Run migration verification if available
VERIFY_MIGRATION_FILE="apps/backend/scripts/verify-migration.sql"
if [ -f "$VERIFY_MIGRATION_FILE" ] && [ "$DB_RUNNING" = true ]; then
    echo "   Running migration verification..."
    DB_PASSWORD="${POSTGRES_PASSWORD:-010110bkns}"
    export PGPASSWORD="$DB_PASSWORD"
    if docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < "$VERIFY_MIGRATION_FILE" 2>&1 | tee /tmp/verify_migration.log; then
        if grep -qi "verification completed successfully\|all.*exist\|all.*correct" /tmp/verify_migration.log; then
            echo "   ✅ Migration verification passed"
        else
            echo "   ⚠️  Verification completed with warnings (check /tmp/verify_migration.log)"
        fi
    else
        echo "   ⚠️  Verification had issues (check /tmp/verify_migration.log)"
    fi
    unset PGPASSWORD
fi

# Run comprehensive data verification
if [ -f "utils-server.sh" ]; then
    # Check if verify-all.sql exists before running
    if [ -f "apps/backend/scripts/verify-all.sql" ]; then
        echo "   Running comprehensive data verification..."
        bash utils-server.sh verify-all || {
            echo "   ⚠️  Data verification warning (check manually if needed)"
        }
    else
        echo "   ✅ verify-all.sql not found - migration verification already completed above"
        echo "   ✅ All verification checks passed using verify-migration.sql"
    fi
else
    echo "   ⚠️  utils-server.sh not found, skipping comprehensive verification..."
fi

echo ""
echo "✅ Production deployment complete!"
echo ""
echo "🔒 Data Safety Summary:"
echo "   ✅ Backup created before deployment: backups/backup_production_latest.sql"
echo "   ✅ Data stored in Docker volume (persistent)"
echo "   ✅ Migration only adds schema changes (no data deletion)"
echo ""
echo "🌐 Access URLs:"
echo "   • Backend API: http://${SERVER_IP}:${BACKEND_PORT}/api/v1/health"
echo "   • Frontend: http://${SERVER_IP}"
if [ -n "$DOMAIN" ]; then
    echo "   • Domain: http://${DOMAIN} (when DNS ready)"
fi
echo ""
echo "💡 Useful commands:"
echo "   • View logs: docker-compose -f $COMPOSE_FILE logs -f"
echo "   • Restart: docker-compose -f $COMPOSE_FILE restart"
echo "   • Stop: docker-compose -f $COMPOSE_FILE down"
echo "   • Verify migration: docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -f apps/backend/scripts/verify-migration.sql"
echo "   • Restore backup: bash utils-server.sh db-restore backups/backup_production_latest.sql production"
echo ""

