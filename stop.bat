@echo off
REM ============================================
REM Asset Management System - Stop Script (Windows)
REM ============================================

echo ========================================
echo Asset Management System - Stopping
echo ========================================
echo.

REM Stop containers
docker-compose down

echo.
echo System stopped successfully!
echo.
echo To start again, run: start.bat
echo.

pause
