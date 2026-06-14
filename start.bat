@echo off
REM ============================================
REM Asset Management System - Quick Start Script (Windows)
REM ============================================

echo ========================================
echo Asset Management System - Starting
echo ========================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo Docker is not running. Please start Docker first.
    pause
    exit /b 1
)

REM Create .env file if not exists
if not exist .env (
    echo Creating .env file...
    copy .env.example .env
    echo Please edit .env file and change JWT_SECRET!
)

REM Build and start containers
echo Building Docker images...
docker-compose build

echo Starting containers...
docker-compose up -d

REM Wait for services to be ready
echo Waiting for services to start...
timeout /t 10 /nobreak >nul

REM Check status
echo Checking service status...
docker-compose ps

echo.
echo ========================================
echo System started successfully!
echo ========================================
echo.
echo Services:
echo   Frontend: http://localhost:3000
echo   Backend API: http://localhost:5000
echo   Health Check: http://localhost:5000/health
echo.
echo Default credentials:
echo   Username: admin
echo   Password: admin123
echo.
echo IMPORTANT: Change the default password after first login!
echo.
echo Useful commands:
echo   Stop: docker-compose down
echo   Logs: docker-compose logs -f
echo   Restart: docker-compose restart
echo.

pause
