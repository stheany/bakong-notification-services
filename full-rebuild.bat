@echo off
echo ========================================
echo COMPLETE REBUILD PROCESS
echo ========================================
echo.

echo Step 1: Update package-lock.json locally...
cd apps\backend
call npm install
if %errorlevel% neq 0 (
    echo Failed to update package-lock.json
    pause
    exit /b 1
)

echo.
echo Step 2: Going back to root directory...
cd ..\..

echo.
echo Step 3: Stopping backend container...
docker-compose stop backend

echo.
echo Step 4: Removing old container...
docker-compose rm -f backend

echo.
echo Step 5: Rebuilding backend (this will take a few minutes)...
docker-compose build --no-cache backend
if %errorlevel% neq 0 (
    echo Failed to build backend
    pause
    exit /b 1
)

echo.
echo Step 6: Starting backend with new image...
docker-compose up -d backend
if %errorlevel% neq 0 (
    echo Failed to start backend
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ COMPLETE! Backend rebuilt and started!
echo ========================================
echo.
echo Waiting 5 seconds for backend to start up...
timeout /t 5 /nobreak

echo.
echo Showing logs (press Ctrl+C to stop):
docker-compose logs -f backend
