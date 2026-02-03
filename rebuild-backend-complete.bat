@echo off
echo ========================================
echo COMPLETE DOCKER BACKEND REBUILD
echo ========================================
echo.

echo Step 1: Stopping backend container...
docker-compose stop backend
if %errorlevel% neq 0 (
    echo Failed to stop backend
    pause
    exit /b 1
)

echo.
echo Step 2: Removing old container...
docker-compose rm -f backend
if %errorlevel% neq 0 (
    echo Failed to remove backend
    pause
    exit /b 1
)

echo.
echo Step 3: Rebuilding backend (this will take a few minutes)...
docker-compose build --no-cache backend
if %errorlevel% neq 0 (
    echo Failed to build backend
    pause
    exit /b 1
)

echo.
echo Step 4: Starting backend with new image...
docker-compose up -d backend
if %errorlevel% neq 0 (
    echo Failed to start backend
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ Backend rebuilt and started!
echo ========================================
echo.
echo Waiting 5 seconds for backend to start up...
timeout /t 5 /nobreak

echo.
echo Showing logs (press Ctrl+C to stop):
docker-compose logs -f backend
