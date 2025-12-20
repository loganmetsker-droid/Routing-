@echo off
REM =====================================================
REM Database Migration Runner for Windows
REM Routing & Dispatching SaaS Platform
REM =====================================================

setlocal enabledelayedexpansion

REM Default database connection parameters
if "%DB_HOST%"=="" set DB_HOST=localhost
if "%DB_PORT%"=="" set DB_PORT=5432
if "%DB_NAME%"=="" set DB_NAME=routing_dispatch
if "%DB_USER%"=="" set DB_USER=postgres
if "%DB_PASSWORD%"=="" set DB_PASSWORD=postgres

echo ========================================
echo Database Migration Runner
echo ========================================
echo.
echo Host: %DB_HOST%:%DB_PORT%
echo Database: %DB_NAME%
echo User: %DB_USER%
echo.

REM Get script directory
set SCRIPT_DIR=%~dp0

REM Set PostgreSQL password environment variable
set PGPASSWORD=%DB_PASSWORD%

echo Checking database connection...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -c "SELECT version();" >nul 2>&1

if %ERRORLEVEL% neq 0 (
    echo Database does not exist. Creating...
    psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d postgres -c "CREATE DATABASE %DB_NAME%;"
    if %ERRORLEVEL% neq 0 (
        echo Failed to create database
        exit /b 1
    )
    echo Database created successfully
    echo.
) else (
    echo Database connection successful
    echo.
)

echo ========================================
echo Running Migrations
echo ========================================
echo.

echo Running V1_create_tables.sql...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f "%SCRIPT_DIR%V1_create_tables.sql" -v ON_ERROR_STOP=1
if %ERRORLEVEL% neq 0 (
    echo Migration V1 failed
    exit /b 1
)
echo V1 completed successfully
echo.

echo Running V2_create_hypertables.sql...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f "%SCRIPT_DIR%V2_create_hypertables.sql" -v ON_ERROR_STOP=1
if %ERRORLEVEL% neq 0 (
    echo Migration V2 failed
    exit /b 1
)
echo V2 completed successfully
echo.

echo Running V3_seed_data.sql...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f "%SCRIPT_DIR%V3_seed_data.sql" -v ON_ERROR_STOP=1
if %ERRORLEVEL% neq 0 (
    echo Migration V3 failed
    exit /b 1
)
echo V3 completed successfully
echo.

echo ========================================
echo All migrations completed successfully!
echo ========================================
echo.

echo Verifying migration results...
echo.

psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -c "SELECT 'vehicles' as table_name, COUNT(*) as count FROM vehicles UNION ALL SELECT 'drivers', COUNT(*) FROM drivers UNION ALL SELECT 'shifts', COUNT(*) FROM shifts UNION ALL SELECT 'jobs', COUNT(*) FROM jobs UNION ALL SELECT 'routes', COUNT(*) FROM routes UNION ALL SELECT 'route_jobs', COUNT(*) FROM route_jobs UNION ALL SELECT 'telemetry', COUNT(*) FROM telemetry ORDER BY table_name;"

echo.
echo Migration verification complete
echo.
echo Next steps:
echo   1. Review the data: psql -h %DB_HOST% -U %DB_USER% -d %DB_NAME%
echo   2. Test your application
echo   3. Start developing!
echo.

endlocal
