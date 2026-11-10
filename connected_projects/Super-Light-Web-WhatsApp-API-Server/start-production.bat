@echo off
REM Production start script for Windows deployment
REM This script optimizes Node.js for limited memory environments

REM Set production environment
set NODE_ENV=production

REM Memory optimization flags
set NODE_OPTIONS=--max-old-space-size=1024

REM Create required directories if they don't exist
if not exist logs mkdir logs
if not exist sessions mkdir sessions
if not exist media mkdir media
if not exist auth_info_baileys mkdir auth_info_baileys
if not exist data mkdir data

REM Check and install dependencies if node_modules is missing
if not exist node_modules (
    echo node_modules not found. Installing production dependencies...
    call npm install --production
)

REM Check if PM2 is available
where pm2 >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Starting application with PM2...
    pm2 start ecosystem.config.js
    echo.
    echo Application started with PM2!
    echo Check status with: pm2 status
    echo View logs with: pm2 logs whatsapp-api
    echo Monitor with: pm2 monit
) else (
    echo Starting with Node.js directly...
    echo Recommendation: Install PM2 for better process management (npm install -g pm2)
    echo.
    node index.js
)