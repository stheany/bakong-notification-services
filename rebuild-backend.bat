@echo off
echo ========================================
echo Rebuilding Backend Docker Container
echo ========================================
echo.

echo Step 1: Stopping backend container...
docker-compose stop backend

echo.
echo Step 2: Rebuilding backend with latest code...
docker-compose build --no-cache backend

echo.
echo Step 3: Starting backend container...
docker-compose up -d backend

echo.
echo ========================================
echo Backend container rebuilt successfully!
echo ========================================
echo.
echo To view logs, run:
echo   docker-compose logs -f backend
echo.
