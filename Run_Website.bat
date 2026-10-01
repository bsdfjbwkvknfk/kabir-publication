@echo off
title Kabir Publication - Book Order Management System
color 0A
cls
echo ======================================================================
echo             KABIR PUBLICATION - BOOK ORDER MANAGEMENT SYSTEM
echo ======================================================================
echo.
echo Checking Node.js runtime...

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Node.js is not found on this laptop.
    echo.
    echo [*] Opening website frontend directly in your default browser...
    start "" "index.html"
    echo.
    echo ------------------------------------------------------------------
    echo NOTE: To run the full local server with multi-device Wi-Fi access,
    echo please install Node.js from: https://nodejs.org
    echo ------------------------------------------------------------------
    echo.
    pause
    exit /b
)

if not exist node_modules (
    echo [*] First time setup: Installing required dependencies...
    echo (Please wait 10-15 seconds)
    call npm install --omit=dev
    echo [*] Installation completed!
    echo.
)

echo [*] Starting Kabir Publication server...
start "" "http://localhost:3000"
node server.js
pause
