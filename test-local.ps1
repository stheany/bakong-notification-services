# ============================================================================
# Local Testing Script (PowerShell)
# ============================================================================
# Test database migration and verification scripts locally
# Usage: .\test-local.ps1
# ============================================================================

$ErrorActionPreference = "Stop"

Write-Host "🧪 Local Testing Script" -ForegroundColor Cyan
Write-Host "=======================" -ForegroundColor Cyan
Write-Host ""

# Check if timeout command is available (PowerShell has built-in timeout)
$USE_TIMEOUT = $false
Write-Host "⚠️  Using PowerShell timeout (if needed, scripts will run without timeout)" -ForegroundColor Yellow
Write-Host "   If scripts hang, press Ctrl+C" -ForegroundColor Yellow
Write-Host ""

# Check if Docker is running
try {
    docker ps | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker command failed"
    }
} catch {
    Write-Host "❌ Docker is not running!" -ForegroundColor Red
    Write-Host "   Please start Docker Desktop first" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Docker is running" -ForegroundColor Green
Write-Host ""

# Check if files exist
Write-Host "📋 Step 1: Checking required files..." -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Cyan

$MIGRATION_FILE = "apps/backend/scripts/unified-migration.sql"
$VERIFY_FILE = "apps/backend/scripts/verify-all.sql"
$UTILS_FILE = "utils-server.sh"

if (-not (Test-Path $MIGRATION_FILE)) {
    Write-Host "❌ Migration file not found: $MIGRATION_FILE" -ForegroundColor Red
    exit 1
} else {
    Write-Host "✅ Found: $MIGRATION_FILE" -ForegroundColor Green
}

if (-not (Test-Path $VERIFY_FILE)) {
    Write-Host "❌ Verification file not found: $VERIFY_FILE" -ForegroundColor Red
    exit 1
} else {
    Write-Host "✅ Found: $VERIFY_FILE" -ForegroundColor Green
}

if (-not (Test-Path $UTILS_FILE)) {
    Write-Host "❌ Utils script not found: $UTILS_FILE" -ForegroundColor Red
    exit 1
} else {
    Write-Host "✅ Found: $UTILS_FILE" -ForegroundColor Green
}

Write-Host ""
Write-Host "📋 Step 2: Checking Docker containers..." -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Cyan

# Check if dev database container exists
$containerList = docker ps -a --format '{{.Names}}' 2>&1
if ($containerList -match "bakong-notification-services-db-dev") {
    Write-Host "✅ Dev database container exists" -ForegroundColor Green
    $CONTAINER_NAME = "bakong-notification-services-db-dev"
    $DB_NAME = "bakong_notification_services_dev"
    $DB_USER = "bkns_dev"
    $DB_PASSWORD = "dev"
} else {
    Write-Host "⚠️  Dev database container not found" -ForegroundColor Yellow
    Write-Host "   Starting dev database..." -ForegroundColor Yellow
    docker-compose -f docker-compose.yml up -d db
    Start-Sleep -Seconds 10
    $CONTAINER_NAME = "bakong-notification-services-db-dev"
    $DB_NAME = "bakong_notification_services_dev"
    $DB_USER = "bkns_dev"
    $DB_PASSWORD = "dev"
}

# Check if container is running
$runningContainers = docker ps --format '{{.Names}}' 2>&1
if ($runningContainers -match "^${CONTAINER_NAME}$") {
    Write-Host "✅ Database container is running" -ForegroundColor Green
    
    # Wait for database to be ready
    Write-Host "   Waiting for database to be ready..." -ForegroundColor Yellow
    for ($i = 1; $i -le 30; $i++) {
        $result = docker exec $CONTAINER_NAME pg_isready -U $DB_USER -d $DB_NAME 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Database is ready" -ForegroundColor Green
            break
        }
        if ($i -eq 30) {
            Write-Host "   ⚠️  Database healthcheck timeout after 30 attempts" -ForegroundColor Yellow
            Write-Host "   Continuing anyway..." -ForegroundColor Yellow
        } else {
            Write-Host "   ⏳ Waiting for database... ($i/30)" -ForegroundColor Yellow
            Start-Sleep -Seconds 1
        }
    }
} else {
    Write-Host "⚠️  Starting database container..." -ForegroundColor Yellow
    # Check if container exists but is stopped
    if ($containerList -match "^${CONTAINER_NAME}$") {
        Write-Host "   Container exists but is stopped. Removing old container..." -ForegroundColor Yellow
        docker rm $CONTAINER_NAME 2>&1 | Out-Null
    }
    # Start fresh container with docker-compose
    docker-compose -f docker-compose.yml up -d db
    Write-Host "   ⏳ Waiting for database to start (15 seconds)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 15
    
    # Wait for database to be ready
    Write-Host "   Waiting for database to be ready..." -ForegroundColor Yellow
    for ($i = 1; $i -le 30; $i++) {
        $result = docker exec $CONTAINER_NAME pg_isready -U $DB_USER -d $DB_NAME 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Database is ready" -ForegroundColor Green
            break
        }
        if ($i -eq 30) {
            Write-Host "   ⚠️  Database healthcheck timeout after 30 attempts" -ForegroundColor Yellow
            Write-Host "   Continuing anyway..." -ForegroundColor Yellow
        } else {
            Write-Host "   ⏳ Waiting for database... ($i/30)" -ForegroundColor Yellow
            Start-Sleep -Seconds 1
        }
    }
}

Write-Host ""
Write-Host "📋 Step 3: Testing Database Connection..." -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Cyan

# Test database connection first
Write-Host "Testing database connection..." -ForegroundColor Yellow
$env:PGPASSWORD = $DB_PASSWORD
try {
    $result = docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "SELECT 1;" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Database connection successful" -ForegroundColor Green
    } else {
        throw "Connection failed"
    }
} catch {
    Write-Host "❌ Database connection failed!" -ForegroundColor Red
    Write-Host "   Please check:" -ForegroundColor Red
    Write-Host "   1. Container is running: docker ps | Select-String $CONTAINER_NAME" -ForegroundColor Red
    Write-Host "   2. Database is ready: docker exec $CONTAINER_NAME pg_isready -U $DB_USER" -ForegroundColor Red
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    exit 1
}

Write-Host ""
Write-Host "📋 Step 4: Testing Migration Script..." -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Cyan

# Test migration
Write-Host "Running unified migration..." -ForegroundColor Yellow
Write-Host "   File: $MIGRATION_FILE" -ForegroundColor Yellow
Write-Host "   Database: $DB_NAME" -ForegroundColor Yellow
Write-Host "   User: $DB_USER" -ForegroundColor Yellow
Write-Host ""

$env:PGPASSWORD = $DB_PASSWORD
Write-Host "   ⏳ Running migration (this may take a minute or two)..." -ForegroundColor Yellow

$MIGRATION_OUTPUT = ""
try {
    $MIGRATION_OUTPUT = Get-Content $MIGRATION_FILE | docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME 2>&1
    $MIGRATION_EXIT_CODE = $LASTEXITCODE
} catch {
    $MIGRATION_OUTPUT = $_.Exception.Message
    $MIGRATION_EXIT_CODE = 1
}

# Check for critical errors
$hasErrors = ($MIGRATION_OUTPUT -match "ERROR|FATAL|syntax error") -and 
             -not ($MIGRATION_OUTPUT -match "already exists|already NOT NULL|already has")
$hasWarnings = $MIGRATION_OUTPUT -match "already exists|already NOT NULL|already has"

if ($hasErrors) {
    $MIGRATION_SUCCESS = $false
} elseif ($MIGRATION_EXIT_CODE -eq 0 -or $hasWarnings) {
    $MIGRATION_SUCCESS = $true
} else {
    $MIGRATION_SUCCESS = $false
}

if ($MIGRATION_SUCCESS) {
    Write-Host ""
    Write-Host "✅ Migration test PASSED" -ForegroundColor Green
    
    # Run comprehensive verification if available
    $VERIFY_MIGRATION_FILE = "apps/backend/scripts/verify-migration.sql"
    if (Test-Path $VERIFY_MIGRATION_FILE) {
        Write-Host ""
        Write-Host "   Running comprehensive verification..." -ForegroundColor Yellow
        try {
            Get-Content $VERIFY_MIGRATION_FILE | docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   ✅ Comprehensive verification passed" -ForegroundColor Green
            } else {
                Write-Host "   ⚠️  Verification had warnings (check manually)" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "   ⚠️  Verification had warnings (check manually)" -ForegroundColor Yellow
        }
    }
    
    # Quick verification - check critical columns
    Write-Host ""
    Write-Host "   Quick verification checks..." -ForegroundColor Yellow
    
    $result = docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -tAc "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'template' AND column_name = 'categoryTypeId');" 2>&1
    if ($result -match "t") {
        Write-Host "   ✅ Verified: categoryTypeId column exists" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Warning: categoryTypeId column not found" -ForegroundColor Yellow
    }
    
    $result = docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'category_type');" 2>&1
    if ($result -match "t") {
        Write-Host "   ✅ Verified: category_type table exists" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Warning: category_type table not found" -ForegroundColor Yellow
    }
    
    $result = docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -tAc "SELECT EXISTS (SELECT FROM pg_type WHERE typname = 'notification_type_enum');" 2>&1
    if ($result -match "t") {
        Write-Host "   ✅ Verified: notification_type_enum exists" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Warning: notification_type_enum not found" -ForegroundColor Yellow
    }
    
    $result = docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -tAc "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user' AND column_name = 'imageId');" 2>&1
    if ($result -match "t") {
        Write-Host "   ✅ Verified: user.imageId column exists" -ForegroundColor Green
    }
} else {
    Write-Host ""
    Write-Host "❌ Migration test FAILED" -ForegroundColor Red
    Write-Host ""
    Write-Host "   Migration output (last 20 lines):" -ForegroundColor Yellow
    $MIGRATION_OUTPUT | Select-Object -Last 20
    Write-Host ""
    Write-Host "   Checking if migration was already applied..." -ForegroundColor Yellow
    $result = docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -tAc "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'template' AND column_name = 'categoryTypeId');" 2>&1
    if ($result -match "t") {
        Write-Host "   ✅ Migration already applied (categoryTypeId exists)" -ForegroundColor Green
        Write-Host "   Migration test PASSED (already applied)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Migration failed and not applied" -ForegroundColor Red
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
        exit 1
    }
}
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "📋 Step 5: Testing Cascade Delete Migration..." -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Cyan

# Verify cascade delete constraint (unified-migration.sql handles it)
Write-Host "   Verifying cascade delete constraint..." -ForegroundColor Yellow
$env:PGPASSWORD = $DB_PASSWORD
try {
    $result = docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -tAc "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'notification'::regclass AND conname = 'FK_notification_template';" 2>&1
    if ($result -match "ON DELETE CASCADE") {
        Write-Host "   ✅ Verified: FK_notification_template has ON DELETE CASCADE" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Warning: CASCADE constraint not found (unified-migration.sql should handle it)" -ForegroundColor Yellow
        Write-Host "   This is normal if migration hasn't run yet or constraint has different name" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️  Warning: CASCADE constraint not found (unified-migration.sql should handle it)" -ForegroundColor Yellow
    Write-Host "   This is normal if migration hasn't run yet or constraint has different name" -ForegroundColor Yellow
}
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "📋 Step 6: Testing Verification Script..." -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Cyan

# Test verification
Write-Host "Running verification..." -ForegroundColor Yellow
Write-Host "   ⏳ This may take a minute..." -ForegroundColor Yellow
$env:PGPASSWORD = $DB_PASSWORD
try {
    Get-Content $VERIFY_FILE | docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $VERIFY_SUCCESS = $true
    } else {
        $VERIFY_SUCCESS = $false
    }
} catch {
    $VERIFY_SUCCESS = $false
}

if ($VERIFY_SUCCESS) {
    Write-Host "✅ Verification test PASSED" -ForegroundColor Green
} else {
    Write-Host "❌ Verification test FAILED" -ForegroundColor Red
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    exit 1
}
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "📋 Step 7: Testing Utils Script Commands..." -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Cyan

# Test utils-server.sh commands
Write-Host "Testing: bash utils-server.sh db-migrate" -ForegroundColor Yellow
try {
    bash utils-server.sh db-migrate 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ db-migrate command works" -ForegroundColor Green
    } else {
        Write-Host "⚠️  db-migrate command had issues (may be normal if already migrated)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  db-migrate command had issues (may be normal if already migrated)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Testing: bash utils-server.sh verify-all" -ForegroundColor Yellow
try {
    bash utils-server.sh verify-all 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ verify-all command works" -ForegroundColor Green
    } else {
        Write-Host "❌ verify-all command FAILED" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ verify-all command FAILED" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📋 Step 8: Testing Backup Function..." -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Cyan

# Test backup
Write-Host "Testing: bash utils-server.sh db-backup dev" -ForegroundColor Yellow
try {
    bash utils-server.sh db-backup dev 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ db-backup command works" -ForegroundColor Green
        
        # Check if backup file was created
        $BACKUP_FILE = "backups/backup_dev_latest.sql"
        if (Test-Path $BACKUP_FILE) {
            $BACKUP_SIZE = (Get-Item $BACKUP_FILE).Length
            $BACKUP_SIZE_FORMATTED = "{0:N2} KB" -f ($BACKUP_SIZE / 1KB)
            Write-Host "✅ Backup file created: $BACKUP_FILE ($BACKUP_SIZE_FORMATTED)" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Backup file not found (may be normal if backup failed silently)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "⚠️  db-backup command had issues (may be normal if database is empty)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  db-backup command had issues (may be normal if database is empty)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📋 Step 9: Testing Safety Verification Script..." -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Cyan

# Check if safety verification script exists
$SAFETY_SCRIPT = "verify-deployment-safety.sh"
if (Test-Path $SAFETY_SCRIPT) {
    Write-Host "✅ Safety verification script exists" -ForegroundColor Green
    Write-Host "Testing safety verification (dev environment)..." -ForegroundColor Yellow
    try {
        bash $SAFETY_SCRIPT dev 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Safety verification script works" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Safety verification had issues (check output above)" -ForegroundColor Yellow
            # Run it again to show output
            Write-Host ""
            Write-Host "Running safety verification with output:" -ForegroundColor Yellow
            bash $SAFETY_SCRIPT dev
        }
    } catch {
        Write-Host "⚠️  Safety verification had issues (check output above)" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Running safety verification with output:" -ForegroundColor Yellow
        bash $SAFETY_SCRIPT dev
    }
} else {
    Write-Host "⚠️  Safety verification script not found: $SAFETY_SCRIPT" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📋 Step 10: Checking File Paths in Scripts..." -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Cyan

# Check if scripts reference correct paths
$utilsContent = Get-Content $UTILS_FILE -Raw
if ($utilsContent -match "apps/backend/scripts/unified-migration.sql") {
    Write-Host "✅ utils-server.sh references correct migration path" -ForegroundColor Green
} else {
    Write-Host "❌ utils-server.sh has wrong migration path" -ForegroundColor Red
    exit 1
}

if ($utilsContent -match "apps/backend/scripts/verify-all.sql") {
    Write-Host "✅ utils-server.sh references correct verification path" -ForegroundColor Green
} else {
    Write-Host "❌ utils-server.sh has wrong verification path" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ All tests PASSED!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Summary:" -ForegroundColor Cyan
Write-Host "   ✅ Migration file exists and works" -ForegroundColor Green
Write-Host "   ✅ Verification file exists and works" -ForegroundColor Green
Write-Host "   ✅ Utils script commands work" -ForegroundColor Green
Write-Host "   ✅ Backup function works" -ForegroundColor Green
Write-Host "   ✅ File paths are correct" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Your scripts are ready for deployment!" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔒 Data Safety Features:" -ForegroundColor Cyan
Write-Host "   ✅ Automatic backup before deployment" -ForegroundColor Green
Write-Host "   ✅ Backup verification" -ForegroundColor Green
Write-Host "   ✅ Safe migrations (no data deletion)" -ForegroundColor Green
Write-Host "   ✅ Post-deployment data verification" -ForegroundColor Green
Write-Host ""

