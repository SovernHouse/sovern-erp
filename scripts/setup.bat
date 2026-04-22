@echo off
REM Trading ERP System - Setup Script for Windows
REM This script sets up the entire Trading ERP system

setlocal enabledelayedexpansion

REM Colors are not natively supported in Windows batch, using different approach
cls

echo.
echo ===================================================
echo Trading ERP System - Setup
echo ===================================================
echo.

REM Check Node.js installation
echo [*] Checking Node.js version...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] ERROR: Node.js is not installed
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo [+] Node.js %NODE_VERSION% detected

REM Check npm installation
echo [*] Checking npm version...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] ERROR: npm is not installed
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i
echo [+] npm %NPM_VERSION% detected

REM Create .env file
echo.
echo [*] Setting up environment variables...
if exist .env (
    echo [!] .env file already exists
    set /p OVERWRITE="Overwrite? (y/n): "
    if /i not "!OVERWRITE!"=="y" (
        echo [*] Skipping .env creation
        goto skip_env
    )
)

if not exist .env.example (
    echo [!] ERROR: .env.example not found
    pause
    exit /b 1
)

copy .env.example .env >nul
echo [+] .env file created from .env.example

:skip_env

REM Install dependencies
echo.
echo [*] Installing dependencies...
echo [*] Installing root dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [!] ERROR: Failed to install root dependencies
    pause
    exit /b 1
)

echo [*] Installing backend dependencies...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo [!] ERROR: Failed to install backend dependencies
    cd ..
    pause
    exit /b 1
)
cd ..

echo [*] Installing admin portal dependencies...
cd portals\admin
call npm install
if %errorlevel% neq 0 (
    echo [!] ERROR: Failed to install admin portal dependencies
    cd ..\..
    pause
    exit /b 1
)
cd ..\..

echo [*] Installing customer portal dependencies...
cd portals\customer
call npm install
if %errorlevel% neq 0 (
    echo [!] ERROR: Failed to install customer portal dependencies
    cd ..\..
    pause
    exit /b 1
)
cd ..\..

echo [*] Installing factory portal dependencies...
cd portals\factory
call npm install
if %errorlevel% neq 0 (
    echo [!] ERROR: Failed to install factory portal dependencies
    cd ..\..
    pause
    exit /b 1
)
cd ..\..

echo [+] All dependencies installed successfully

REM Print setup complete message
echo.
echo ===================================================
echo Setup Complete!
echo ===================================================
echo.
echo Default Credentials:
echo   Email:    admin@floortrading.com
echo   Password: admin123
echo.
echo Quick Start:
echo   Development (local):
echo     npm run dev
echo.
echo   Development (Docker):
echo     npm run docker:up
echo.
echo Access URLs:
echo   Admin Portal:     http://localhost:3000
echo   Customer Portal:  http://localhost:3002
echo   Factory Portal:   http://localhost:3003
echo   API Server:       http://localhost:3001
echo.
echo Useful Commands:
echo   npm run dev              - Start all services
echo   npm run dev:backend      - Start backend only
echo   npm run build:all        - Build all frontends
echo   npm run docker:up        - Start with Docker
echo   npm run docker:down      - Stop Docker containers
echo   npm run docker:logs      - View Docker logs
echo.
echo Documentation:
echo   README.md                - Project overview and architecture
echo   docs/API_REFERENCE.md    - API endpoint documentation
echo   docs/DATABASE_SCHEMA.md  - Database schema details
echo   docs/USER_GUIDE.md       - User guides for each portal
echo.
echo Happy coding!
echo.

pause
