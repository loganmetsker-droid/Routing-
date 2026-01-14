@echo off
REM Script to update frontend production environment with Railway backend URL
REM Usage: update-production-url.bat <your-railway-url>

if "%~1"=="" (
    echo Usage: update-production-url.bat YOUR-RAILWAY-URL
    echo Example: update-production-url.bat routing-dispatch-backend-production.up.railway.app
    exit /b 1
)

set RAILWAY_URL=%~1

echo Updating frontend/.env.production with Railway URL...

(
echo # Production Environment Variables
echo # Backend API URL - Deployed on Railway
echo VITE_API_URL=https://%RAILWAY_URL%/api
echo VITE_GRAPHQL_URL=https://%RAILWAY_URL%/graphql
echo VITE_WS_URL=wss://%RAILWAY_URL%
) > frontend\.env.production

echo ✅ Updated frontend/.env.production

echo.
echo Next steps:
echo 1. Commit the changes:
echo    cd frontend
echo    git add .env.production
echo    git commit -m "chore: Update production backend URL to Railway"
echo    git push origin main
echo.
echo 2. Vercel will automatically redeploy with the new URL
echo.
echo 3. Visit https://frontend-seven-mu-49.vercel.app/dispatch to test

pause
